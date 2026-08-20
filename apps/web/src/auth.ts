// Authority OIDC Authorization Code + PKCE flow for the inspector/admin PWA.
//
// This never talks to the platform API — it is a standard public-client
// (no secret) exchange directly against the identity provider, per RFC
// 7636. The resulting id_token is kept in memory only (React state), never
// written to localStorage or a service-worker cache, per the offline PWA
// requirement to never persist long-lived credentials.
//
// When VITE_OIDC_* is not configured (e.g. plain local development), all
// functions here are simply unused and the app falls back to its existing
// manual bearer-token field.

export interface OidcConfig {
  issuerUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export function readOidcConfig(env: ImportMetaEnv = import.meta.env): OidcConfig | null {
  const issuerUrl = env.VITE_OIDC_ISSUER_URL;
  const clientId = env.VITE_OIDC_CLIENT_ID;
  const redirectUri = env.VITE_OIDC_REDIRECT_URI;
  if (!issuerUrl || !clientId || !redirectUri) return null;
  return { issuerUrl: issuerUrl.replace(/\/$/, ''), clientId, redirectUri, scope: env.VITE_OIDC_SCOPE ?? 'openid profile' };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateRandomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

const PENDING_KEY = 'erf-oidc-pending';

/** Redirects the browser to the identity provider's authorize endpoint.
 * Assumes the standard `/authorize` and `/token` paths under the issuer;
 * switch to OIDC discovery (`/.well-known/openid-configuration`) here if
 * the selected authority IdP uses different paths. */
export async function beginSignIn(config: OidcConfig): Promise<void> {
  const verifier = generateRandomToken();
  const state = generateRandomToken();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const challenge = await codeChallengeFor(verifier);
  const url = new URL(`${config.issuerUrl}/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  window.location.assign(url.toString());
}

export interface TokenResult {
  idToken: string;
  expiresAt: number;
}

/** Call on app load with `window.location.search`. Returns null when the
 * current URL is not an OIDC callback (the normal case). Throws on a
 * state mismatch or a failed exchange so the caller can surface it. */
export async function completeSignIn(config: OidcConfig, locationSearch: string, fetchImpl: typeof fetch = fetch): Promise<TokenResult | null> {
  const params = new URLSearchParams(locationSearch);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  if (!pendingRaw) throw new Error('No pending sign-in found for this callback. Start sign-in again.');
  sessionStorage.removeItem(PENDING_KEY);
  const pending = JSON.parse(pendingRaw) as { verifier: string; state: string };
  if (pending.state !== state) throw new Error('OIDC state did not match; possible CSRF or a stale callback link.');
  const response = await fetchImpl(`${config.issuerUrl}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: pending.verifier
    }).toString()
  });
  if (!response.ok) throw new Error(`Identity provider token exchange failed: HTTP ${response.status}`);
  const body = await response.json() as { id_token?: string; expires_in?: number };
  if (!body.id_token) throw new Error('Identity provider response did not include an id_token.');
  return { idToken: body.id_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
}
