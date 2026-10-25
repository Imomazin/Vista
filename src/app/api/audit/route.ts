import {CloudError,readJson,requireSameOrigin} from '@/lib/cloud';
import {requestLimit} from '@/lib/rate-limit';
import * as cheerio from "cheerio";
import { eligiblePages } from "@/lib/investigation";
import { NextResponse } from "next/server";
import { analyseHtml } from "@/lib/audit";
import { fetchPublicHtml } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(request: Request) {
  const started=Date.now();const requestId=crypto.randomUUID();
  try {
    requireSameOrigin(request);
    const limit=await requestLimit(request,'public-audit');
    if(!limit.allowed)return NextResponse.json({error:'Audit limit reached. Please try again later.',requestId},{status:429,headers:{'Retry-After':String(limit.retryAfter),'Cache-Control':'no-store'}});
    const data: unknown = await readJson(request,4096);
    const url = typeof data === "object" && data !== null && "url" in data ? (data as { url: unknown }).url : null;
    if (typeof url !== "string" || url.length > 2048) {
      return NextResponse.json({ error: "Enter a valid HTTPS website URL." }, { status: 400 });
    }
    const page = await fetchPublicHtml(url);
    const report = analyseHtml(page.url, page.html, page.robots);
    const discover = typeof data === "object" && data !== null && "discover" in data && data.discover === true;
    const $ = discover ? cheerio.load(page.html) : null;
    const result = $ ? { report, links: eligiblePages(page.url, $("a[href]").map((_,el)=>$(el).attr("href") || "").get()) } : report;
    console.info(JSON.stringify({event:'vista.audit',requestId,status:'success',durationMs:Date.now()-started,protection:limit.mode}));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect the website.";
    const status=error instanceof CloudError?error.status:422;console.warn(JSON.stringify({event:'vista.audit',requestId,status,durationMs:Date.now()-started}));
    return NextResponse.json({ error: message,requestId }, { status,headers:{'Cache-Control':'no-store','X-Request-ID':requestId} });
  }
}
