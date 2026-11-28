import { CloudError } from "@/lib/cloud";
import { aiAllowance, responses } from "@/lib/intel/discovery-ai";
import { promptTemplates, renderTemplate } from "@/lib/intel/discovery-keywords";
import { intelligenceRoute } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One sampled AI answer for a discovery prompt. The prompt is rendered here from a fixed template. */
export async function POST(request: Request) {
  return intelligenceRoute(request, "discovery-geo", 60, 4_000, async body => {
    const id = typeof body.template === "string" ? body.template : "";
    const slots = body.slots && typeof body.slots === "object" && !Array.isArray(body.slots) ? Object.fromEntries(Object.entries(body.slots as Record<string, unknown>).filter(([, v]) => typeof v === "string").slice(0, 16)) as Record<string, string> : {};
    const template = promptTemplates[id];
    const prompt = template?.sample ? renderTemplate(id, slots) : null;
    if (!prompt) throw new CloudError("Only VisTa discovery prompt templates can be sampled.");
    const cfg = await aiAllowance(request, "geo");
    const result = await responses(cfg, { input: prompt, webSearch: true, maxTokens: 900 });
    return { prompt, category: template.category, provider: "OpenAI", model: result.model, surface: "api", response: result.text.slice(0, 16000), citations: result.citations, collectedAt: new Date().toISOString(),
      methodology: "Single OpenAI Responses API call" + (result.usedSearch ? " with the web_search tool" : " without web search") + "; exact prompt sent, no system instructions, store=false.",
      limitations: "API answers can differ from ChatGPT and other consumer AI products, vary between runs and are not location-personalised. A small sample indicates presence, not a ranking." };
  });
}
