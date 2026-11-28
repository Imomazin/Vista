import { CloudError } from "@/lib/cloud";
import { requestLimit } from "@/lib/rate-limit";
import { intelligenceRoute, isMember, stringList } from "@/lib/intel/route-kit";
import { keywordMetrics, searchConfig, serpResults, usage } from "@/lib/intel/search-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Search volume, difficulty and live results from a configured provider; never estimated. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "discovery-search", 20, 12_000, async body => {
    const cfg = searchConfig();
    if (!cfg.provider) return { configured: false, provider: null, metrics: [], serp: [], note: "No search data provider is configured. Add DataForSEO (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD) for search volume, difficulty, CPC and rankings, or a Brave Search API key (BRAVE_SEARCH_API_KEY) for live results." };
    const member = await isMember(request);
    const daily = await requestLimit(request, "discovery-search" + (member ? "-member" : ""), member ? 60 : 8, 86400);
    if (!daily.allowed) throw new CloudError("The daily search data allowance for this connection has been used.", 429);
    const market = typeof body.market === "string" ? body.market.slice(0, 60) : "";
    const keywords = stringList(body.keywords, 100, 80);
    const serpKeywords = stringList(body.serpKeywords, 6, 80);
    const before = usage.dataforseoUsd;
    const metrics = cfg.metrics ? await keywordMetrics(keywords, market) : [];
    const serp = await serpResults(serpKeywords, market);
    const costUsd = Math.round((usage.dataforseoUsd - before) * 10000) / 10000;
    console.info(JSON.stringify({ event: "vista.provider-usage", provider: cfg.provider, keywords: keywords.length, serpKeywords: serpKeywords.length, costUsd }));
    return { configured: true, provider: cfg.provider, metrics, serp, costUsd, collectedAt: new Date().toISOString(), note: cfg.metrics ? "" : cfg.provider + " provides live results only; search volume and difficulty need DataForSEO." };
  });
}
