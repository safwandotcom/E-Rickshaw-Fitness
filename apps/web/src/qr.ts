function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function pemToBytes(pem: string): Uint8Array {
  return fromBase64Url(pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function verifyOffline(token: string, pem: string): Promise<{ valid: boolean; payload?: Record<string, unknown>; reason?: string }> {
  const [prefix, body, signature] = token.split('.');
  if (prefix !== 'ERF1' || !body || !signature) return { valid: false, reason: 'Malformed QR payload.' };
  try {
    const key = await crypto.subtle.importKey('spki', asArrayBuffer(pemToBytes(pem)), { name: 'Ed25519' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'Ed25519' }, key, asArrayBuffer(fromBase64Url(signature)), asArrayBuffer(fromBase64Url(body)));
    if (!valid) return { valid: false, reason: 'Invalid signature.' };
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, payload, reason: 'Certificate expired.' };
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'This device cannot verify the stored key.' };
  }
}
