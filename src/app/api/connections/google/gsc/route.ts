import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, provider, readJson, requireSameOrigin } from "@/lib/cloud";
import { googleOAuthConfig } from "@/lib/connections";
import { accessToken } from "@/lib/connections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const g = async (url: string, token: string, init: RequestInit = {}) => {
  const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new CloudError("Search Console returned HTTP " + r.status + ".", r.status === 403 ? 403 : 502);
  return r.json();
};

/**
 * Tenant Search Console (measured, read-only). { organisationId } lists the properties the connected
 * account can see; { organisationId, property } selects one (owners and editors) and returns the last
 * 28 days of queries and pages exactly as Google defines clicks, impressions, CTR and position.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const cfg = googleOAuthConfig();
    if (!cfg) throw new CloudError("Google connections are not configured on this deployment.", 503);
    const { token: session, user } = await authenticated(request);
    const body = await readJson(request, 4096);
    const org = organisationId(body.organisationId);
    const role = await membership(session, user.id, org);
    const { token, property: saved, account } = await accessToken(cfg, org);
    const wanted = typeof body.property === "string" ? body.property.slice(0, 300) : saved;
    if (!wanted) {
      const sites = await g("https://www.googleapis.com/webmasters/v3/sites", token) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
      return NextResponse.json({ account, properties: (sites.siteEntry || []).filter(s => s.permissionLevel !== "siteUnverifiedUser").map(s => ({ property: s.siteUrl, permission: s.permissionLevel })) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (wanted !== saved) {
      if (!["owner", "editor"].includes(role)) throw new CloudError("Only owners and editors can choose the property.", 403);
      await provider("/rest/v1/rpc/vista_select_property", { method: "POST", body: JSON.stringify({ org, prov: "google", prop: wanted }) }, session);
    }
    const end = new Date(Date.now() - 2 * 86400_000), start = new Date(end.getTime() - 27 * 86400_000);
    const period = { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    const query = (dimension: string) => g("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(wanted) + "/searchAnalytics/query", token, { method: "POST", body: JSON.stringify({ ...period, dimensions: [dimension], rowLimit: 250 }) }) as Promise<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>;
    const [queries, pages] = await Promise.all([query("query"), query("page")]);
    const rows = (d: Awaited<ReturnType<typeof query>>) => (d.rows || []).map(r => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: Math.round(r.position * 10) / 10 }));
    return NextResponse.json({ source: "Google Search Console API (organisation connection)", account, property: wanted, period, observedAt: new Date().toISOString(), queries: rows(queries), pages: rows(pages), note: "Measured by Google for this property and period; positions are averages, not rankings for every searcher." }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Search Console request failed." }, { status: e instanceof CloudError ? e.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
