import { NextResponse } from "next/server";
import { CloudError, readJson, requireSameOrigin } from "../cloud";
import { requestLimit } from "../rate-limit";
import { FetchFailure, explainFailure } from "./http";

/** Shared guard for public intelligence endpoints: same-origin, rate limit, bounded JSON, no URL logging. */
export async function intelligenceRoute(request: Request, scope: string, limit: number, maxBody: number, handler: (body: Record<string, unknown>) => Promise<unknown>) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  try {
    requireSameOrigin(request);
    const allowance = await requestLimit(request, scope, limit, 600);
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
