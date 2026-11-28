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

const genericOffering = new Set(["services", "service", "solutions", "products", "product", "company", "business", "online", "uk", "london", "free", "new", "home", "page", "best", "top", "guide", "information", "about", "contact", "cart", "basket", "shop", "sale", "account", "privacy", "cookies", "policy", "terms", "menu", "search", "view", "read", "learn", "find", "help", "customer", "customers", "delivery", "returns", "nz", "us", "eu"]);

/** The client's offering vocabulary: distinctive terms from accepted offerings, subsectors and industry cues. */
/** Category and audience words: they describe the market but do not distinguish one offer from another. */
export const contextTerms = new Set(["training", "trainings", "course", "courses", "programme", "programmes", "program", "programs", "students", "student", "graduate", "graduates", "international", "professional", "professionals", "healthcare", "health", "career", "careers", "support", "placement", "learning", "education", "skills", "development", "consulting", "consultancy", "advisory", "software", "solutions", "management", "business", "digital", "technology", "clients", "workshop", "workshops", "vocational", "trainees", "laboratory", "laboratories", "clinical", "medical"]);

export function offeringVocabulary(profile: BusinessProfile, pages: PageRecord[] = []): string[] {
  const counts = new Map<string, number>();
  // Terms used across many sampled pages describe the category better than individual product names.
  const spread = new Map<string, number>();
  // Titles and headings name categories; body text often repeats boilerplate, so it is not used here.
  for (const p of pages) for (const t of new Set(tokens([p.title, ...p.h1, ...p.headings.filter(h => h.level <= 2).map(h => h.text)].join(" ")))) spread.set(t, (spread.get(t) || 0) + 1);
  const bump = (text: string, weight: number) => { for (const t of tokens(text)) if (t.length > 2 && !genericOffering.has(t) && !/^\d+$/.test(t)) counts.set(t, (counts.get(t) || 0) + weight); };
  for (const o of profile.offerings.filter(o => o.selected)) bump(o.value, 3);
  for (const s of profile.subsectors.filter(s => s.selected)) bump(s.value, 1);
  for (const e of profile.industry.evidence) { const m = e.detail.match(/“([^”]+)”/); if (m) bump(m[1], 2); }
  // Only terms that recur across pages and also belong to the offer vocabulary are reinforced (e.g. "shoes" across product pages).
  for (const [t, n] of spread) if (counts.has(t) && n >= Math.max(2, pages.length * 0.25) && !genericOffering.has(t)) counts.set(t, (counts.get(t) || 0) + n);
  // Only the brand name itself is excluded; aliases often add descriptive words ("… Laboratory Training").
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

const compactName = (v: string) => v.toLowerCase().normalize("NFKD").replace(/\b(ltd|limited|llp|plc|inc|llc|gmbh|uk|group|the|co)\b/g, "").replace(/[^a-z0-9]/g, "");

/** Pages on a competitor's site whose navigation label or URL uses the client's offer vocabulary. */
export function relevantLinks(home: PageRecord, vocabulary: string[], max = 2): string[] {
  const key = siteKey(hostOf(home.finalUrl));
  const links = [...(home.business?.nav || []), ...home.links.internal.map(l => ({ text: l.text, url: l.url }))];
  const scored = links.map(l => ({ url: l.url.split("#")[0], score: vocabulary.filter(t => (l.text + " " + l.url).toLowerCase().includes(t)).length })).filter(l => l.score > 0 && l.url !== home.finalUrl && siteKey(hostOf(l.url)) === key);
  return [...new Map(scored.sort((a, b) => b.score - a.score).map(l => [l.url, l])).keys()].slice(0, max);
}

export function assessCompetitor(profile: BusinessProfile, vocabulary: string[], candidate: Candidate, kinds: CompetitorKind[], home: PageRecord | null, failure: string | null, extra: PageRecord[] = []): CompetitorRec {
  const pagesSeen = [...(home ? [home] : []), ...extra];
  const first = pagesSeen[0] || null;
  const declared = pagesSeen.flatMap(p => p.business?.names.filter(n => /Structured data name|og:site_name|legalName|alternateName/.test(n.source)).map(n => n.value) || []);
  // "KPMG International | Home" → "KPMG International".
  const cleanOrg = (v: string) => v.split(/\s[|–—:-]\s/).map(x => x.trim()).find(x => x && !/^(home|homepage|welcome|official site|official website)$/i.test(x)) || v;
  // A candidate known only by its domain (cited sources, search results) takes its name from the page title:
  // the title segment naming the domain, otherwise the last segment ("Page | Organisation").
  const hostLike = !candidate.name || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate.name.trim());
  const titleParts = (first?.title || "").split(/\s[|–—:-]\s/).map(x => x.trim()).filter(x => x && x.split(/\s+/).length <= 8 && !/^(home|homepage|welcome|official site|official website)$/i.test(x));
  const domainKey_ = compactName(hostLabel(candidate.website));
  const titleName = titleParts.find(x => domainKey_.length >= 3 && compactName(x).includes(domainKey_)) || titleParts.at(-1);
  const name = cleanOrg(declared[0] || (hostLike && titleName ? titleName : candidate.name) || hostLabel(candidate.website));
  const evidence: EvidenceRef[] = candidate.sources.slice(0, 4).map(url => ({ url, detail: "Source consulted by AI web search", method: "AI web search citation" }));
  const base = { id: recId("competitor", siteKey(hostOf(candidate.website))), name, website: candidate.website, kinds, sources: candidate.sources };
  if (!first) {
    return { ...base, overlap: { offerings: null, markets: null, audiences: null, search: null, geo: null }, evidence, confidence: "low", verified: false, verification: failure || "The website could not be retrieved.",
      checks: { retrieval: { status: "failed", detail: failure || "The website could not be retrieved." }, identity: { status: "unverified", detail: "Not checked: no page could be retrieved." }, relevance: { status: "unknown", detail: "Not measured: no page could be retrieved." } },
      reason: "Suggested by " + kinds.join(" and ") + " evidence, but VisTa could not retrieve the website" + (failure ? ": " + failure : "."), recommended: false, selected: false };
  }
  // Identity: does the website present itself as the named organisation?
  const candidateKey = compactName(candidate.name || "");
  const domainKey = compactName(hostOf(candidate.website).split(".")[0]);
  const siteNames = [...declared, ...pagesSeen.map(p => p.title || "")].map(compactName).filter(Boolean);
  // Short names (EY, 3M) must match exactly or start the site name; longer names may be contained.
  const nameMatch = candidateKey.length >= 2 && siteNames.some(n => n === candidateKey || n.startsWith(candidateKey) || (candidateKey.length >= 3 && n.includes(candidateKey)) || (n.length >= 4 && candidateKey.includes(n)));
  const domainMatch = candidateKey.length >= 2 && (domainKey === candidateKey || (candidateKey.length >= 3 && (domainKey.includes(candidateKey) || candidateKey.includes(domainKey))));
  const identity: "verified" | "unverified" | "mismatch" = !candidate.name || nameMatch || domainMatch ? "verified" : siteNames.length ? "mismatch" : "unverified";
  const text = pagesSeen.map(pageCorpus).join(" \n ");
  const home_ = first;
  const matched = vocabulary.filter(t => new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(text));
  const theirs = candidateMarkets(home_);
  const ours = profile.markets.filter(m => m.selected).map(m => m.value);
  const sharedMarkets = theirs.filter(m => ours.includes(m));
  const ourAudience = new Set(profile.segments.filter(s => s.selected).flatMap(s => tokens(s.value)));
  const sharedAudience = [...new Set(pagesSeen.flatMap(p => p.business?.audiences || []).flatMap(a => tokens(a.phrase)).filter(t => ourAudience.has(t)))];
  for (const p of pagesSeen.slice().reverse()) evidence.unshift({ url: p.finalUrl, detail: (p === home ? "Home page" : "Service page") + " fetched: “" + (p.title || p.finalUrl).slice(0, 90) + "”", excerpt: p.h1[0] || p.title || undefined, at: p.fetchedAt, method: "VisTa crawler (robots.txt respected)" });
  // Distinctive (core) terms carry the relevance decision; context terms alone cannot make a competitor.
  const core = vocabulary.filter(t => !contextTerms.has(t));
  const coreMatched = matched.filter(t => !contextTerms.has(t));
  const coreShare = core.length ? coreMatched.length / core.length : matched.length / Math.max(1, vocabulary.length);
  const share = vocabulary.length ? (matched.length / vocabulary.length + coreShare) / 2 : 0;
  const marketOk = !ours.length || !theirs.length || sharedMarkets.length > 0;
  // Academic institutions and professional or public bodies are alternatives or authorities, not direct commercial rivals,
  // unless the client is one of them.
  const clientAcademic = profile.subsectors.some(x => /Higher education/i.test(x.value)) || /universit|college/i.test(profile.brand.value);
  const types = pagesSeen.flatMap(p => p.schema.types);
  // Names the site declares, its titles and the candidate name all count: a body cited by domain alone is still a body.
  const allNames = [name, candidate.name || "", ...declared, ...pagesSeen.map(p => p.title || "")].join(" · ");
  const academic = !clientAcademic && (types.some(t => /^(CollegeOrUniversity|School)$/.test(t)) || /\.(ac\.uk|edu|ac\.[a-z]{2})$/.test(hostOf(first.finalUrl)) || /\buniversity\b/i.test(name));
  const bodyName = /\b(institute|society|association|council|federation|chartered|royal college|college of|board)\b/i;
  const clientBody = bodyName.test(profile.brand.value);
  const body = !clientBody && (types.some(t => /^(GovernmentOrganization|NGO)$/.test(t)) || (bodyName.test(allNames) && /\.org(\.[a-z]{2})?$/.test(hostOf(first.finalUrl))));
  // Publishers cover a market without competing in it.
  const publisher = home_.schema.types.some(t => /^(NewsMediaOrganization|NewsArticle)$/.test(t)) || /(^|\.)(news|times|herald|gazette|magazine|journal|chronicle|insider|daily)[a-z-]*\./.test(hostOf(home_.finalUrl));
  const level: Confidence = coreMatched.length === 0 && core.length > 0 ? "low" : share >= 0.45 && marketOk ? "high" : share >= 0.25 && marketOk ? "medium" : "low";
  const confidence: Confidence = publisher || body || identity === "mismatch" ? "low" : academic ? (level === "high" ? "medium" : "low") : level;
  const where = pagesSeen.length > 1 ? "its home and service pages" : home ? "its home page" : "the cited page";
  const parts = [...(publisher ? ["Appears to be a news or media publisher rather than a competitor"] : []), ...(body ? ["Appears to be a professional, public or membership body: an authority to earn citations from rather than a competitor"] : []), ...(academic ? ["Academic institution: an alternative route for the same audience rather than a direct commercial competitor (inference)"] : []), ...(identity === "mismatch" ? ["The website does not present itself as " + candidate.name] : []), matched.length + " of " + vocabulary.length + " offering terms appear on " + where + " (" + matched.slice(0, 6).join(", ") + (matched.length > 6 ? ", …" : "") + ")"];
  if (sharedMarkets.length) parts.push("serves " + sharedMarkets.join(", "));
  else if (theirs.length && ours.length) parts.push("market signals point to " + theirs.join(", ") + " rather than " + ours.join(", "));
  if (sharedAudience.length) parts.push("addresses the same audiences (" + sharedAudience.slice(0, 4).join(", ") + ")");
  if (candidate.reason) parts.push("AI web search: " + candidate.reason.replace(/\s+/g, " ").replace(/[.\s]+$/, "").slice(0, 160));
  return {
    ...base,
    overlap: { offerings: { matched, total: vocabulary.length }, markets: { shared: sharedMarkets, theirs }, audiences: { shared: sharedAudience }, search: null, geo: null },
    evidence, confidence, verified: identity !== "mismatch", verification: (home ? "Website retrieved (HTTP " + home.status + ")" : "Home page unavailable (" + (failure || "not retrieved") + "); cited page retrieved") + " and analysed on " + first.fetchedAt.slice(0, 10) + ".",
    checks: {
      retrieval: { status: "ok", detail: home ? "Home page retrieved (HTTP " + home.status + ")" + (extra.length ? " plus " + extra.length + " relevant page" + (extra.length === 1 ? "" : "s") : "") + "." : "Home page unavailable (" + (failure || "not retrieved") + "); assessed from " + extra.length + " cited page" + (extra.length === 1 ? "" : "s") + "." },
      identity: { status: identity, detail: identity === "verified" ? (nameMatch ? "The site names itself " + (declared[0] || candidate.name) + "." : "The domain matches the organisation name.") : identity === "mismatch" ? "The site presents itself as " + (declared[0] || first.title || "another organisation") + ", not " + candidate.name + "." : "No organisation name is declared on the retrieved pages." },
      relevance: { status: "measured", detail: matched.length + " of " + vocabulary.length + " offering terms (" + coreMatched.length + " of " + core.length + " distinctive) on " + pagesSeen.length + " page" + (pagesSeen.length === 1 ? "" : "s") + (sharedMarkets.length ? "; shared market " + sharedMarkets.join(", ") : theirs.length ? "; market signals " + theirs.join(", ") : "; market not stated") + "." },
    },
    reason: parts.join("; ") + ".", recommended: confidence !== "low" && identity !== "mismatch", selected: confidence !== "low" && identity !== "mismatch",
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
