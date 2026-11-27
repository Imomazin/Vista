import { CloudError } from "@/lib/cloud";
import { crawlPage, pool } from "@/lib/intel/crawl";
import { intelligenceRoute, stringList } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stage 03: fetch and analyse a bounded batch of pages (robots.txt enforced server-side). */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-pages", 400, 32768, async body => {
    const urls = stringList(body.urls, 6);
    if (!urls.length) throw new CloudError("Provide between one and six page URLs.");
    const depths = Array.isArray(body.depths) ? body.depths.map(d => (Number.isInteger(d) && d >= 0 && d < 50 ? Number(d) : 1)) : [];
    const keywords = stringList(body.keywords, 25, 80);
    const deadline = Date.now() + 40000;
    const results = await pool(urls, 3, (url, index) => crawlPage(url, depths[index] ?? 1, keywords, deadline));
    return { pages: results.flatMap(r => (r.page ? [r.page] : [])), failures: results.flatMap(r => (r.failure ? [r.failure] : [])) };
  });
}
