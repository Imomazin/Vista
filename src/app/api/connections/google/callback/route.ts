import { NextResponse } from "next/server";
import { CloudError } from "@/lib/cloud";
import { credentialAad, exchangeCode, googleOAuthConfig, oauthCookie, readPending, seal } from "@/lib/connections";
import { storeConnection } from "@/lib/connections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OAuth redirect URI: <VISTA_PUBLIC_ORIGIN>/api/connections/google/callback (exact). */
export async function GET(request: Request) {
  const cfg = googleOAuthConfig();
  const back = (outcome: string) => {
    const res = NextResponse.redirect((cfg?.origin || new URL(request.url).origin) + "/#studio/search?connection=" + encodeURIComponent(outcome), 303);
    res.cookies.set(oauthCookie, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  try {
    if (!cfg) throw new CloudError("Google connections are not configured on this deployment.", 503);
    const url = new URL(request.url);
    if (url.searchParams.get("error")) return back("declined");
    const code = url.searchParams.get("code");
    const cookie = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(oauthCookie + "="))?.slice(oauthCookie.length + 1);
    const pending = readPending(cookie ? decodeURIComponent(cookie) : undefined, url.searchParams.get("state"), cfg);
    if (!code || code.length > 2048) throw new CloudError("Google returned no authorisation code.", 400);
    const tokens = await exchangeCode(cfg, code, pending.verifier);
    if (!tokens.refreshToken) throw new CloudError("Google did not grant offline access; connect again and approve access.", 400);
    const required = ["https://www.googleapis.com/auth/webmasters.readonly"];
    if (!required.every(s => tokens.scopes.includes(s))) throw new CloudError("Search Console access was not granted.", 400);
    await storeConnection({ organisationId: pending.organisationId, provider: "google", account: tokens.email || "", scopes: tokens.scopes, sealed: seal(tokens.refreshToken, cfg.key, credentialAad(pending.organisationId, "google")), userId: pending.userId });
    console.info(JSON.stringify({ event: "vista.connection.google", outcome: "connected" }));
    return back("connected");
  } catch (e) {
    console.warn(JSON.stringify({ event: "vista.connection.google", outcome: "failed", status: e instanceof CloudError ? e.status : 500 }));
    return back("failed");
  }
}
