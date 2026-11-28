import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, provider, readJson, requireSameOrigin } from "@/lib/cloud";
import { validatePublicUrl } from "@/lib/intel/http";
import { spiderConfigured } from "@/lib/intel/spider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Schedule recrawls of an organisation's pages (VisTa Spider). Owners and editors only; stored under
 * row-level security with the member's own session, never the service role.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!spiderConfigured()) throw new CloudError("Scheduled monitoring is not configured on this deployment.", 503);
    const { token, user } = await authenticated(request);
    const body = await readJson(request, 20_000);
    const org = organisationId(body.organisationId);
    await membership(token, user.id, org, true);
    const days = Math.max(1, Math.min(90, Math.round(Number(body.everyDays) || 7)));
    const urls: string[] = (Array.isArray(body.urls) ? body.urls as unknown[] : []).filter((u): u is string => typeof u === "string").slice(0, 25).map(u => validatePublicUrl(u).href);
    if (!urls.length) throw new CloudError("Choose at least one page to monitor.");
    const rows = urls.map((url: string, i: number) => ({ organisation_id: org, url, every: days + " days", priority: i === 0 ? 80 : 60, render: Boolean(body.render), next_run_at: new Date().toISOString(), created_by: user.id }));
    await provider("/rest/v1/vista_spider_schedules?on_conflict=organisation_id,url", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) }, token);
    return NextResponse.json({ scheduled: urls.length, everyDays: days }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof CloudError ? e.status : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Scheduling failed." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
