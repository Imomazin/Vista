import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, provider, readJson, requireSameOrigin } from "@/lib/cloud";
import { googleOAuthConfig, revokeGoogle } from "@/lib/connections";
import { accessToken } from "@/lib/connections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disconnect: revoke the grant at Google, then delete the stored credential. Owners and editors. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const cfg = googleOAuthConfig();
    if (!cfg) throw new CloudError("Google connections are not configured on this deployment.", 503);
    const { token: session, user } = await authenticated(request);
    const body = await readJson(request, 4096);
    const org = organisationId(body.organisationId);
    await membership(session, user.id, org, true);
    let revoked = false;
    try { const { refresh } = await accessToken(cfg, org); revoked = await revokeGoogle(refresh); } catch (e) { if (!(e instanceof CloudError && e.status === 404)) throw e; }
    await provider("/rest/v1/rpc/vista_delete_connection", { method: "POST", body: JSON.stringify({ org, prov: "google" }) }, session);
    return NextResponse.json({ disconnected: true, revokedAtGoogle: revoked }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Disconnect failed." }, { status: e instanceof CloudError ? e.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
