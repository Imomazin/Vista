import { CloudError } from "@/lib/cloud";
import { aiAllowance, competitorPrompt, competitorSchema, parseJson, responses, sanitiseCandidates } from "@/lib/intel/discovery-ai";
import { normaliseWebsite } from "@/lib/intel/discovery-competitors";
import { intelligenceRoute, stringList } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const field = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");

/** Commercial competitor candidates from AI web search; the browser then verifies each website. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "discovery-competitors", 20, 8_000, async body => {
    const website = normaliseWebsite(field(body.website, 300));
    const brand = field(body.brand, 80);
    const offerings = stringList(body.offerings, 8, 100).map(o => o.replace(/[\r\n]+/g, " "));
    if (!website || !brand || !offerings.length) throw new CloudError("Website, brand and at least one offering are required.");
    const cfg = await aiAllowance(request, "competitors");
    const query = { brand, website, industry: field(body.industry, 120), offerings, segments: stringList(body.segments, 6, 80), markets: stringList(body.markets, 4, 60) };
    const result = await responses(cfg, { input: competitorPrompt(query), schema: { name: "competitors", schema: competitorSchema }, webSearch: true, maxTokens: 3500 });
    return { candidates: sanitiseCandidates(parseJson(result.text), website, result.citations), citations: result.citations, model: result.model, usedSearch: result.usedSearch, collectedAt: new Date().toISOString(), methodology: "One OpenAI Responses API call" + (result.usedSearch ? " with the web_search tool" : " without web search") + "; candidates are verified by fetching each website before they are recommended." };
  });
}
