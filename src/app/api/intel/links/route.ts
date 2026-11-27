import { CloudError } from "@/lib/cloud";
import { checkLinks } from "@/lib/intel/crawl";
import { intelligenceRoute, stringList } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stage 04: response status of link destinations that were not crawled as pages. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-links", 300, 65536, async body => {
    const urls = stringList(body.urls, 25);
    if (!urls.length) throw new CloudError("Provide between one and twenty-five link URLs.");
    return { links: await checkLinks(urls) };
  });
}
