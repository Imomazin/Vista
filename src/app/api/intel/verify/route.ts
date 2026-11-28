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
    let d = await discover(body.url, [], { sitemaps: false });
    let redirectedTo: string | undefined;
    // Organisations often move to a new domain (rebrands, regional sites): follow that redirect once.
    const location = d.homeFailure?.kind === "off-site-redirect" ? d.homeFailure.chain.at(-1)?.location : undefined;
    if (location) {
      try { const next = new URL(location, d.requestedUrl); d = await discover(next.origin + "/", [], { sitemaps: false }); redirectedTo = d.home ? new URL(d.home.finalUrl).origin + "/" : undefined; } catch { /* keep the first result */ }
    }
    return { requestedUrl: d.requestedUrl, origin: d.origin, collectedAt: d.collectedAt, home: d.home, homeFailure: d.homeFailure, redirectedTo, robots: { status: d.robots.status, blocksVista: d.robots.blocksVista } };
  }, 600);
}
