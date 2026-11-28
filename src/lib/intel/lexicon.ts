/**
 * VisTa Lexicon: proprietary keyword intelligence.
 *
 * Deterministic, transparent estimates computed from observed website evidence (client and
 * competitor pages) and, when connected, measured Search Console data. The opportunity score is a
 * VisTa estimate with a factor breakdown; it is never a Google search volume, ranking or difficulty.
 * Methodology: docs/proprietary-intelligence.md#3-vista-lexicon-keyword-intelligence
 */
import type { PageRecord } from "./page";
import { pageCorpus, tokens } from "./discovery-profile";
import type { BusinessProfile, CompetitorRec, KeywordRec } from "./discovery-model";

export type FactorBasis = "observed" | "estimate" | "measured" | "unavailable";
export type LexiconFactor = { id: "relevance" | "intent" | "competitors" | "gap" | "specificity" | "demand"; label: string; points: number; max: number; basis: FactorBasis; detail: string };
export type Coverage = "targeted" | "headings" | "body" | "none";
export type LexiconAction = { kind: "create" | "optimise" | "defend" | "monitor"; label: string };
export type LexiconEntry = {
  id: string; keyword: string; topic: string; score: number; factors: LexiconFactor[];
  coverage: Coverage; target: { url: string; title: string; where: string[] } | null;
  action: LexiconAction; longTail: boolean; competitorUse: { sites: string[]; of: number };
};
export type LexiconTopic = { id: string; label: string; keywords: string[]; score: number; pages: string[]; gaps: number; related: { id: string; label: string; weight: number; reason: string }[] };
export type Lexicon = {
  version: 1; computedAt: string; method: string;
  coverage: { clientPages: number; competitorPages: number; competitorSites: number; searchConsole: boolean; observedFrom: string; observedTo: string };
  entries: LexiconEntry[]; topics: LexiconTopic[]; unavailable: string[];
};
export type LexiconInput = {
  keywords: KeywordRec[]; profile: BusinessProfile; pages: PageRecord[];
  /** Pages sampled from each competitor website (home and service pages). */
  competitorPages: Record<string, PageRecord[]>; competitors: CompetitorRec[];
  at?: string;
};

export const lexiconMethod = "VisTa Lexicon v1: opportunity score = relevance (≤30, observed) + intent (≤20, estimate) + competitor use (≤15, observed) + coverage gap (≤20, observed, scaled by relevance) + specificity (≤15, estimate) + Search Console demand (≤15, measured, only when connected), capped at 100. Deterministic: the same evidence gives the same score.";

// Category nouns are synonyms for clustering and coverage ("histology course" = "histology training").
const category: Record<string, string> = {
  course: "training", courses: "training", training: "training", trainings: "training", programme: "training", programmes: "training", program: "training", programs: "training", class: "training", classes: "training", workshop: "training", workshops: "training", bootcamp: "training",
  service: "service", services: "service", solution: "service", solutions: "service",
  provider: "provider", providers: "provider", company: "provider", companies: "provider", agency: "provider", agencies: "provider", firm: "provider", firms: "provider",
};
const categoryStems = new Set(Object.values(category));
const modifiers = new Set(["best", "top", "cheap", "cheapest", "affordable", "near", "me", "online", "price", "prices", "pricing", "cost", "costs", "fee", "fees", "review", "reviews", "vs", "versus", "compare", "comparison", "what", "how", "why", "when", "where", "which", "who", "become", "get", "find", "free", "new", "latest", "uk", "usa", "uae", "us"]);
const commercialCue = /\b(best|top|vs|versus|reviews?|compare|comparison|alternatives?|courses?|training|programmes?|programs?|services?|providers?|company|companies|agency|agencies|consultants?|consultancy|firms?|software|platform|tools?|suppliers?|development|solutions?|treatment|therapy|classes|certification|certificate|diploma|accredited|hire|for sale)\b/;
const qualifier = /\b(near me|online|best|top|cheap|affordable|price|prices|pricing|cost|fees?|uk|usa|uae|london|vs|reviews?)\b/;

function stem(t: string): string {
  if (category[t]) return category[t];
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) return t.slice(0, -1);
  return t;
}
const stems = (s: string) => tokens(s).map(stem);
const slugText = (url: string) => { try { return decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, " "); } catch { return ""; } };
const shortPath = (url: string) => { try { const u = new URL(url); return u.pathname === "/" ? u.hostname.replace(/^www\./, "") + "/" : u.pathname; } catch { return url; } };

type PageSets = { url: string; title: string; depth: number; head: Set<string>; headings: Set<string>; body: Set<string> };
function pageSets(p: PageRecord): PageSets {
  const head = new Set([...stems(p.title || ""), ...p.h1.flatMap(stems), ...stems(slugText(p.finalUrl))]);
  const headings = new Set(p.headings.flatMap(h => stems(h.text)));
  const body = new Set([...head, ...headings, ...stems(pageCorpus(p))]);
  return { url: p.finalUrl, title: p.title || shortPath(p.finalUrl), depth: p.depth, head, headings, body };
}

export function buildLexicon(input: LexiconInput): Lexicon {
  const { profile } = input;
  // Markets, cities and the brand are modifiers: they qualify a topic rather than define one.
  const cities = input.pages.flatMap(p => (p.business?.places || []).filter(x => x.kind === "city").map(x => x.name));
  const marketWords = new Set([...profile.markets.filter(m => m.selected).map(m => m.value), ...cities].flatMap(v => tokens(v)));
  const brandWords = new Set(tokens(profile.brand.value).map(stem));
  const isModifier = (t: string) => modifiers.has(t) || marketWords.has(t);
  const parts = (k: string) => {
    const all = stems(k);
    const strong = [...new Set(all.filter(t => !isModifier(t) && !categoryStems.has(t)))];
    const cat = [...new Set(all.filter(t => categoryStems.has(t)))];
    const required = strong.length || cat.length ? [...strong, ...cat] : [...new Set(all)];
    return { strong, cat, required };
  };
  const client = input.pages.filter(p => p.status >= 200 && p.status < 300).map(pageSets).sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url));
  const competitorSites = input.competitors.filter(c => c.verified && (c.recommended || c.selected));
  const compSets = competitorSites.map(c => ({ website: c.website, name: c.name, pages: (input.competitorPages[c.website] || []).map(pageSets) })).filter(c => c.pages.length);
  const compBody = compSets.map(c => ({ ...c, body: new Set(c.pages.flatMap(p => [...p.body])) }));
  const offerVocab = new Set(profile.offerings.filter(o => o.selected).flatMap(o => stems(o.value).filter(t => !categoryStems.has(t) && !isModifier(t))));
  const gsc = input.keywords.some(k => k.metrics?.source?.includes("Search Console"));

  // Deterministic processing order: strongest site evidence first, then alphabetical.
  const ordered = input.keywords.slice().sort((a, b) => b.priority - a.priority || a.keyword.localeCompare(b.keyword));

  // Topic clusters: shared core (non-modifier, non-category) terms; category-only keywords cluster on their category.
  type Cluster = { id: string; anchor: Set<string>; members: string[] };
  const clusters: Cluster[] = [];
  const topicOf = new Map<string, Cluster>();
  for (const k of ordered) {
    const { strong, cat } = parts(k.keyword);
    const key = new Set(strong.length ? strong : cat.length ? cat : stems(k.keyword));
    let best: Cluster | null = null, bestScore = 0;
    for (const c of clusters) {
      const shared = [...key].filter(t => c.anchor.has(t)).length;
      if (!shared) continue;
      const subset = [...c.anchor].every(t => key.has(t)) || [...key].every(t => c.anchor.has(t));
      const jaccard = shared / (key.size + c.anchor.size - shared);
      if (!subset && jaccard < 0.5) continue;
      if (jaccard > bestScore) { best = c; bestScore = jaccard; }
    }
    if (!best) { best = { id: "topic-" + [...key].sort().join("-"), anchor: key, members: [] }; clusters.push(best); }
    best.members.push(k.id);
    topicOf.set(k.id, best);
  }

  const entries: LexiconEntry[] = ordered.map(k => {
    const { strong, required } = parts(k.keyword);
    const branded = k.groups.includes("branded");
    // Page mapping: the client page that targets the keyword best.
    let coverage: Coverage = "none", target: LexiconEntry["target"] = null, bestRank = 0;
    for (const p of client) {
      const inHead = required.every(t => p.head.has(t)), inHeadings = required.every(t => p.head.has(t) || p.headings.has(t)), inBody = required.every(t => p.body.has(t));
      const rank = inHead ? 3 : inHeadings ? 2 : inBody ? 1 : 0;
      if (rank > bestRank) {
        bestRank = rank; coverage = rank === 3 ? "targeted" : rank === 2 ? "headings" : "body";
        target = { url: p.url, title: p.title, where: rank === 3 ? ["title, H1 or URL"] : rank === 2 ? ["section headings"] : ["body text"] };
      }
    }
    // Relevance to the client's offer (observed site evidence).
    const offerLinked = strong.some(t => offerVocab.has(t));
    let r = branded ? 0.5
      : k.basis === "observed" || k.basis === "first-party" ? 0.55 + 0.1 * Math.min(3, Math.max(0, k.sources.length - 1)) + (k.sources.some(s => s.startsWith("Offering:")) ? 0.1 : 0)
      : k.basis === "measured" ? 0.45 : k.basis === "inferred" ? 0.5 : 0.35;
    if (!branded && !offerLinked) r *= 0.7;
    r = Math.max(0, Math.min(1, r));
    const factors: LexiconFactor[] = [];
    factors.push({ id: "relevance", label: "Relevance to the offer", points: Math.round(30 * r), max: 30, basis: "observed", detail: k.sources.length + " source" + (k.sources.length === 1 ? "" : "s") + " on the client's site (" + k.sources.slice(0, 2).join("; ") + ")" + (offerLinked || branded ? "" : "; no term from the selected offerings") });
    const local = k.groups.includes("local");
    // "Commercial" without a commercial cue word or an offering behind it is only a default classification.
    const cue = k.intent !== "commercial" || commercialCue.test(k.keyword) || k.sources.some(x => x.startsWith("Offering:"));
    const intentPoints = Math.min(20, (k.intent === "commercial" && !cue ? 10 : ({ transactional: 20, commercial: 16, informational: 9, navigational: 4 } as Record<string, number>)[k.intent]) + (local ? 2 : 0));
    factors.push({ id: "intent", label: "Commercial intent", points: intentPoints, max: 20, basis: "estimate", detail: k.intent[0].toUpperCase() + k.intent.slice(1) + (local ? ", local" : "") + " intent (lexical rules" + (cue ? "" : "; no intent cue, default classification") + ")" });
    const using = compBody.filter(c => required.every(t => c.body.has(t)));
    factors.push(compBody.length
      ? { id: "competitors", label: "Competitor use", points: Math.round(15 * using.length / compBody.length), max: 15, basis: "observed", detail: "On " + using.length + " of " + compBody.length + " verified competitors' sampled pages" + (using.length ? " (" + using.slice(0, 3).map(c => c.name).join(", ") + ")" : "") }
      : { id: "competitors", label: "Competitor use", points: 0, max: 15, basis: "unavailable", detail: "No verified competitor pages were sampled" });
    const gapShare = (coverage === "none" ? 1 : coverage === "body" ? 0.5 : coverage === "headings" ? 0.25 : 0) * (branded ? 0.5 : 1);
    factors.push({ id: "gap", label: "Coverage gap", points: Math.round(20 * gapShare * r), max: 20, basis: "observed", detail: coverage === "none" ? "No sampled client page covers all its terms" : coverage === "targeted" ? "Targeted by " + shortPath(target!.url) + " (title, H1 or URL)" : "Only in the " + target!.where[0] + " of " + shortPath(target!.url) });
    const words = k.keyword.split(/\s+/).length;
    const qualified = qualifier.test(k.keyword) || local;
    factors.push({ id: "specificity", label: "Specificity", points: Math.min(15, (words >= 4 ? 13 : words === 3 ? 11 : words === 2 ? 7 : 3) + (qualified ? 2 : 0)), max: 15, basis: "estimate", detail: words + " word" + (words === 1 ? "" : "s") + (qualified ? ", qualified by market, place or intent" : "") });
    const m = k.metrics;
    if (m?.impressions !== undefined) {
      const striking = m.position !== undefined && m.position >= 4 && m.position <= 20;
      factors.push({ id: "demand", label: "Search Console demand", points: Math.min(15, Math.min(10, Math.round(Math.log10(m.impressions + 1) * 4)) + (striking ? 5 : 0)), max: 15, basis: "measured", detail: m.impressions.toLocaleString("en-GB") + " impressions" + (m.position !== undefined ? ", average position " + m.position : "") + (striking ? " (striking distance)" : "") + " · " + m.source + (m.collectedAt ? ", " + m.collectedAt.slice(0, 10) : "") });
    } else if (m?.volume !== undefined) {
      factors.push({ id: "demand", label: "Measured search volume", points: Math.min(15, Math.round(Math.log10(m.volume + 1) * 4)), max: 15, basis: "measured", detail: m.volume.toLocaleString("en-GB") + " monthly searches · " + m.source });
    } else {
      factors.push({ id: "demand", label: "Search demand", points: 0, max: 15, basis: "unavailable", detail: "Not measured: connect Search Console (impressions and positions) or an authorised Google Ads Keyword Planner account" });
    }
    const score = Math.min(100, factors.reduce((n, f) => n + f.points, 0));
    const action: LexiconAction = r < 0.4 ? { kind: "monitor", label: "Monitor: weak connection to the selected offerings" }
      : coverage === "none" ? { kind: "create", label: "Create or extend a page for this topic" }
      : coverage === "targeted" ? { kind: "defend", label: "Measure and defend this page" }
      : { kind: "optimise", label: "Optimise this page: use it in the title, H1 or a section heading" };
    const longTail = !branded && words >= 3 && coverage !== "targeted" && r >= 0.45;
    return { id: k.id, keyword: k.keyword, topic: topicOf.get(k.id)!.id, score, factors, coverage, target, action, longTail, competitorUse: { sites: using.map(c => c.website), of: compBody.length } };
  }).sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));

  // Topics, named by their shortest member whose core equals the anchor, with related topics.
  const byId = new Map(entries.map(e => [e.id, e]));
  const kwById = new Map(input.keywords.map(k => [k.id, k]));
  const allPages = [...client.map(p => p.body), ...compSets.flatMap(c => c.pages.map(p => p.body))];
  const topics: LexiconTopic[] = clusters.map(c => {
    const members = c.members.map(id => byId.get(id)!).filter(Boolean);
    const names = members.map(e => e.keyword).filter(k => { const s = parts(k).strong; return s.length === c.anchor.size && s.every(t => c.anchor.has(t)); });
    // Prefer the plain phrase ("histology training") over questions and modified forms ("what is histology").
    const modifierCount = (k: string) => k.toLowerCase().split(/\s+/).filter(w => isModifier(stem(w)) || /^(is|are|a|an|the|to|in|for|of)$/.test(w)).length;
    const label = (names.length ? names : members.map(e => e.keyword)).slice().sort((a, b) => modifierCount(a) - modifierCount(b) || a.length - b.length || a.localeCompare(b))[0];
    return { id: c.id, label, keywords: members.sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword)).map(e => e.id), score: Math.max(...members.map(e => e.score)), pages: [...new Set(members.map(e => e.target?.url).filter((u): u is string => Boolean(u)))], gaps: members.filter(e => e.coverage === "none").length, related: [] };
  });
  const anchors = new Map(clusters.map(c => [c.id, c.anchor]));
  const memberTerms = new Map(clusters.map(c => [c.id, new Set(c.members.flatMap(id => parts(kwById.get(id)!.keyword).strong))]));
  for (const t of topics) {
    const a = anchors.get(t.id)!;
    t.related = topics.filter(o => o.id !== t.id).map(o => {
      const b = anchors.get(o.id)!;
      const together = allPages.filter(set => [...a].every(x => set.has(x)) && [...b].every(x => set.has(x))).length;
      const shared = [...memberTerms.get(t.id)!].filter(x => memberTerms.get(o.id)!.has(x) && !a.has(x) && !b.has(x) && !brandWords.has(x));
      const reason = [together ? "together on " + together + " page" + (together === 1 ? "" : "s") : "", shared.length ? "share " + shared.slice(0, 3).join(", ") : ""].filter(Boolean).join("; ");
      return { id: o.id, label: o.label, weight: together + shared.length, reason };
    }).filter(r => r.weight > 0).sort((x, y) => y.weight - x.weight || x.label.localeCompare(y.label)).slice(0, 3);
  }
  topics.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const dates = [...input.pages, ...Object.values(input.competitorPages).flat()].map(p => p.fetchedAt).filter(Boolean).sort();
  return {
    version: 1, computedAt: input.at || new Date().toISOString(), method: lexiconMethod,
    coverage: { clientPages: client.length, competitorPages: compSets.reduce((n, c) => n + c.pages.length, 0), competitorSites: compSets.length, searchConsole: gsc, observedFrom: dates[0] || "", observedTo: dates[dates.length - 1] || "" },
    entries, topics,
    unavailable: [
      ...(gsc ? [] : ["Search impressions, clicks and positions: not measured (Search Console is not connected)"]),
      ...(input.keywords.some(k => k.metrics?.volume !== undefined) ? [] : ["Google search volume and CPC: not measured (needs an authorised Google Ads Keyword Planner connection); VisTa does not estimate them"]),
      "Keyword difficulty: not provided; VisTa does not present an estimate as a Google metric",
    ],
  };
}

/** Changes between two lexicons for the same website (history across discoveries). */
export function lexiconDiff(previous: Lexicon, next: Lexicon) {
  const before = new Map(previous.entries.map(e => [e.keyword, e])), after = new Map(next.entries.map(e => [e.keyword, e]));
  return {
    since: previous.computedAt,
    added: next.entries.filter(e => !before.has(e.keyword)).map(e => e.keyword),
    removed: previous.entries.filter(e => !after.has(e.keyword)).map(e => e.keyword),
    changed: next.entries.filter(e => before.has(e.keyword) && Math.abs(before.get(e.keyword)!.score - e.score) >= 5).map(e => ({ keyword: e.keyword, from: before.get(e.keyword)!.score, to: e.score })),
    coverageGained: next.entries.filter(e => before.has(e.keyword) && before.get(e.keyword)!.coverage === "none" && e.coverage !== "none").map(e => e.keyword),
  };
}
