import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, readJson, requireSameOrigin } from "@/lib/cloud";
import { beginGoogleAuth, googleOAuthConfig, oauthCookie } from "@/lib/connections";
import { connectionsConfigured } from "@/lib/connections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start connecting an organisation's Google account (Search Console and GA4, read-only). Owners and editors. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const cfg = googleOAuthConfig();
    if (!cfg || !connectionsConfigured()) throw new CloudError("Google connections are not configured on this deployment.", 503);
    const { token, user } = await authenticated(request);
    const body = await readJson(request, 4096);
    const org = organisationId(body.organisationId);
    await membership(token, user.id, org, true);
    const { url, cookie } = beginGoogleAuth(cfg, org, user.id);
    const res = NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
    // SameSite=Lax so the cookie returns with Google's top-level redirect to the callback.
    res.cookies.set(oauthCookie, cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "Could not start the connection." }, { status: e instanceof CloudError ? e.status : 400, headers: { "Cache-Control": "no-store" } });
  }
}
