import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AppConfig } from '../config.js';

/** The identity established by a verified OIDC token. Roles and geographic
 * scope are never taken from token claims — the authority's identity
 * provider is not expected to emit application-specific claims, and doing
 * so would let a token holder self-assert privileges. They are always
 * looked up from the local `user_roles`/`user_geographies` provisioning
 * tables by the caller, keyed on this subject. */
export interface OidcIdentity {
  userId: string;
}

export class OidcVerifier {
  private readonly keys: JWTVerifyGetKey;

  /** `keys` is injectable so tests can verify against a local JWK set
   * instead of fetching a real provider's `.well-known/jwks.json`. */
  constructor(private readonly config: AppConfig, keys?: JWTVerifyGetKey) {
    this.keys = keys ?? createRemoteJWKSet(new URL(`${config.OIDC_ISSUER_URL!.replace(/\/$/, '')}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<OidcIdentity> {
    const result = await jwtVerify(token, this.keys, { issuer: this.config.OIDC_ISSUER_URL, audience: this.config.OIDC_AUDIENCE });
    if (typeof result.payload.sub !== 'string' || !result.payload.sub) throw new Error('OIDC token is missing subject.');
    return { userId: result.payload.sub };
  }
}
