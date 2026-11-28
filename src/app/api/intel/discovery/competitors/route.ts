import { CloudError } from "@/lib/cloud";
import { aiAllowance, competitorExtraction, competitorPrompt, competitorSchema, parseJson, responses, sanitiseCandidates } from "@/lib/intel/discovery-ai";
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
    const cfg = await aiAllowance(request, "competitors", 2);
    const query = { brand, website, industry: field(body.industry, 120), offerings, segments: stringList(body.segments, 6, 80), markets: stringList(body.markets, 4, 60) };
    // Structured output suppresses web search, so research and extraction are separate calls.
    const research = await responses(cfg, { input: competitorPrompt(query), webSearch: true, maxTokens: 2500 });
    const notes = research.text.slice(0, 20000) + "\n\nCited URLs:\n" + research.citations.map(c => c.url).join("\n");
    const extraction = await responses(cfg, { instructions: competitorExtraction, input: "Research notes:\n" + notes, schema: { name: "competitors", schema: competitorSchema }, maxTokens: 2500 });
    return { candidates: sanitiseCandidates(parseJson(extraction.text), website, research.citations, notes), citations: research.citations, model: research.model, usedSearch: research.usedSearch, collectedAt: new Date().toISOString(), methodology: "OpenAI Responses API research call" + (research.usedSearch ? " with the web_search tool" : " without web search") + ", then a structured extraction limited to organisations and URLs in the research notes; candidates are verified by fetching each website before they are recommended." };
  });
}
