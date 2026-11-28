import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, provider } from "@/lib/cloud";
import { googleOAuthConfig } from "@/lib/connections";
import { connectionsConfigured } from "@/lib/connections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which providers an organisation has connected (metadata only; secrets are never readable here). */
export async function GET(request: Request) {
  try {
    const available = { google: Boolean(googleOAuthConfig()) && connectionsConfigured() };
    const org = new URL(request.url).searchParams.get("organisationId");
    if (!org) return NextResponse.json({ available, connections: [] }, { headers: { "Cache-Control": "no-store" } });
    const { token, user } = await authenticated(request);
    const id = organisationId(org);
    await membership(token, user.id, id);
    const rows = await provider("/rest/v1/vista_connections?select=provider,account,scopes,property,connected_at&organisation_id=eq." + id, {}, token);
    return NextResponse.json({ available, connections: rows || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Status unavailable." }, { status: e instanceof CloudError ? e.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
