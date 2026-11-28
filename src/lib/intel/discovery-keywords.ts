/**
 * Keyword universe and GEO prompt bank built from discovered evidence. Keyword phrases come from
 * the site's own offerings, structured data, headings and navigation, competitor pages and (when
 * connected) Search Console. Search volume, difficulty, CPC and rankings are attached only from
 * Search Console or a configured search data provider — never estimated.
 */
import type { PageRecord } from "./page";
import type { PromptCategory } from "./model";
import { pageCorpus, stop, tokens, type AiProfile } from "./discovery-profile";
import { marketPhrase, recId, type Basis, type BusinessProfile, type CompetitorRec, type EvidenceRef, type KeywordGroup, type KeywordIntent, type KeywordMetrics, type KeywordRec, type PromptRec } from "./discovery-model";

const genericPhrase = /^(home|about( us)?|contact( us)?|blog|news|faqs?|login|sign in|register|cart|basket|search|menu|privacy( policy)?|terms( and conditions)?|cookies?( policy)?|careers|our team|team|gallery|events|testimonials|reviews|resources|more|read more|view all|learn more|get started|welcome|apply now|enrol now|book now|shop now|sitemap|accessibility|support|help|my account|account|alumni|partners)$/;
const transactional = /\b(buy|price|prices|pricing|cost|costs|fees?|book|booking|apply|enrol|enroll|enrolment|order|hire|quote|shop|sale|discount|register|near me|cheap|deals?)\b/;
const commercialWords = /\b(best|top|vs|versus|reviews?|compare|comparison|alternatives?|courses?|training|services?|providers?|company|companies|agency|agencies|consultants?|firms?|software|platform|tools?|suppliers?)\b/;
const informational = /^(what|how|why|when|where|which|who|can|does|do|is|are|should|guide|tips)\b|\b(guide|meaning|definition|requirements|salary|examples?|tips|ideas|benefits)\b/;
const shortMarket: Record<string, string> = { "United Kingdom": "uk", "United States": "usa", "United Arab Emirates": "uae" };

function normalise(raw: string, brandTokens: Set<string>, keepBrand = false): string | null {
  let words = raw.toLowerCase().normalize("NFKD").replace(/[’']/g, "").replace(/[^\p{L}\p{N}\s&+-]/gu, " ").replace(/\s+/g, " ").trim().split(" ");
  if (!keepBrand) words = words.filter(w => !brandTokens.has(w));
  const question = /^(what|how|why|when|where|which|who|can|does|do|is|are|should)$/.test(words[0] || "") && words.length >= 3;
  while (!question && words.length && stop.has(words[0])) words.shift();
  while (words.length && stop.has(words[words.length - 1])) words.pop();
  // "clinical laboratory course 12" → "clinical laboratory course": numbered variants are one search topic.
  if (words.length >= 3 && /^\d{1,3}$/.test(words[words.length - 1])) words.pop();
  const phrase = words.join(" ").replace(/\s*-\s*/g, " ").trim();
  if (phrase.length < 3 || words.length > 7 || genericPhrase.test(phrase) || !tokens(phrase).length || /^\d+( \d+)*$/.test(phrase)) return null;
  return phrase;
}

export type KeywordInput = { profile: BusinessProfile; pages: PageRecord[]; competitorHomes: PageRecord[]; competitors: CompetitorRec[]; website: string; gsc?: { query: string; clicks: number; impressions: number; position: number }[]; gscCollectedAt?: string };

export function keywordUniverse(input: KeywordInput): KeywordRec[] {
  const { profile, pages } = input;
  const brandNames = [profile.brand.value, ...profile.aliases.filter(a => a.selected).map(a => a.value)].map(s => s.toLowerCase());
  const brandTokens = new Set(brandNames.flatMap(n => tokens(n)).filter(t => t.length > 2 && !/^(com|co|uk|org|net|www)$/.test(t)));
  const isBranded = (k: string) => brandNames.some(b => b.length > 2 && k.includes(b)) || tokens(k).some(t => brandTokens.has(t));
  const markets = profile.markets.filter(m => m.selected).map(m => m.value);
  const marketTerms = markets.map(m => shortMarket[m] || m.toLowerCase());
  const cityTerms = [...new Set(pages.flatMap(p => (p.business?.places || []).filter(x => x.kind === "city" && x.count >= 2).map(x => x.name.toLowerCase())))].slice(0, 3);
  const corpus = pages.map(pageCorpus).join(" \n ");
  const map = new Map<string, { sources: Set<string>; evidence: EvidenceRef[]; weight: number; cluster: string; basis: Basis; metrics: KeywordMetrics | null; emerging: boolean }>();
  const add = (raw: string, source: string, weight: number, ev: EvidenceRef | null, basis: Basis, cluster?: string, opts: { keepBrand?: boolean; emerging?: boolean; metrics?: KeywordMetrics } = {}) => {
    const k = normalise(raw, brandTokens, opts.keepBrand);
    if (!k) return null;
    const e = map.get(k) || { sources: new Set<string>(), evidence: [], weight: 0, cluster: cluster || headTerm(k), basis, metrics: null, emerging: false };
    e.sources.add(source); e.weight = Math.max(e.weight, weight) + (e.sources.size > 1 ? 4 : 0);
    if (ev && e.evidence.length < 5 && !e.evidence.some(x => x.url === ev.url)) e.evidence.push(ev);
    if (opts.metrics) { e.metrics = opts.metrics; e.basis = "first-party"; }
    if (opts.emerging) e.emerging = true;
    if (basis === "observed" && e.basis === "model") e.basis = "observed";
    map.set(k, e);
    return k;
  };

  // Category noun used to qualify single-word offerings ("histology" → "histology training").
  const heads = new Map<string, number>();
  for (const o of profile.offerings) for (const t of tokens(o.value).slice(-1)) if (/^(training|course|courses|services?|consulting|software|products?|treatment|therapy|insurance|tours?|classes|programme|program)$/.test(t)) heads.set(t, (heads.get(t) || 0) + 1);
  const categoryNoun = [...heads.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  for (const o of profile.offerings.filter(o => o.selected)) {
    const k = add(o.value, "Offering: " + o.value, 42, o.evidence[0] || null, o.basis === "model" ? "model" : "observed");
    if (k && tokens(k).length === 1 && categoryNoun && !k.startsWith(categoryNoun.replace(/s$/, ""))) add(k + " " + categoryNoun, "Offering: " + o.value, 40, o.evidence[0] || null, "inferred", k);
  }
  for (const p of pages) {
    for (const e of p.business?.entities || []) if (!/Offer|HowTo|JobPosting/.test(e.type)) add(e.name, e.type + " structured data", 32, { url: p.finalUrl, detail: e.type + " “" + e.name + "”" }, "observed");
    if (["service", "course", "product", "category", "pricing"].includes(p.pageType)) {
      if (p.h1[0]) add(p.h1[0], "H1 of " + p.pageType + " page", 28, { url: p.finalUrl, detail: "H1" }, "observed");
      for (const h of p.headings.filter(h => h.level === 2).slice(0, 6)) add(h.text, "H2 on " + p.pageType + " page", 14, { url: p.finalUrl, detail: "H2 “" + h.text.slice(0, 60) + "”" }, "observed");
    }
    for (const h of p.headings.filter(h => /\?$/.test(h.text)).slice(0, 6)) add(h.text.replace(/\?$/, ""), "Question heading", 16, { url: p.finalUrl, detail: "Question heading on the page" }, "observed");
  }
  for (const t of profile.industryTerms.slice(0, 20)) add(t, "Industry terminology (AI-suggested)", 10, null, "model");

  // Competitor vocabulary absent from the client's pages: emerging content opportunities (measured gap).
  const selectedCompetitors = new Set(input.competitors.filter(c => c.selected).map(c => c.website));
  const compPhrases = new Map<string, Set<string>>();
  for (const home of input.competitorHomes.filter(h => [...selectedCompetitors].some(w => h.finalUrl.startsWith(w) || w.startsWith(new URL(h.finalUrl).origin)))) {
    for (const raw of [...home.h1, ...home.headings.filter(h => h.level <= 3).map(h => h.text), ...(home.business?.entities.map(e => e.name) || [])]) {
      const k = normalise(raw, new Set([...brandTokens, ...tokens(home.business?.names[0]?.value || "")]));
      if (!k || tokens(k).length < 2 || tokens(k).length > 5) continue;
      const set = compPhrases.get(k) || new Set<string>(); set.add(home.finalUrl); compPhrases.set(k, set);
    }
  }
  const vocab = new Set(profile.offerings.filter(o => o.selected).flatMap(o => tokens(o.value)));
  for (const [k, sites] of compPhrases) {
    const toks = tokens(k);
    if (!toks.some(t => vocab.has(t))) continue;
    if (corpus.includes(k)) continue;
    add(k, "Competitor page" + (sites.size > 1 ? "s (" + sites.size + ")" : ""), 12 + sites.size * 4, { url: [...sites][0], detail: "Used by " + sites.size + " competitor" + (sites.size > 1 ? "s" : "") + "; absent from the sampled client pages" }, "measured", undefined, { emerging: true });
  }
  for (const row of (input.gsc || []).slice(0, 200)) add(row.query, "Search Console query", 50, null, "first-party", undefined, { keepBrand: true, metrics: { clicks: row.clicks, impressions: row.impressions, position: Math.round(row.position * 10) / 10, source: "Google Search Console (authorised)", collectedAt: input.gscCollectedAt || "" } });

  // Expansions of the strongest non-branded seeds.
  const seeds = [...map.entries()].filter(([k, v]) => !isBranded(k) && !v.emerging && v.weight >= 28 && tokens(k).length <= 4).sort((a, b) => b[1].weight - a[1].weight).slice(0, 8).map(([k]) => k);
  const model = profile.model.value;
  const costWord = /Course/.test(model) ? "fees" : /ecommerce/.test(model) ? "price" : "cost";
  const online = (corpus.match(/\bonline\b/g) || []).length >= 3;
  const local = pages.some(p => p.schema.types.some(t => /LocalBusiness|Store|Restaurant|MedicalClinic/.test(t)) && p.trust.address);
  for (const seed of seeds) {
    const s = seed;
    const base = "Expansion of “" + seed + "”";
    if (marketTerms[0]) add(s + " " + marketTerms[0], base + " with market", 30, null, "inferred", seed);
    add("best " + s + (marketTerms[0] ? " " + marketTerms[0] : ""), base + " (commercial investigation)", 26, null, "inferred", seed);
    add(s + " " + costWord, base + " (transactional)", 24, null, "inferred", seed);
    if (online && !/online/.test(s)) add(s + " online", base + " (online delivery stated on the site)", 22, null, "inferred", seed);
    if (local) add(s + " near me", base + " (local business signals)", 22, null, "inferred", seed);
    for (const city of cityTerms.slice(0, 2)) add(s + " " + city, base + " (city mentioned on the site)", 20, null, "inferred", seed);
    if (tokens(s).length <= 2) add("what is " + s.replace(/ (training|course|courses|services?)$/, ""), base + " (informational)", 14, null, "inferred", seed);
  }
  for (const seg of profile.segments.filter(s => s.selected).slice(0, 3)) {
    const role = seg.value.toLowerCase().replace(/s$/, "");
    if (/Course/.test(model) && /scientist|technician|nurse|practitioner|engineer|analyst|developer|accountant|teacher/.test(role)) add("how to become a " + role + (marketTerms[0] ? " in the " + marketTerms[0] : ""), "Audience “" + seg.value + "” (career question)", 18, seg.evidence[0] || null, "inferred");
  }
  const brand = profile.brand.value.toLowerCase();
  add(brand, "Brand name", 30, profile.brand.evidence[0] || null, "observed", brand, { keepBrand: true });
  add(brand + " reviews", "Brand reputation search", 22, null, "inferred", brand, { keepBrand: true });
  for (const o of profile.offerings.filter(o => o.selected).slice(0, 2)) add(brand + " " + o.value, "Brand + offering", 20, o.evidence[0] || null, "inferred", brand, { keepBrand: true });
  for (const c of input.competitors.filter(c => c.selected).slice(0, 3)) add(brand + " vs " + c.name, "Brand comparison with " + c.name, 18, { url: c.website, detail: "Recommended competitor" }, "inferred", brand, { keepBrand: true });

  const ranked = [...map.entries()].map(([keyword, v]) => {
    const groups: KeywordGroup[] = [];
    const branded = isBranded(keyword);
    groups.push(branded ? "branded" : "non-branded");
    const intent: KeywordIntent = branded && tokens(keyword).length <= tokens(brand).length + 1 && !/reviews|vs/.test(keyword) ? "navigational" : informational.test(keyword) ? "informational" : transactional.test(keyword) ? "transactional" : commercialWords.test(keyword) ? "commercial" : "commercial";
    if (intent === "transactional") groups.push("transactional");
    if (intent === "informational") groups.push("informational");
    if (intent === "commercial") groups.push("commercial");
    if ([...marketTerms, ...cityTerms].some(m => keyword.includes(m)) || /near me/.test(keyword)) groups.push("local");
    if (tokens(keyword).length >= 4) groups.push("long-tail");
    if (v.emerging) groups.push("emerging");
    const priority = Math.min(100, Math.round(v.weight + (intent === "transactional" ? 18 : intent === "commercial" ? 14 : intent === "informational" ? 6 : 2) + Math.min(10, v.evidence.length * 3) + (v.metrics?.impressions ? Math.min(20, Math.log10(v.metrics.impressions + 1) * 6) : 0)));
    return { id: recId("kw", keyword), keyword, groups, intent, cluster: v.cluster, priority, sources: [...v.sources].slice(0, 4), evidence: v.evidence, basis: v.basis, metrics: v.metrics, selected: false } as KeywordRec;
  }).sort((a, b) => b.priority - a.priority).slice(0, 160);
  let primary = 0, secondary = 0;
  for (const k of ranked) {
    if (k.groups.includes("branded") || k.groups.includes("emerging") || k.intent === "informational") continue;
    if (primary < 8) { k.groups.unshift("primary"); primary += 1; }
    else if (secondary < 20) { k.groups.unshift("secondary"); secondary += 1; }
  }
  for (const k of ranked) k.selected = k.groups.includes("primary") || k.groups.includes("secondary") || (k.groups.includes("branded") && k.intent === "navigational");
  return ranked;
}

function headTerm(k: string): string {
  const t = tokens(k).filter(x => !/^(best|top|online|uk|cost|price|fees|near|course|courses|training|services?|what|how)$/.test(x));
  return t.slice(0, 2).join(" ") || k;
}

const categoryWeight: Record<PromptCategory, number> = { purchase: 95, service: 90, product: 90, comparison: 86, discovery: 85, local: 80, trust: 72, problem: 66, branded: 60, expertise: 50, trends: 42 };

/** Prompt templates shared by the browser and the sampling endpoint (which renders prompts itself from validated slots). */
export const promptTemplates: Record<string, { category: PromptCategory; text: string; rationale: string; sample: boolean }> = {
  "branded-what": { category: "branded", text: "What is {brand} and what does it offer?", rationale: "Checks whether AI systems describe the brand and its offer correctly.", sample: false },
  "branded-reputable": { category: "branded", text: "Is {brand} a reputable {provider}?", rationale: "Brand reputation question asked before purchase.", sample: false },
  "branded-say": { category: "branded", text: "What do people say about {brand}'s {offering}?", rationale: "Brand sentiment for the primary offering.", sample: false },
  "discovery-leading": { category: "discovery", text: "Who are the leading {sector} {provider}s{where}?", rationale: "Unbranded category discovery in the core market.", sample: true },
  "discovery-get": { category: "discovery", text: "Where can I get {offering}{where}?", rationale: "Unbranded discovery for the primary offering.", sample: true },
  "discovery-offer": { category: "discovery", text: "Which organisations offer {offering}{where}?", rationale: "Unbranded discovery for a secondary offering.", sample: true },
  "product-best": { category: "product", text: "What are the best {offering} options for {segment}{where}?", rationale: "Recommendation request for the primary offering and audience.", sample: true },
  "product-recommend": { category: "product", text: "Which {offering} would you recommend for {segment}?", rationale: "Recommendation request for a secondary offering.", sample: true },
  "product-available": { category: "product", text: "What is the best {offering} available{where}?", rationale: "Recommendation request for a further offering.", sample: true },
  "service-run": { category: "service", text: "Which {provider}s run {offering} for {segment}{where}?", rationale: "Provider shortlist question for the primary offering.", sample: true },
  "service-best": { category: "service", text: "Who provides the best {offering}{where}?", rationale: "Provider shortlist question for a secondary offering.", sample: true },
  "comparison-compare": { category: "comparison", text: "Compare {brand}, {competitor} and {competitor2} for {offering}.", rationale: "Direct comparison with discovered competitors.", sample: false },
  "comparison-alternatives": { category: "comparison", text: "What are good alternatives to {competitor} for {offering}?", rationale: "Alternatives question where the client should appear.", sample: true },
  "comparison-head": { category: "comparison", text: "{brand} or {competitor}: which is better for {segment}?", rationale: "Head-to-head comparison with a discovered competitor.", sample: false },
  "comparison-value": { category: "comparison", text: "Which {sector} {provider} offers the best value{where}?", rationale: "Value comparison asked late in the decision.", sample: true },
  "purchase-choose": { category: "purchase", text: "I want to {verb} {offering}{where}. Which {provider} should I choose and why?", rationale: "Purchase-stage decision for the primary offering.", sample: true },
  "purchase-cost": { category: "purchase", text: "How much does {offering} cost{where}, and which providers are worth it?", rationale: "Price-led purchase question.", sample: true },
  "purchase-criteria": { category: "purchase", text: "What should I look for when choosing a {offering} {provider}?", rationale: "Selection-criteria question that shapes shortlists.", sample: false },
  "purchase-worth": { category: "purchase", text: "Is {offering} worth it for {segment}?", rationale: "Value justification before purchase.", sample: false },
  "problem-start": { category: "problem", text: "How can {segment} get started with {offering}?", rationale: "Customer problem that leads to the offering.", sample: false },
  "problem-requirements": { category: "problem", text: "What are the requirements for {offering}{where}?", rationale: "Eligibility question asked before purchase.", sample: false },
  "problem-long": { category: "problem", text: "How long does {offering} take and what does it involve?", rationale: "Practical question asked during research.", sample: false },
  "expertise-experts": { category: "expertise", text: "Who are the recognised experts in {sector}{where}?", rationale: "Expertise and authority in the sector.", sample: false },
  "expertise-practices": { category: "expertise", text: "What are the best practices in {offering}?", rationale: "Expert guidance question where cited sources gain visibility.", sample: false },
  "expertise-guidance": { category: "expertise", text: "Which organisations publish authoritative guidance on {offering}?", rationale: "Source-authority question.", sample: false },
  "local-offer": { category: "local", text: "Which {provider}s{where} offer {offering}?", rationale: "Geographic search in the core market.", sample: true },
  "local-near": { category: "local", text: "Where can I find {offering} near {city}?", rationale: "City-level search for a location mentioned on the site.", sample: true },
  "local-serving": { category: "local", text: "Are there {offering} providers serving {market2}?", rationale: "Secondary market search.", sample: false },
  "trust-accredited": { category: "trust", text: "Which {sector} {provider}s{where} are accredited or certified?", rationale: "Trust filter many buyers apply.", sample: true },
  "trust-reviews": { category: "trust", text: "Which {offering} providers have the best reviews{where}?", rationale: "Review-led trust question.", sample: true },
  "trust-recognised": { category: "trust", text: "Which {offering} providers are recognised by {authority}?", rationale: "Trust question built on a credential the site claims.", sample: true },
  "trust-brand": { category: "trust", text: "Is {brand} accredited, and is it trustworthy?", rationale: "Brand trust verification.", sample: false },
  "trends-emerging": { category: "trends", text: "What are the emerging trends in {sector} in {year}?", rationale: "Trend question where timely content is cited.", sample: false },
  "trends-ai": { category: "trends", text: "How is AI changing {sector}?", rationale: "Technology trend question for the sector.", sample: false },
  "trends-demand": { category: "trends", text: "Which {offering} skills or services are most in demand{where}?", rationale: "Demand trend question.", sample: false },
};
export const providerNouns = ["provider", "training provider", "retailer", "platform", "agency", "company"];
export const purchaseVerbs = ["enrol on", "buy", "hire someone for", "book"];
const slotPattern = /^[\p{L}\p{N} &'’.,()\-\/+]{1,100}$/u;
/** Render a template from slots; returns null if a slot is missing or not plain text (used server-side to refuse arbitrary prompts). */
export function renderTemplate(id: string, slots: Record<string, string>): string | null {
  const t = promptTemplates[id];
  if (!t) return null;
  let ok = true;
  const text = t.text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (slots[key] ?? "").trim();
    if (key === "where") { if (v && !/^ in [\p{L}\p{N} .'’-]{2,40}$/u.test(slots[key])) ok = false; return slots[key] || ""; }
    if (key === "provider" && !providerNouns.includes(v)) ok = false;
    if (key === "verb" && !purchaseVerbs.includes(v)) ok = false;
    if (key === "year" && !/^20\d\d$/.test(v)) ok = false;
    if (!v || !slotPattern.test(v)) ok = false;
    return v;
  });
  return ok ? text.replace(/\s+/g, " ").trim() : null;
}

export function promptRecs(profile: BusinessProfile, competitors: CompetitorRec[], keywords: KeywordRec[], ai: AiProfile["prompts"] = []): PromptRec[] {
  const brand = profile.brand.value;
  const plain = (s: string) => s.replace(/[^\p{L}\p{N} &'’.,()\-\/+]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  const offerings = profile.offerings.filter(o => o.selected).map(o => plain(o.value.toLowerCase().replace(/^\d+\s+\w+\s+/, ""))).filter(Boolean).slice(0, 4);
  const o1 = offerings[0] || plain(profile.industry.value.toLowerCase()), o2 = offerings[1] || o1, o3 = offerings[2] || o2;
  const segments = profile.segments.filter(s => s.selected).map(s => plain(s.value.toLowerCase()));
  const s1 = segments[0] || "customers", s2 = segments[1] || s1;
  const markets = profile.markets.filter(m => m.selected).map(m => m.value);
  const market = markets[0] || "";
  const where = market ? " in " + marketPhrase(market) : "";
  const sector = plain((profile.subsectors.find(s => s.selected)?.value || profile.industry.value).toLowerCase());
  const provider = /training|education|learning/i.test(sector) ? "provider" : /Course|training/i.test(profile.model.value) ? "training provider" : /ecommerce|Retail/i.test(profile.model.value + " " + profile.industry.value) ? "retailer" : /software|Subscription/i.test(profile.model.value) ? "platform" : "provider";
  const comps = competitors.filter(c => c.selected).map(c => plain(c.name)).filter(Boolean).slice(0, 3);
  const city = profile.markets.flatMap(m => m.evidence.map(e => e.detail.match(/^([A-Z][\w ]+) \(/)?.[1])).find(Boolean);
  const authorityRaw = [...new Set(profile.differentiators.flatMap(d => d.value.match(/\b(NHS|ISO ?\d{4,5}|UKAS|CPD|IBMS|HCPC|Ofsted|FCA|ACCA|CIPD|RICS|Gas Safe|NMC|GMC)\b/g) || []))][0];
  const authority = authorityRaw && /^(NHS|FCA|NMC|GMC|HCPC|IBMS)$/.test(authorityRaw) ? "the " + authorityRaw : authorityRaw;
  const verb = /Course/.test(profile.model.value) ? "enrol on" : /ecommerce/.test(profile.model.value) ? "buy" : "hire someone for";
  const base = { brand: plain(brand), sector, provider, where, verb, segment: s1, year: String(new Date().getFullYear()) };
  const list: { prompt: string; category: PromptCategory; rationale: string; basis: Basis; template?: { id: string; slots: Record<string, string> } }[] = [];
  const t = (id: string, slots: Record<string, string>) => {
    const merged = { ...base, ...slots };
    const prompt = renderTemplate(id, merged);
    if (prompt) list.push({ prompt, category: promptTemplates[id].category, rationale: promptTemplates[id].rationale, basis: "inferred", template: { id, slots: merged } });
  };
  t("branded-what", {}); t("branded-reputable", {}); t("branded-say", { offering: o1 });
  t("discovery-leading", {}); t("discovery-get", { offering: o1 }); t("discovery-offer", { offering: o2 });
  t("product-best", { offering: o1 }); t("product-recommend", { offering: o2, segment: s2 }); t("product-available", { offering: o3 });
  t("service-run", { offering: o1 }); t("service-best", { offering: o2 });
  if (comps[1]) t("comparison-compare", { competitor: comps[0], competitor2: comps[1], offering: o1 });
  if (comps[0]) t("comparison-alternatives", { competitor: comps[0], offering: o1 });
  if (comps[1]) t("comparison-head", { competitor: comps[1] });
  t("comparison-value", {});
  t("purchase-choose", { offering: o1 }); t("purchase-cost", { offering: o1 }); t("purchase-criteria", { offering: o1 }); t("purchase-worth", { offering: o2 });
  t("problem-start", { offering: o1 }); t("problem-requirements", { offering: o1 }); t("problem-long", { offering: o1 });
  for (const k of keywords.filter(k => k.intent === "informational").slice(0, 3)) list.push({ prompt: k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1) + "?", category: "problem", rationale: "Question observed in the site's own content or keyword universe.", basis: k.basis });
  t("expertise-experts", {}); t("expertise-practices", { offering: o1 }); t("expertise-guidance", { offering: o2 });
  if (market) t("local-offer", { offering: o1 });
  if (city) t("local-near", { offering: o1, city });
  if (markets[1]) t("local-serving", { offering: o1, market2: marketPhrase(markets[1]) });
  t("trust-accredited", {}); t("trust-reviews", { offering: o1 });
  if (authority) t("trust-recognised", { offering: o1, authority });
  t("trust-brand", {});
  t("trends-emerging", {}); t("trends-ai", {}); t("trends-demand", { offering: o1 });
  for (const p of ai.slice(0, 30)) {
    const category = (["branded", "discovery", "product", "service", "comparison", "local", "problem", "purchase", "expertise", "trust", "trends"] as PromptCategory[]).find(c => c === p.category);
    const prompt = p.prompt.replace(/\s+/g, " ").trim();
    if (category && prompt.length >= 12 && prompt.length <= 300) list.push({ prompt, category, rationale: "AI-generated: " + p.rationale.slice(0, 160), basis: "model" });
  }
  const seen = new Set<string>();
  const out: PromptRec[] = [];
  for (const [i, p] of list.entries()) {
    const key = tokens(p.prompt).sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    const priority = Math.min(100, categoryWeight[p.category] + (p.prompt.toLowerCase().includes(o1) ? 4 : 0) - (p.basis === "model" ? 3 : 0) - Math.floor(i / 20));
    out.push({ id: recId("prompt", p.prompt), prompt: p.prompt, category: p.category, market, priority, rationale: p.rationale, basis: p.basis, selected: true, ...(p.template ? { template: p.template } : {}) });
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, 50);
}
