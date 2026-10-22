import { NextResponse } from "next/server";
import { analyseHtml } from "@/lib/audit";
import { fetchPublicHtml } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const windowMs = 10 * 60 * 1000;
const attempts = new Map<string, { start: number; count: number }>();

export async function POST(request: Request) {
  // Best-effort process-local throttling; production requires edge rate limits.
  const key = request.headers.get("x-real-ip") || "anonymous";
  const now = Date.now();
  const previous = attempts.get(key);
  const entry = !previous || now - previous.start > windowMs
    ? { start: now, count: 1 }
    : { start: previous.start, count: previous.count + 1 };
  attempts.set(key, entry);
  if (attempts.size > 5000) {
    for (const [id, state] of attempts) {
      if (now - state.start > windowMs) attempts.delete(id);
    }
  }
  if (entry.count > 10) {
    return NextResponse.json({ error: "Audit limit reached. Please try again later." }, { status: 429 });
  }
  try {
    const data: unknown = await request.json();
    const url = typeof data === "object" && data !== null && "url" in data ? (data as { url: unknown }).url : null;
    if (typeof url !== "string" || url.length > 2048) {
      return NextResponse.json({ error: "Enter a valid HTTPS website URL." }, { status: 400 });
    }
    const page = await fetchPublicHtml(url);
    return NextResponse.json(analyseHtml(page.url, page.html, page.robots), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect the website.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
