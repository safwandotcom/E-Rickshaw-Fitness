import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, createLocalJWKSet, SignJWT } from 'jose';
import { loadConfig } from '../dist/config.js';
import { OidcVerifier } from '../dist/lib/oidc.js';

test('requires OIDC settings outside local development', () => {
  assert.throws(() => loadConfig({
    NODE_ENV: 'staging', PORT: '3000', HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://erf:password@localhost:5432/erf',
    REDIS_URL: 'redis://localhost:6379', RABBITMQ_URL: 'amqp://erf:password@localhost:5672',
    AUTH_JWT_SECRET: 'staging-jwt-secret-that-is-long-enough',
    DATA_ENCRYPTION_SECRET: 'staging-data-secret-that-is-long-enough',
    MFS_WEBHOOK_SECRET: 'staging-mfs-secret-that-is-long-enough',
    QR_SIGNING_KEY_ID: 'staging-key', OIDC_ENABLED: 'false'
  }), /require OIDC/);
});

const config = {
  NODE_ENV: 'staging', OIDC_ENABLED: true,
  OIDC_ISSUER_URL: 'https://idp.example.test', OIDC_AUDIENCE: 'erf-api'
};

async function localVerifier() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = await exportJWK(publicKey);
  jwk.alg = 'EdDSA';
  jwk.kid = 'test-key';
  const keys = createLocalJWKSet({ keys: [jwk] });
  return { verifier: new OidcVerifier(config, keys), privateKey };
}

function issue(privateKey, claims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setIssuer(config.OIDC_ISSUER_URL)
    .setAudience(config.OIDC_AUDIENCE)
    .setSubject(claims.sub ?? 'idp-subject-123')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('accepts a verified token that carries no application role/scope claims', async () => {
  const { verifier, privateKey } = await localVerifier();
  // Real identity providers issue tokens with no knowledge of this app's
  // roles or geographic scopes — those come from local provisioning, not
  // the token. Verification must not depend on the token carrying them.
  const token = await issue(privateKey, {});
  const identity = await verifier.verify(token);
  assert.deepEqual(identity, { userId: 'idp-subject-123' });
});

test('rejects a token with no subject even though the signature is valid', async () => {
  const { verifier, privateKey } = await localVerifier();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setIssuer(config.OIDC_ISSUER_URL)
    .setAudience(config.OIDC_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  await assert.rejects(() => verifier.verify(token), /subject/);
});

test('rejects a token signed by an untrusted key', async () => {
  const { verifier } = await localVerifier();
  const { privateKey: wrongKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const token = await issue(wrongKey, {});
  await assert.rejects(() => verifier.verify(token));
});
