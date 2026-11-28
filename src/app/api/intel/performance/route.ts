import { CloudError } from "@/lib/cloud";
import { validatePublicUrl } from "@/lib/intel/http";
import { runPageSpeed } from "@/lib/intel/psi";
import { intelligenceRoute } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lighthouse tests of large pages (several MB of HTML) regularly need more than a minute.
export const maxDuration = 120;

/** Stage 04: Lighthouse lab and Chrome UX Report field data through PageSpeed Insights. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-performance", 40, 4096, async body => {
    if (typeof body.url !== "string") throw new CloudError("Provide a page URL.");
    const url = validatePublicUrl(body.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new CloudError("Provide a public page URL.");
    const strategy = body.strategy === "desktop" ? "desktop" : "mobile";
    try { return await runPageSpeed(url.href, strategy); }
    catch (error) { throw new CloudError(error instanceof Error ? error.message : "PageSpeed Insights is unavailable.", 502); }
  });
}
