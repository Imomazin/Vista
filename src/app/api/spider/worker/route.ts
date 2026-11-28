import { NextResponse } from "next/server";
import { CloudError } from "@/lib/cloud";
import { cronAuthorised, runSpider, spiderConfigured } from "@/lib/intel/spider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** VisTa Spider worker, invoked by Vercel Cron (Authorization: Bearer CRON_SECRET). */
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  // Inactive until the owner applies database/index.sql and database/spider.sql and sets the secrets.
  if (!spiderConfigured()) return NextResponse.json({ configured: false, requestId }, { headers: { "Cache-Control": "no-store" } });
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Worker authorization required.", requestId }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await runSpider();
    console.info(JSON.stringify({ event: "vista.spider.worker", requestId, ...result }));
    return NextResponse.json({ configured: true, ...result, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof CloudError ? e.status : 503;
    console.warn(JSON.stringify({ event: "vista.spider.worker", requestId, status }));
    return NextResponse.json({ error: e instanceof CloudError ? e.message : "Worker execution failed.", requestId }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
export const POST = GET;
