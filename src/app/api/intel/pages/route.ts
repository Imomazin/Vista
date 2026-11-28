import { CloudError } from "@/lib/cloud";
import { crawlPage, loadRobots, pool } from "@/lib/intel/crawl";
import { crawlerUserAgent } from "@/lib/intel/http";
import { groupFor } from "@/lib/intel/robots";
import { intelligenceRoute, stringList } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stage 03: fetch and analyse a bounded batch of pages. robots.txt (including crawl-delay) is
 * enforced server-side; URLs that cannot be processed politely within this request are returned
 * as deferred so the checkpointed client queue retries them later.
 */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-pages", 600, 32768, async body => {
    const urls = stringList(body.urls, 6);
    if (!urls.length) throw new CloudError("Provide between one and six page URLs.");
    const depths = Array.isArray(body.depths) ? body.depths.map(d => (Number.isInteger(d) && d >= 0 && d < 50 ? Number(d) : 1)) : [];
    const keywords = stringList(body.keywords, 25, 80);
    const render = new Set(stringList(body.render, 2));
    const deadline = Date.now() + 45000;
    let origin = "";
    try { origin = new URL(urls[0]).origin; } catch { /* validated per page */ }
    const robots = origin ? await loadRobots(origin).catch(() => null) : null;
    const delay = Math.min(5, robots ? groupFor(robots.policy, crawlerUserAgent)?.crawlDelay ?? 0 : 0);
    if (delay > 0) {
      const results: Awaited<ReturnType<typeof crawlPage>>[] = [];
      const deferred: string[] = [];
      for (const [i, url] of urls.entries()) {
        if (Date.now() + delay * 1000 + 15000 > deadline) { deferred.push(url); continue; }
        if (i) await new Promise(r => setTimeout(r, delay * 1000));
        results.push(await crawlPage(url, depths[i] ?? 1, keywords, deadline, { render: render.has(url) }));
      }
      return { pages: results.flatMap(r => (r.page ? [r.page] : [])), failures: results.flatMap(r => (r.failure ? [r.failure] : [])), deferred, crawlDelay: delay };
    }
    const results = await pool(urls, 3, (url, index) => crawlPage(url, depths[index] ?? 1, keywords, deadline, { render: render.has(url) }));
    return { pages: results.flatMap(r => (r.page ? [r.page] : [])), failures: results.flatMap(r => (r.failure ? [r.failure] : [])), deferred: [] };
  }, 3000);
}
