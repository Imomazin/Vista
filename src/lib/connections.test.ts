import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { beginGoogleAuth, credentialAad, exchangeCode, googleOAuthConfig, readPending, refreshAccess, revokeGoogle, seal, unseal } from "./connections";
import { accessToken, storeConnection } from "./connections-store";

const env = { GOOGLE_OAUTH_CLIENT_ID: "client-123.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "secret-xyz", VISTA_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64") };
const cfg = googleOAuthConfig(env)!;
const org = "11111111-2222-4333-8444-555555555555", other = "99999999-2222-4333-8444-555555555555";

test("R1 connections: configuration and the exact redirect URI", () => {
  assert.equal(googleOAuthConfig({}), null, "inactive without credentials");
  assert.equal(cfg.redirectUri, "https://vista.ambidexters.com/api/connections/google/callback");
  assert.equal(googleOAuthConfig({ ...env, VISTA_PUBLIC_ORIGIN: "https://preview.example.app/some/path" })!.redirectUri, "https://preview.example.app/api/connections/google/callback");
  assert.throws(() => googleOAuthConfig({ ...env, VISTA_TOKEN_ENCRYPTION_KEY: "c2hvcnQ=" }), /32 bytes/);
  assert.throws(() => googleOAuthConfig({ ...env, VISTA_PUBLIC_ORIGIN: "http://vista.example.com" }), /HTTPS/);
});

test("R1 connections: refresh tokens are sealed, tamper-evident and bound to the organisation", () => {
  const sealed = seal("1//refresh-token", cfg.key, credentialAad(org, "google"));
  assert.match(sealed, /^v1\./);
  assert.ok(!sealed.includes("refresh-token"));
  assert.equal(unseal(sealed, cfg.key, credentialAad(org, "google")), "1//refresh-token");
  assert.throws(() => unseal(sealed, cfg.key, credentialAad(other, "google")), /integrity/, "another organisation cannot use it");
  const parts = sealed.split("."); parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("A") ? "BB" : "AA");
  assert.throws(() => unseal(parts.join("."), cfg.key, credentialAad(org, "google")), /integrity/);
  assert.throws(() => unseal(sealed, randomBytes(32), credentialAad(org, "google")), /integrity/);
});

test("R1 connections: PKCE authorisation URL, state and expiry", () => {
  const { url, cookie, pending } = beginGoogleAuth(cfg, org, "user-1", 1_000);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("redirect_uri"), cfg.redirectUri);
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("code_challenge"), createHash("sha256").update(pending.verifier).digest("base64url"));
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.deepEqual(u.searchParams.get("scope")!.split(" ").sort(), ["email", "https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/webmasters.readonly", "openid"]);
  assert.ok(!cookie.includes(pending.verifier), "the verifier is sealed in the cookie");
  assert.equal(readPending(cookie, pending.state, cfg, 2_000).organisationId, org);
  assert.throws(() => readPending(cookie, "forged-state-value-000000000000", cfg, 2_000), /did not match/);
  assert.throws(() => readPending(cookie, pending.state, cfg, 1_000 + 11 * 60_000), /expired/);
  assert.throws(() => readPending(undefined, pending.state, cfg), /expired/);
});

test("R1 connections: code exchange, refresh and revoke call Google with the right parameters", async () => {
  const seen: { url: string; body: URLSearchParams }[] = [];
  const idToken = "x." + Buffer.from(JSON.stringify({ email: "owner@example.com" })).toString("base64url") + ".y";
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: new URLSearchParams(String(init.body)) });
    if (url.endsWith("/revoke")) return new Response("", { status: 200 });
    const grant = new URLSearchParams(String(init.body)).get("grant_type");
    return Response.json(grant === "authorization_code" ? { access_token: "ya29.a", refresh_token: "1//r", expires_in: 3599, scope: "openid https://www.googleapis.com/auth/webmasters.readonly", id_token: idToken } : { access_token: "ya29.b", expires_in: 3599, scope: "https://www.googleapis.com/auth/webmasters.readonly" });
  }) as typeof fetch;
  const t = await exchangeCode(cfg, "4/code", "verifier-abc", fetcher, 0);
  assert.equal(t.refreshToken, "1//r");
  assert.equal(t.email, "owner@example.com");
  assert.equal(seen[0].body.get("code_verifier"), "verifier-abc");
  assert.equal(seen[0].body.get("redirect_uri"), cfg.redirectUri);
  const r = await refreshAccess(cfg, "1//r", fetcher);
  assert.equal(r.accessToken, "ya29.b");
  assert.equal(seen[1].body.get("grant_type"), "refresh_token");
  assert.equal(await revokeGoogle("1//r", fetcher), true);
  assert.equal(seen[2].body.get("token"), "1//r");
  const denied = (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(exchangeCode(cfg, "bad", "v", denied), /invalid_grant/);
});

test("R1 connections: secrets are stored and read only with the service role, never returned", async () => {
  process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY = "service-role";
  const calls: { path: string; token?: string; body?: string }[] = [];
  const sealed = seal("1//r", cfg.key, credentialAad(org, "google"));
  const call = (async (path: string, init: RequestInit = {}, token?: string) => { calls.push({ path, token, body: init.body as string }); return path.startsWith("/rest/v1/vista_connections") ? [{ secret: sealed, property: "sc-domain:example.com", account: "owner@example.com", scopes: [] }] : null; }) as never;
  await storeConnection({ organisationId: org, provider: "google", account: "owner@example.com", scopes: ["openid"], sealed, userId: "user-1" }, call);
  assert.equal(calls[0].path, "/rest/v1/rpc/vista_store_connection");
  assert.equal(JSON.parse(calls[0].body!).by_user, "user-1");
  const fetcher = (async () => Response.json({ access_token: "ya29.fresh", expires_in: 3600 })) as unknown as typeof fetch;
  const got = await accessToken(cfg, org, "google", call, fetcher);
  assert.equal(got.token, "ya29.fresh");
  assert.equal(got.property, "sc-domain:example.com");
  assert.ok(calls.every(c => c.token === "service-role"));
  delete process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY;
});
