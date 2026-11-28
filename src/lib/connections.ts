/**
 * Tenant-scoped OAuth connections (R1: Google Search Console and GA4, read-only).
 *
 * Authorization code flow with PKCE (S256) and a random state, both kept in a sealed, short-lived,
 * HttpOnly cookie. Refresh tokens are encrypted with AES-256-GCM (VISTA_TOKEN_ENCRYPTION_KEY) and bound
 * to the organisation and provider as associated data; they are stored through a security-definer RPC
 * and are never readable by browser roles (database/connections.sql). Access tokens are obtained on
 * the server when needed. The redirect URI is exact: <VISTA_PUBLIC_ORIGIN>/api/connections/google/callback.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CloudError } from "./cloud";

export const googleScopes = ["openid", "email", "https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"] as const;
export const oauthCookie = "__Host-vista-oauth";
const b64url = (b: Buffer) => b.toString("base64url");

export type OAuthConfig = { clientId: string; clientSecret: string; key: Buffer; origin: string; redirectUri: string };
export function googleOAuthConfig(env: Record<string, string | undefined> = process.env): OAuthConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID, clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET, rawKey = env.VISTA_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !rawKey) return null;
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new CloudError("VISTA_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.", 503);
  const origin = new URL(env.VISTA_PUBLIC_ORIGIN || "https://vista.ambidexters.com").origin;
  if (!origin.startsWith("https://") && !/^http:\/\/localhost(:\d+)?$/.test(origin)) throw new CloudError("VISTA_PUBLIC_ORIGIN must use HTTPS.", 503);
  return { clientId, clientSecret, key, origin, redirectUri: origin + "/api/connections/google/callback" };
}

/** AES-256-GCM with associated data; output "v1.<iv>.<ciphertext>.<tag>" (base64url). */
export function seal(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", b64url(iv), b64url(ct), b64url(cipher.getAuthTag())].join(".");
}
export function unseal(sealed: string, key: Buffer, aad: string): string {
  const [v, iv, ct, tag] = sealed.split(".");
  if (v !== "v1" || !iv || !ct || !tag) throw new CloudError("Stored credential is not readable.", 500);
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch { throw new CloudError("Stored credential failed integrity checks.", 500); }
}

export type PendingAuth = { state: string; verifier: string; organisationId: string; userId: string; expires: number };
/** Start: PKCE verifier and challenge, state, the exact authorisation URL and the sealed cookie value. */
export function beginGoogleAuth(cfg: OAuthConfig, organisationId: string, userId: string, now = Date.now()) {
  const verifier = b64url(randomBytes(32)), state = b64url(randomBytes(24));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", scope: googleScopes.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "false", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  const pending: PendingAuth = { state, verifier, organisationId, userId, expires: now + 10 * 60_000 };
  return { url: url.href, cookie: seal(JSON.stringify(pending), cfg.key, "oauth-pending"), pending };
}

export function readPending(cookieValue: string | undefined, state: string | null, cfg: OAuthConfig, now = Date.now()): PendingAuth {
  if (!cookieValue || !state) throw new CloudError("The connection request has expired. Start again from VisTa.", 400);
  const pending = JSON.parse(unseal(cookieValue, cfg.key, "oauth-pending")) as PendingAuth;
  const a = Buffer.from(pending.state), b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CloudError("The connection request did not match. Start again from VisTa.", 400);
  if (pending.expires < now) throw new CloudError("The connection request has expired. Start again from VisTa.", 400);
  return pending;
}

type Fetcher = typeof fetch;
export type TokenSet = { accessToken: string; refreshToken?: string; expiresAt: number; scopes: string[]; email?: string };
async function tokenRequest(body: Record<string, string>, fetcher: Fetcher): Promise<Record<string, unknown>> {
  const r = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const data = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new CloudError("Google did not accept the request (" + String(data.error || r.status) + ").", r.status === 400 || r.status === 401 ? 400 : 502);
  return data;
}
const emailFromIdToken = (idToken: unknown) => { try { return String(JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()).email || ""); } catch { return ""; } };

export async function exchangeCode(cfg: OAuthConfig, code: string, verifier: string, fetcher: Fetcher = fetch, now = Date.now()): Promise<TokenSet> {
  const d = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri }, fetcher);
  if (typeof d.access_token !== "string") throw new CloudError("Google returned no access token.", 502);
  return { accessToken: d.access_token, refreshToken: typeof d.refresh_token === "string" ? d.refresh_token : undefined, expiresAt: now + Number(d.expires_in || 3600) * 1000, scopes: String(d.scope || "").split(" ").filter(Boolean), email: emailFromIdToken(d.id_token) || undefined };
}

export async function refreshAccess(cfg: OAuthConfig, refreshToken: string, fetcher: Fetcher = fetch, now = Date.now()): Promise<TokenSet> {
  const d = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret }, fetcher);
  if (typeof d.access_token !== "string") throw new CloudError("Google returned no access token.", 502);
  return { accessToken: d.access_token, expiresAt: now + Number(d.expires_in || 3600) * 1000, scopes: String(d.scope || "").split(" ").filter(Boolean) };
}

export async function revokeGoogle(token: string, fetcher: Fetcher = fetch): Promise<boolean> {
  const r = await fetcher("https://oauth2.googleapis.com/revoke", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  return r.ok || r.status === 400; // 400: already revoked or expired
}

/** The associated data that binds a stored credential to its organisation and provider. */
export const credentialAad = (organisationId: string, provider: string) => "connection:" + organisationId + ":" + provider;
