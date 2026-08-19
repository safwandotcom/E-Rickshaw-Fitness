import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AppConfig } from '../config.js';
import type { Principal, Role } from './authorization.js';

export class OidcVerifier {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: AppConfig) {
    this.keys = createRemoteJWKSet(new URL(`${config.OIDC_ISSUER_URL!.replace(/\/$/, '')}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<Principal> {
    const result = await jwtVerify(token, this.keys, { issuer: this.config.OIDC_ISSUER_URL, audience: this.config.OIDC_AUDIENCE });
    return claimsToPrincipal(result.payload);
  }
}

function claimsToPrincipal(payload: JWTPayload): Principal {
  if (!payload.sub) throw new Error('OIDC token is missing subject.');
  const roles = Array.isArray(payload.roles) ? payload.roles.filter(isRole) : [];
  if (!roles.length) throw new Error('OIDC token contains no recognized roles.');
  const districtIds = Array.isArray(payload.district_ids) ? payload.district_ids.filter(isString) : [];
  const zoneIds = Array.isArray(payload.zone_ids) ? payload.zone_ids.filter(isString) : [];
  return { userId: payload.sub, roles, scope: { districtIds, zoneIds } };
}

function isString(value: unknown): value is string { return typeof value === 'string'; }
function isRole(value: unknown): value is Role {
  return ['inspector', 'hub_supervisor', 'district_administrator', 'central_administrator', 'finance_operator', 'traffic_police_verifier'].includes(String(value));
}
