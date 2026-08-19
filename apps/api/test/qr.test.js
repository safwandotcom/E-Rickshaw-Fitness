import assert from 'node:assert/strict';
import test from 'node:test';
import { DevelopmentQrSigner } from '../dist/lib/crypto.js';

test('validates a signed QR payload and rejects tampering', () => {
  const signer = new DevelopmentQrSigner('test-key');
  const token = signer.issue({
    cid: 'ERF-2026-00000001',
    ch: '8821',
    zone: 'DHK-N-04',
    iat: 1_780_000_000,
    exp: 1_811_536_000
  });
  assert.equal(signer.validate(token)?.cid, 'ERF-2026-00000001');
  assert.equal(signer.validate(`${token}x`), null);
});
