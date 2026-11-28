/**
 * Server-side access to tenant connections (database/connections.sql). Secrets are read only with the
 * service role and are unsealed in memory to obtain short-lived access tokens; they are never returned.
 */
import { CloudError, provider } from "./cloud";
import { credentialAad, refreshAccess, unseal, type OAuthConfig } from "./connections";
import { serviceKey } from "./intel/spider";

type Call = typeof provider;
export function connectionsConfigured(env: Record<string, string | undefined> = process.env) { return Boolean(serviceKey(env)); }

export async function storeConnection(input: { organisationId: string; provider: string; account: string; scopes: string[]; sealed: string; userId: string }, call: Call = provider) {
  const key = serviceKey();
  if (!key) throw new CloudError("Connections are not configured on this deployment.", 503);
  await call("/rest/v1/rpc/vista_store_connection", { method: "POST", body: JSON.stringify({ org: input.organisationId, prov: input.provider, acct: input.account, scope_list: input.scopes, sealed: input.sealed, by_user: input.userId }) }, key);
}

/** A fresh access token for the organisation's connection (refresh token unsealed in memory only). */
export async function accessToken(cfg: OAuthConfig, organisationId: string, prov = "google", call: Call = provider, fetcher: typeof fetch = fetch) {
  const key = serviceKey();
  if (!key) throw new CloudError("Connections are not configured on this deployment.", 503);
  const rows = await call("/rest/v1/vista_connections?select=secret,property,account,scopes&organisation_id=eq." + organisationId + "&provider=eq." + prov, {}, key) as { secret: string; property: string | null; account: string | null; scopes: string[] }[] | null;
  const row = rows?.[0];
  if (!row) throw new CloudError("This organisation has not connected Google yet.", 404);
  const refresh = unseal(row.secret, cfg.key, credentialAad(organisationId, prov));
  const token = await refreshAccess(cfg, refresh, fetcher);
  return { token: token.accessToken, property: row.property, account: row.account, refresh };
}
