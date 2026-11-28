import { CloudError } from "@/lib/cloud";
import { discover } from "@/lib/intel/crawl";
import { intelligenceRoute, stringList } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stage 01–02: connectivity, robots.txt and sitemap discovery for one website. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-discover", 60, 8192, async body => {
    if (typeof body.url !== "string" || !body.url.trim() || body.url.length > 2048) throw new CloudError("Enter a website address.");
    return discover(body.url, stringList(body.keywords, 25, 80));
  }, 300);
}
