/** Generative engine (AI search) visibility: prompt banks, observation parsing and transparent metrics. */
import type { AiObservation, Brief, PromptCategory } from "./model";

export const promptCategories: { id: PromptCategory; label: string; recommendation: boolean }[] = [
  { id: "branded", label: "Brand awareness", recommendation: false },
  { id: "discovery", label: "Unbranded discovery", recommendation: true },
  { id: "product", label: "Product recommendations", recommendation: true },
  { id: "service", label: "Service recommendations", recommendation: true },
  { id: "comparison", label: "Provider comparisons", recommendation: true },
  { id: "local", label: "Geographic searches", recommendation: true },
  { id: "problem", label: "Customer problems", recommendation: false },
  { id: "purchase", label: "Commercial purchase decisions", recommendation: true },
  { id: "expertise", label: "Industry expertise", recommendation: false },
  { id: "trust", label: "Trust and authority", recommendation: true },
  { id: "trends", label: "Emerging industry trends", recommendation: false },
];

export type BankPrompt = { prompt: string; category: PromptCategory; market: string };

/** Build a configurable prompt bank from the brief. Users can edit, remove or add prompts. */
export function promptBank(brief: Brief, crawled: { website: string; name: string }[] = []): BankPrompt[] {
  // An approved bank from Intelligent Discovery is used as-is, in priority order, plus any manual prompts.
  if (brief.promptBank?.length) {
    const approved = [...brief.promptBank].sort((a, b) => b.priority - a.priority).map(p => ({ prompt: p.prompt, category: p.category, market: p.market }));
    for (const prompt of brief.prompts) if (!approved.some(a => a.prompt === prompt)) approved.push({ prompt, category: guessCategory(prompt, brief.brand), market: brief.markets[0] || "" });
    return approved;
  }
  const brand = brief.brand || hostLabel(brief.website);
  const industry = brief.industry || "this industry";
  const markets = brief.markets.length ? brief.markets : [""];
  const offerings = brief.offerings.length ? brief.offerings : [industry];
  const competitors = competitorNames(brief, crawled).map(c => c.name).filter(usableLabel);
  const audience = brief.audience || "organisations";
  const bank: BankPrompt[] = [];
  const add = (category: PromptCategory, prompt: string, market = markets[0]) => { if (!bank.some(b => b.prompt === prompt)) bank.push({ prompt: prompt.replace(/\s+/g, " ").trim(), category, market }); };
  add("branded", "What is " + brand + " and what do they offer?");
  add("branded", "Is " + brand + " a reputable " + industry + " provider? What do customers say?");
  for (const market of markets.slice(0, 3)) {
    const where = market ? " in " + market : "";
    add("discovery", "Who are the leading " + industry + " providers" + where + "?", market);
    add("local", "Which " + industry + " companies would you recommend" + where + " for " + audience + "?", market);
  }
  for (const offering of offerings.slice(0, 4)) {
    const where = markets[0] ? " in " + markets[0] : "";
    add("product", "What are the best " + offering + " options" + where + " for " + audience + "?");
    add("service", "Which companies provide the best " + offering + where + "?");
    add("purchase", "I need " + offering + " for my organisation. Which provider should I choose and why?");
    add("problem", "How can " + audience + " choose the right " + offering + "?");
  }
  if (competitors.length) add("comparison", "Compare " + [brand, ...competitors.slice(0, 3)].join(", ") + " for " + offerings[0] + ".");
  for (const c of competitors.slice(0, 3)) add("comparison", "What are good alternatives to " + c + " for " + offerings[0] + "?");
  add("expertise", "What are the latest trends and best practices in " + industry + "?");
  add("expertise", "Which experts or organisations are authorities on " + offerings[0] + "?");
  for (const prompt of brief.prompts) add(guessCategory(prompt, brand), prompt);
  return bank;
}

function guessCategory(prompt: string, brand: string): PromptCategory {
  const p = prompt.toLowerCase();
  if (brand && p.includes(brand.toLowerCase())) return "branded";
  if (/\bvs\b|versus|compare|alternative/.test(p)) return "comparison";
  if (/near me|in [A-Z]|local|city/.test(prompt)) return "local";
  if (/buy|price|cost|hire|which .* should/.test(p)) return "purchase";
  if (/how (do|can|to)|why|problem|fix/.test(p)) return "problem";
  if (/best|top|recommend/.test(p)) return "discovery";
  return "expertise";
}

export function hostLabel(website: string): string {
  try { const host = new URL(/^https?:/.test(website) ? website : "https://" + website).hostname.replace(/^www\./, ""); const label = host.split(".")[0]; return label.charAt(0).toUpperCase() + label.slice(1); } catch { return website; }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function mentions(text: string, names: string[]): boolean {
  return names.filter(n => n && n.trim().length >= 2).some(n => new RegExp("(^|[^\\p{L}\\p{N}])" + escape(n.trim()) + "($|[^\\p{L}\\p{N}])", "iu").test(text));
}

/** Position of the brand within the first enumerated recommendation list, if one exists. */
export function recommendationPosition(text: string, names: string[]): number | null {
  const items = text.split(/\n/).map(l => l.trim()).filter(l => /^(\d+[.)]|[-*•])\s+/.test(l));
  if (items.length < 2) return null;
  const index = items.findIndex(item => mentions(item, names));
  return index >= 0 ? index + 1 : null;
}

export type CompetitorName = { site: string; name: string };
/** Competitor names from crawled brand evidence when available, otherwise the domain label. */
export function competitorNames(brief: Brief, crawled: { website: string; name: string }[] = []): CompetitorName[] {
  return brief.competitors.map(site => ({ site, name: crawled.find(c => c.website === site)?.name || hostLabel(site) }));
}
const usableLabel = (label: string) => !/^\d+$/.test(label) && label.length >= 3;

export function analyseResponse(response: string, brief: Brief, citations: { url: string; title: string }[], competitors: CompetitorName[] = competitorNames(brief)) {
  const names = [brief.brand, ...brief.aliases, hostLabel(brief.website)].filter(n => n && usableLabel(n));
  return {
    brandMentioned: mentions(response, names) || citations.some(c => sameSite(c.url, brief.website)),
    competitorMentions: competitors.filter(c => mentions(response, [c.name, hostLabel(c.site)].filter(usableLabel)) || citations.some(x => sameSite(x.url, c.site))).map(c => c.name),
    position: recommendationPosition(response, names),
  };
}

export function sameSite(url: string, website: string): boolean {
  try { const a = new URL(url).hostname.replace(/^www\./, ""); const b = new URL(/^https?:/.test(website) ? website : "https://" + website).hostname.replace(/^www\./, ""); return a === b || a.endsWith("." + b); } catch { return false; }
}

export type Rate = { value: number; numerator: number; n: number; low: number; high: number };
/** Wilson score 95% interval: honest uncertainty for small samples. */
export function rate(numerator: number, n: number): Rate {
  if (!n) return { value: 0, numerator, n, low: 0, high: 0 };
  const z = 1.96, p = numerator / n;
  const centre = (p + z * z / (2 * n)) / (1 + z * z / n);
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n);
  return { value: p, numerator, n, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export function geoMetrics(observations: AiObservation[], brief: Brief) {
  const n = observations.length;
  const recommendationCats = new Set(promptCategories.filter(c => c.recommendation).map(c => c.id));
  const reco = observations.filter(o => recommendationCats.has(o.category));
  const brandMentions = observations.filter(o => o.brandMentioned).length;
  const competitorMentions = observations.reduce((s, o) => s + o.competitorMentions.length, 0);
  const cited = observations.filter(o => o.citations.some(c => sameSite(c.url, brief.website))).length;
  const domains = new Map<string, number>();
  for (const o of observations) for (const c of o.citations) { try { const h = new URL(c.url).hostname.replace(/^www\./, ""); domains.set(h, (domains.get(h) || 0) + 1); } catch { /* skip */ } }
  const reviewed = observations.filter(o => o.inaccurate !== null);
  const byCategory = promptCategories.map(c => {
    const items = observations.filter(o => o.category === c.id);
    return { category: c.id, label: c.label, n: items.length, mention: rate(items.filter(o => o.brandMentioned).length, items.length), competitors: items.reduce((s, o) => s + o.competitorMentions.length, 0) };
  });
  const byProvider = [...new Set(observations.map(o => o.provider + " · " + o.model))].map(key => { const items = observations.filter(o => o.provider + " · " + o.model === key); return { key, n: items.length, mention: rate(items.filter(o => o.brandMentioned).length, items.length), surface: items[0].surface }; });
  const competitorShare = [...new Set(observations.flatMap(o => o.competitorMentions))].map(name => ({ name, mentions: observations.filter(o => o.competitorMentions.includes(name)).length }));
  const weeks = new Map<string, AiObservation[]>();
  for (const o of observations) { const d = new Date(o.collectedAt); const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); const key = monday.toISOString().slice(0, 10); weeks.set(key, [...(weeks.get(key) || []), o]); }
  return {
    n,
    apiShare: n ? observations.filter(o => o.surface === "api").length / n : 0,
    latest: observations.map(o => o.collectedAt).sort().at(-1) || null,
    mentionRate: rate(brandMentions, n),
    citationRate: rate(cited, n),
    recommendationRate: rate(reco.filter(o => o.brandMentioned).length, reco.length),
    competitiveShare: rate(brandMentions, brandMentions + competitorMentions),
    categoryCoverage: { covered: byCategory.filter(c => c.n > 0).length, total: promptCategories.length, value: byCategory.filter(c => c.n > 0).length / promptCategories.length },
    sourceDiversity: { domains: domains.size, top: [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) },
    accuracy: rate(reviewed.filter(o => o.inaccurate === false).length, reviewed.length),
    byCategory, byProvider, competitorShare,
    trend: [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, items]) => ({ week, n: items.length, mention: rate(items.filter(o => o.brandMentioned).length, items.length) })),
  };
}

const interventionFor: Record<PromptCategory, string> = {
  branded: "Correct and enrich brand facts on owned pages, Organization schema and authoritative profiles.",
  discovery: "Publish authoritative category pages and earn inclusion in independent industry lists and directories.",
  product: "Create product pages with specifications, comparisons, pricing context, reviews and Product schema.",
  service: "Strengthen service pages with outcomes, case studies, credentials and Service schema.",
  comparison: "Publish fair, evidence-based comparison and alternatives pages.",
  local: "Build location pages, consistent NAP data and local citations; manage review profiles.",
  problem: "Answer the problem directly in guides with steps, data and expert attribution.",
  purchase: "Publish buyer guides with selection criteria, pricing transparency and proof points.",
  expertise: "Publish original research and expert commentary; earn citations from industry publications.",
  trust: "Publish verifiable credentials, accreditations, reviews and named experts; keep third-party profiles consistent.",
  trends: "Publish timely, data-led commentary on emerging developments so AI answers can cite you as a current source.",
};

/** Prompts where competitors are mentioned and the client is not, with the corresponding intervention. */
export function opportunityMap(observations: AiObservation[]) {
  return observations
    .filter(o => !o.brandMentioned && o.competitorMentions.length)
    .map(o => ({ prompt: o.prompt, category: o.category, competitors: o.competitorMentions, provider: o.provider + " · " + o.model, collectedAt: o.collectedAt, intervention: interventionFor[o.category], citedSources: o.citations.map(c => c.url).slice(0, 5) }));
}
