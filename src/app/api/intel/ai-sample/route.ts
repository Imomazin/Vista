import { NextResponse } from "next/server";
import { authenticated, CloudError, membership, organisationId, readJson, requireSameOrigin } from "@/lib/cloud";
import { requireProviderOwner } from "@/lib/external-integrations";
import { requestLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Block = { type?: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] };

/**
 * One authorised AI search observation for a project prompt. API answers are labelled as
 * API-generated and are not equivalent to consumer AI search products.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const limit = await requestLimit(request, "intel-ai-sample", 60, 3600);
    if (!limit.allowed) throw new CloudError("The hourly AI sampling budget has been reached. Completed observations are kept.", 429);
    const { token, user } = await authenticated(request);
    const body = await readJson(request, 6000);
    const org = organisationId(body.organisationId);
    const role = await membership(token, user.id, org);
    requireProviderOwner(org, role, process.env.VISTA_PROVIDER_ORGANISATION_ID);
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new CloudError("No AI provider is configured. Record observations manually instead.", 503);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 12 || prompt.length > 900) throw new CloudError("Prompts must be 12–900 characters.");
    const model = process.env.OPENAI_SAMPLING_MODEL || "gpt-4.1-mini";
    if (!/^[\w.-]{2,80}$/.test(model)) throw new CloudError("Invalid model configuration.", 503);
    const webSearch = body.webSearch !== false;
    const call = (tools: boolean) => fetch("https://api.openai.com/v1/responses", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(50000), headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: prompt, max_output_tokens: 900, store: false, ...(tools ? { tools: [{ type: "web_search" }] } : {}) }) });
    let usedSearch = webSearch;
    let response = await call(webSearch);
    if (!response.ok && webSearch && response.status === 400) { usedSearch = false; response = await call(false); }
    if (response.status === 429) throw new CloudError("The AI provider rate limit or budget was reached. Retry later.", 429);
    if (!response.ok) throw new CloudError("The AI provider did not return an answer (HTTP " + response.status + ").", 502);
    const data = await response.json() as { model?: string; output?: { content?: Block[] }[] };
    const blocks = (data.output || []).flatMap(o => o.content || []);
    const text = blocks.filter(b => b.type === "output_text").map(b => String(b.text || "")).join("\n").slice(0, 16000);
    if (!text) throw new CloudError("The AI provider returned no answer text.", 502);
    const citations = blocks.flatMap(b => b.annotations || []).filter(a => a.type === "url_citation" && typeof a.url === "string").map(a => ({ url: String(a.url).slice(0, 600), title: String(a.title || "").slice(0, 200) }));
    const unique = [...new Map(citations.map(c => [c.url, c])).values()].slice(0, 30);
    return NextResponse.json({
      provider: "OpenAI",
      model: data.model || model,
      surface: "api",
      response: text,
      citations: unique,
      collectedAt: new Date().toISOString(),
      methodology: "Single OpenAI Responses API call" + (usedSearch ? " with the web_search tool" : " without web search (model knowledge only)") + "; exact prompt sent, no system instructions, store=false.",
      limitations: "API answers can differ from ChatGPT and other consumer AI products, vary between runs and are not location-personalised. One observation is not a ranking.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CloudError ? error.status : 503;
    return NextResponse.json({ error: error instanceof CloudError ? error.message : "AI sampling is unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
