import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authenticated, CloudError, readJson, requireSameOrigin, sessionCookie } from "../cloud";
import { requestLimit } from "../rate-limit";
import { FetchFailure, explainFailure } from "./http";

/** Shared guard for public intelligence endpoints: same-origin, rate limit, bounded JSON, no URL logging. */
const members = new Map<string, number>();
/** Signed-in organisation members (verified, cached briefly) receive a larger processing allowance. */
export async function isMember(request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(/;\s*/).find(c => c.startsWith(sessionCookie + "="))?.slice(sessionCookie.length + 1);
  if (!token) return false;
  const key = createHash("sha256").update(token).digest("hex");
  const until = members.get(key);
  if (until && until > Date.now()) return true;
  try { await authenticated(request); if (members.size > 5000) members.clear(); members.set(key, Date.now() + 10 * 60_000); return true; } catch { return false; }
}

export async function intelligenceRoute(request: Request, scope: string, limit: number, maxBody: number, handler: (body: Record<string, unknown>) => Promise<unknown>, memberLimit?: number) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  try {
    requireSameOrigin(request);
    const member = memberLimit ? await isMember(request) : false;
    const allowance = await requestLimit(request, member ? scope + "-member" : scope, member ? memberLimit! : limit, 600);
    if (!allowance.allowed) return NextResponse.json({ error: "The processing limit for this period has been reached. Resume the investigation in a few minutes; completed work is kept.", retryAfter: allowance.retryAfter, requestId }, { status: 429, headers: { "Retry-After": String(allowance.retryAfter), "Cache-Control": "no-store" } });
    const body = await readJson(request, maxBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new CloudError("Invalid request.");
    const result = await handler(body as Record<string, unknown>);
    console.info(JSON.stringify({ event: "vista." + scope, requestId, status: "success", durationMs: Date.now() - started }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  } catch (error) {
    const status = error instanceof CloudError ? error.status : error instanceof FetchFailure ? 422 : 502;
    const message = error instanceof CloudError ? error.message : error instanceof FetchFailure ? explainFailure(error.kind) : error instanceof Error ? error.message.slice(0, 300) : "Processing failed.";
    console.warn(JSON.stringify({ event: "vista." + scope, requestId, status, durationMs: Date.now() - started }));
    return NextResponse.json({ error: message, requestId }, { status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  }
}

export function stringList(value: unknown, max: number, maxLength = 2048): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= maxLength).slice(0, max);
}
