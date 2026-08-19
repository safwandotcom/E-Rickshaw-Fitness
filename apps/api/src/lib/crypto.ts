import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';

export class FieldCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  }

  decrypt(value: Buffer): string {
    const iv = value.subarray(0, 12);
    const tag = value.subarray(12, 28);
    const encrypted = value.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}

export interface QrPayload {
  v: 1;
  kid: string;
  cid: string;
  ch: string;
  zone: string;
  iat: number;
  exp: number;
  nonce: string;
}

export class DevelopmentQrSigner {
  private readonly keys = generateKeyPairSync('ed25519');

  constructor(private readonly keyId: string) {}

  issue(payload: Omit<QrPayload, 'v' | 'kid' | 'nonce'>): string {
    const full: QrPayload = { v: 1, kid: this.keyId, nonce: randomBytes(12).toString('base64url'), ...payload };
    const body = Buffer.from(JSON.stringify(full));
    const signature = sign(null, body, this.keys.privateKey);
    return `ERF1.${body.toString('base64url')}.${signature.toString('base64url')}`;
  }

  publicManifest(): { key_id: string; algorithm: string; public_key_pem: string }[] {
    return [{ key_id: this.keyId, algorithm: 'Ed25519', public_key_pem: this.keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() }];
  }

  validate(token: string): QrPayload | null {
    const [prefix, bodyPart, signaturePart] = token.split('.');
    if (prefix !== 'ERF1' || !bodyPart || !signaturePart) return null;
    const body = Buffer.from(bodyPart, 'base64url');
    const valid = verify(null, body, this.keys.publicKey, Buffer.from(signaturePart, 'base64url'));
    if (!valid) return null;
    const payload = JSON.parse(body.toString('utf8')) as QrPayload;
    return payload.v === 1 ? payload : null;
  }
}
