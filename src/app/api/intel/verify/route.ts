import { CloudError } from "@/lib/cloud";
import { discover } from "@/lib/intel/crawl";
import { intelligenceRoute } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Lightweight website verification for competitor candidates: robots.txt and the home page only (no sitemaps). */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-verify", 150, 4096, async body => {
    if (typeof body.url !== "string" || !body.url.trim() || body.url.length > 2048) throw new CloudError("Enter a website address.");
    const d = await discover(body.url, [], { sitemaps: false });
    return { requestedUrl: d.requestedUrl, origin: d.origin, collectedAt: d.collectedAt, home: d.home, homeFailure: d.homeFailure, robots: { status: d.robots.status, blocksVista: d.robots.blocksVista } };
  }, 600);
}
