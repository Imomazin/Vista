/**
 * Competitor intelligence. Candidates come from AI web search (commercial), search-result
 * providers (organic) and sampled AI answers (GEO); each is verified by fetching its website and
 * measuring overlap against the client's own offering vocabulary, markets and audiences. No
 * similarity score is invented: every overlap figure is a count of matched terms with its method.
 */
import type { Confidence } from "./model";
import type { PageRecord } from "./page";
import { siteKey } from "./page";
import { tldCountry } from "./business";
import { marketRecs, pageCorpus, tokens } from "./discovery-profile";
import { recId, type BusinessProfile, type CitationSource, type CompetitorKind, type CompetitorRec, type EvidenceRef } from "./discovery-model";
import { mentions } from "./geo";

/** Platforms, directories and reference sites: they can rank or be cited but are not competitors. */
const platforms = /(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|reddit|quora|wikipedia|wikimedia|google|bing|yahoo|amazon|ebay|etsy|indeed|glassdoor|reed|totaljobs|trustpilot|yelp|tripadvisor|medium|substack|github|apple|microsoft|gov|nhs|bbc|theguardian|forbes|nytimes|crunchbase|companieshouse|find-and-update|bloomberg|reuters)\.[a-z.]+$/i;
export const isPlatform = (host: string) => platforms.test(host.replace(/^www\./, "")) || /\.(gov|gov\.uk|nhs\.uk|mil)$/i.test(host);

const genericOffering = new Set(["services", "service", "solutions", "products", "product", "company", "business", "online", "uk", "london", "free", "new", "home", "page", "best", "top", "guide", "information", "about", "contact"]);

/** The client's offering vocabulary: distinctive terms from accepted offerings, subsectors and industry cues. */
export function offeringVocabulary(profile: BusinessProfile): string[] {
  const counts = new Map<string, number>();
  const bump = (text: string, weight: number) => { for (const t of tokens(text)) if (t.length > 2 && !genericOffering.has(t) && !/^\d+$/.test(t)) counts.set(t, (counts.get(t) || 0) + weight); };
  for (const o of profile.offerings.filter(o => o.selected)) bump(o.value, 3);
  for (const s of profile.subsectors.filter(s => s.selected)) bump(s.value, 1);
  for (const e of profile.industry.evidence) { const m = e.detail.match(/“([^”]+)”/); if (m) bump(m[1], 2); }
  const brand = new Set(tokens(profile.brand.value));
  return [...counts.entries()].filter(([t]) => !brand.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
}

export type Candidate = { name: string; website: string; reason: string; offerings: string[]; markets: string[]; sources: string[] };

export function normaliseWebsite(raw: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : "https://" + raw.trim());
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.protocol + "//" + url.host.toLowerCase() + "/";
  } catch { return null; }
}

/** Markets a candidate serves according to its own home page. */
function candidateMarkets(home: PageRecord): string[] {
  return marketRecs([home], home.finalUrl).map(m => m.value);
}

export function assessCompetitor(profile: BusinessProfile, vocabulary: string[], candidate: Candidate, kinds: CompetitorKind[], home: PageRecord | null, failure: string | null): CompetitorRec {
  const name = home?.business?.names.find(n => /Structured data name|og:site_name/.test(n.source))?.value || candidate.name || hostLabel(candidate.website);
  const evidence: EvidenceRef[] = candidate.sources.slice(0, 4).map(url => ({ url, detail: "Source consulted by AI web search" }));
  const base = { id: recId("competitor", siteKey(hostOf(candidate.website))), name, website: candidate.website, kinds, sources: candidate.sources };
  if (!home) {
    return { ...base, overlap: { offerings: null, markets: null, audiences: null, search: null, geo: null }, evidence, confidence: "low", verified: false, verification: failure || "The website could not be retrieved.", reason: "Suggested by " + kinds.join(" and ") + " evidence, but VisTa could not verify the website" + (failure ? ": " + failure : "."), recommended: false, selected: false };
  }
  const text = pageCorpus(home);
  const matched = vocabulary.filter(t => new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(text));
  const theirs = candidateMarkets(home);
  const ours = profile.markets.filter(m => m.selected).map(m => m.value);
  const sharedMarkets = theirs.filter(m => ours.includes(m));
  const ourAudience = new Set(profile.segments.filter(s => s.selected).flatMap(s => tokens(s.value)));
  const sharedAudience = [...new Set((home.business?.audiences || []).flatMap(a => tokens(a.phrase)).filter(t => ourAudience.has(t)))];
  evidence.unshift({ url: home.finalUrl, detail: "Home page fetched: “" + (home.title || home.finalUrl).slice(0, 90) + "”" });
  const share = vocabulary.length ? matched.length / vocabulary.length : 0;
  const marketOk = !ours.length || !theirs.length || sharedMarkets.length > 0;
  const confidence: Confidence = share >= 0.45 && marketOk ? "high" : share >= 0.25 && marketOk ? "medium" : "low";
  const parts = [matched.length + " of " + vocabulary.length + " offering terms appear on its home page (" + matched.slice(0, 6).join(", ") + (matched.length > 6 ? ", …" : "") + ")"];
  if (sharedMarkets.length) parts.push("serves " + sharedMarkets.join(", "));
  else if (theirs.length && ours.length) parts.push("market signals point to " + theirs.join(", ") + " rather than " + ours.join(", "));
  if (sharedAudience.length) parts.push("addresses the same audiences (" + sharedAudience.slice(0, 4).join(", ") + ")");
  if (candidate.reason) parts.push("AI web search: " + candidate.reason.replace(/\s+/g, " ").replace(/[.\s]+$/, "").slice(0, 160));
  return {
    ...base,
    overlap: { offerings: { matched, total: vocabulary.length }, markets: { shared: sharedMarkets, theirs }, audiences: { shared: sharedAudience }, search: null, geo: null },
    evidence, confidence, verified: true, verification: "Website retrieved (HTTP " + home.status + ") and analysed on " + home.fetchedAt.slice(0, 10) + ".",
    reason: parts.join("; ") + ".", recommended: confidence !== "low", selected: confidence !== "low",
  };
}

export function hostOf(url: string) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return url; } }
export function hostLabel(url: string) { const h = hostOf(url).split(".")[0]; return h.charAt(0).toUpperCase() + h.slice(1); }

/** Brands and cited domains in sampled AI answers. */
export function geoEvidence(samples: { response: string; citations: { url: string }[] }[], competitors: CompetitorRec[], brandNames: string[], clientWebsite: string) {
  const mentionsBy = new Map<string, number>();
  for (const c of competitors) mentionsBy.set(c.id, samples.filter(s => mentions(s.response, [c.name, hostOf(c.website)])).length);
  const cited = new Map<string, { url: string; citations: number; samples: number }>();
  const clientKey = siteKey(hostOf(clientWebsite));
  for (const s of samples) {
    const seen = new Set<string>();
    for (const c of s.citations) {
      const host = hostOf(c.url);
      const key = siteKey(host);
      if (!host || key === clientKey) continue;
      const e = cited.get(key) || { url: c.url, citations: 0, samples: 0 };
      e.citations += 1; if (!seen.has(key)) { e.samples += 1; seen.add(key); }
      cited.set(key, e);
    }
  }
  const brandMentioned = samples.filter(s => mentions(s.response, brandNames)).length;
  return { mentionsBy, cited, brandMentioned };
}

/** Organic competitors: domains that recur in the top results for sampled keywords. */
export function serpCompetitors(serp: { keyword: string; results: { url: string; position: number }[] }[], clientWebsite: string) {
  const clientKey = siteKey(hostOf(clientWebsite));
  const domains = new Map<string, { url: string; keywords: string[]; best: number }>();
  const clientRanks: { keyword: string; position: number }[] = [];
  for (const q of serp) {
    const seen = new Set<string>();
    for (const r of q.results) {
      const host = hostOf(r.url);
      const key = siteKey(host);
      if (key === clientKey) { if (!clientRanks.some(c => c.keyword === q.keyword)) clientRanks.push({ keyword: q.keyword, position: r.position }); continue; }
      if (seen.has(key) || isPlatform(host)) continue;
      seen.add(key);
      const e = domains.get(key) || { url: "https://" + host + "/", keywords: [], best: 99 };
      e.keywords.push(q.keyword); e.best = Math.min(e.best, r.position);
      domains.set(key, e);
    }
  }
  const threshold = Math.max(2, Math.ceil(serp.length * 0.25));
  return { competitors: [...domains.entries()].filter(([, v]) => v.keywords.length >= threshold).sort((a, b) => b[1].keywords.length - a[1].keywords.length).slice(0, 8), clientRanks };
}

export function citationSources(cited: Map<string, { url: string; citations: number; samples: number }>, competitors: CompetitorRec[], total: number): CitationSource[] {
  const known = new Set(competitors.map(c => siteKey(hostOf(c.website))));
  return [...cited.entries()].filter(([k]) => !known.has(k)).sort((a, b) => b[1].citations - a[1].citations).slice(0, 12).map(([domain, v]) => ({ domain, url: v.url, citations: v.citations, samples: v.samples, note: "Cited in " + v.samples + " of " + total + " sampled AI answers" + (isPlatform(domain) ? " (platform or public body)" : "") + "." }));
}

/** Country hints from a domain (used only to label geographic relevance). */
export const domainCountry = (url: string) => tldCountry[hostOf(url).split(".").pop() || ""] || null;
