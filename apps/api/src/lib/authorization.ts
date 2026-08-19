export type Role =
  | 'inspector'
  | 'hub_supervisor'
  | 'district_administrator'
  | 'central_administrator'
  | 'finance_operator'
  | 'traffic_police_verifier';

export interface GeographicScope {
  districtIds: string[];
  zoneIds: string[];
}

export interface Principal {
  userId: string;
  roles: Role[];
  scope: GeographicScope;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function requireRole(principal: Principal, allowedRoles: Role[]): void {
  if (!principal.roles.some((role) => allowedRoles.includes(role))) {
    throw new AuthorizationError('Your role does not permit this action.');
  }
}

export function requireZoneAccess(principal: Principal, districtId: string, zoneId: string): void {
  if (principal.roles.includes('central_administrator')) return;

  const districtAllowed = principal.scope.districtIds.includes(districtId);
  const zoneAllowed = principal.scope.zoneIds.includes(zoneId);
  if (!districtAllowed || !zoneAllowed) {
    throw new AuthorizationError('The selected zone is outside your assignment.');
  }
}
