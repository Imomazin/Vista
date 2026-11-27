/**
 * VisTa Intelligence Index. Each dimension declares its evidence class, coverage and method.
 * The overall index is only calculated when the weighted evidence coverage meets the threshold;
 * otherwise dimensions are shown individually and the index is reported as not calculated.
 */
import type { EvidenceClass, Finding, Investigation } from "./model";
import type { SiteAnalysis } from "./site";
import { geoReadiness } from "./site";
import { geoMetrics } from "./geo";
import { median } from "./findings";

export type DimensionId = "technical" | "search" | "ai" | "content" | "authority" | "reputation" | "impact" | "competitive" | "performance";
export type Dimension = { id: DimensionId; label: string; score: number | null; coverage: number; evidenceClass: EvidenceClass; basis: string; measuredAt: string | null; assumptions: string };
export type IndexResult = { index: number | null; range: [number, number] | null; coverage: number; threshold: number; dimensions: Dimension[]; method: string; reason: string };

export const defaultWeights: Record<DimensionId, number> = { technical: 15, search: 15, ai: 12, content: 12, authority: 10, reputation: 8, impact: 12, competitive: 8, performance: 8 };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const penalty: Record<Finding["severity"], number> = { critical: 25, high: 12, medium: 6, low: 2, info: 0 };

function findingScore(findings: Finding[], modules: string[]): number {
  return clamp(100 - findings.filter(f => modules.includes(f.module)).reduce((sum, f) => sum + penalty[f.severity], 0));
}

export function intelligenceIndex(inv: Investigation, site: SiteAnalysis | null, findings: Finding[], weights: Record<DimensionId, number> = defaultWeights, threshold = 0.6): IndexResult {
  const pages = inv.pages;
  const at = inv.discovery?.collectedAt || null;
  const content = pages.filter(p => p.indexable && !["legal", "contact"].includes(p.pageType));
  const geo = geoMetrics(inv.observations, inv.brief);
  const mobile = inv.performance.filter(p => p.strategy === "mobile");
  const competitorsWithPages = inv.competitors.filter(c => c.pages.length);
  const dims: Dimension[] = [
    pages.length
      ? { id: "technical", label: "Technical website health", score: findingScore(findings, ["architecture", "indexability", "accessibility"]), coverage: Math.min(1, pages.length / Math.max(1, Math.min(inv.brief.pageLimit, (site?.sitemapCoverage.inSitemap || pages.length)))), evidenceClass: "observed", basis: pages.length + " crawled pages; architecture, indexability and accessibility findings", measuredAt: at, assumptions: "100 minus severity-weighted deductions (critical 25, high 12, medium 6, low 2)." }
      : unavailable("technical", "Technical website health", "No pages could be crawled."),
    inv.firstParty.gsc?.rows.length
      ? { id: "search", label: "Search visibility", score: clamp(searchScore(inv.firstParty.gsc.rows)), coverage: 1, evidenceClass: "first-party", basis: inv.firstParty.gsc.rows.length + " Search Console queries", measuredAt: inv.firstParty.gsc.collectedAt, assumptions: "Blend of impression-weighted average position (60%) and CTR relative to 5% benchmark (40%)." }
      : pages.length ? { id: "search", label: "Search visibility", score: findingScore(findings, ["on-page"]), coverage: 0.35, evidenceClass: "observed", basis: "On-page optimisation only; no ranking or impression data connected", measuredAt: at, assumptions: "On-page readiness is a proxy and is down-weighted by coverage." } : unavailable("search", "Search visibility", "Connect Search Console for ranking evidence."),
    geo.n
      ? { id: "ai", label: "AI visibility", score: clamp((geo.mentionRate.value * 0.5 + geo.citationRate.value * 0.3 + geo.recommendationRate.value * 0.2) * 100), coverage: Math.min(1, geo.n / 20) * (geo.categoryCoverage.value || 0.3), evidenceClass: geo.apiShare > 0.5 ? "observed" : "observed", basis: geo.n + " AI observations across " + geo.categoryCoverage.covered + " prompt categories", measuredAt: geo.latest, assumptions: "50% mention rate, 30% citation rate, 20% recommendation rate; coverage scales with sample size (20 = full)." }
      : unavailable("ai", "AI visibility", "No AI observations recorded or sampled."),
    content.length
      ? { id: "content", label: "Content effectiveness", score: clamp(content.reduce((s, p) => s + geoReadiness(p).score, 0) / content.length * 0.6 + findingScore(findings, ["content"]) * 0.4), coverage: Math.min(1, content.length / 10), evidenceClass: "observed", basis: content.length + " content pages (readiness criteria and content findings)", measuredAt: at, assumptions: "60% GEO readiness, 40% content findings. Engagement and conversion data would increase confidence." }
      : unavailable("content", "Content effectiveness", "No indexable content pages crawled."),
    pages.length
      ? { id: "authority", label: "Authority and trust", score: findingScore(findings, ["trust", "authority"]), coverage: 0.5, evidenceClass: "observed", basis: "On-site trust, entity and security signals; backlink data not connected", measuredAt: at, assumptions: "Coverage capped at 50% until a licensed backlink provider is connected." }
      : unavailable("authority", "Authority and trust", "No pages crawled."),
    unavailable("reputation", "Reputation", "No media, review or mention source is connected."),
    inv.firstParty.ga4?.rows.length
      ? { id: "impact", label: "Commercial impact", score: clamp(Math.min(100, inv.firstParty.ga4.rows.reduce((s, r) => s + r.keyEvents, 0) / Math.max(1, inv.firstParty.ga4.rows.reduce((s, r) => s + r.sessions, 0)) * 100 / 0.05 * 50)), coverage: 0.6, evidenceClass: "first-party", basis: "GA4 key events per session by channel", measuredAt: inv.firstParty.ga4.collectedAt, assumptions: "Key-event rate relative to a 5% reference rate (scaled to 50 points). Revenue attribution not assessed." }
      : unavailable("impact", "Commercial impact", "Connect GA4 or CRM for outcome evidence."),
    competitorsWithPages.length && pages.length
      ? { id: "competitive", label: "Competitive positioning", score: competitiveScore(inv), coverage: Math.min(1, competitorsWithPages.length / 3) * 0.7, evidenceClass: "observed", basis: "Relative technical and content signals vs " + competitorsWithPages.length + " competitors (sampled pages)", measuredAt: at, assumptions: "50 = parity. Sampled competitor pages only; no market share data." }
      : unavailable("competitive", "Competitive positioning", "Add competitor websites to compare."),
    mobile.length
      ? { id: "performance", label: "Performance experience", score: clamp(perfScore(mobile)), coverage: mobile.some(m => m.field.scope !== "none") ? 1 : 0.6, evidenceClass: "third-party", basis: mobile.length + " mobile PageSpeed tests" + (mobile.some(m => m.field.scope !== "none") ? " with CrUX field data" : " (lab only)"), measuredAt: mobile[0].collectedAt, assumptions: "Field Core Web Vitals when available (good=100, needs improvement=60, poor=20); otherwise lab score." }
      : unavailable("performance", "Performance experience", "PageSpeed Insights not run or unavailable."),
  ];
  const totalWeight = dims.reduce((s, d) => s + weights[d.id], 0);
  const coverage = dims.reduce((s, d) => s + weights[d.id] * d.coverage, 0) / totalWeight;
  const scored = dims.filter(d => d.score !== null && d.coverage > 0);
  const method = "Weighted mean of dimension scores, each weighted by its configured weight × evidence coverage. Calculated only when weighted coverage ≥ " + Math.round(threshold * 100) + "%.";
  if (coverage < threshold || !scored.length) return { index: null, range: null, coverage, threshold, dimensions: dims, method, reason: "Evidence coverage is " + Math.round(coverage * 100) + "%, below the " + Math.round(threshold * 100) + "% needed for a credible overall index. Dimension scores are shown individually." };
  const effective = scored.reduce((s, d) => s + weights[d.id] * d.coverage, 0);
  const index = Math.round(scored.reduce((s, d) => s + (d.score as number) * weights[d.id] * d.coverage, 0) / effective);
  const spread = Math.round((1 - coverage) * 20);
  return { index, range: [Math.max(0, index - spread), Math.min(100, index + spread)], coverage, threshold, dimensions: dims, method, reason: "Range widens as coverage falls (±" + spread + ")." };
}

function unavailable(id: DimensionId, label: string, basis: string): Dimension {
  return { id, label, score: null, coverage: 0, evidenceClass: "unavailable", basis, measuredAt: null, assumptions: "Not scored without evidence." };
}

function searchScore(rows: { clicks: number; impressions: number; position: number }[]): number {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0) || 1;
  const position = rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions;
  const ctr = rows.reduce((s, r) => s + r.clicks, 0) / impressions;
  return Math.max(0, 100 - (position - 1) * 5) * 0.6 + Math.min(100, ctr / 0.05 * 100) * 0.4;
}

function perfScore(results: Investigation["performance"]): number {
  const grade = (c?: string) => (c === "FAST" ? 100 : c === "AVERAGE" ? 60 : c === "SLOW" ? 20 : null);
  const values = results.map(r => {
    const field = [grade(r.field.lcp?.category), grade(r.field.inp?.category), grade(r.field.cls?.category)].filter((v): v is number => v !== null);
    return field.length ? field.reduce((a, b) => a + b, 0) / field.length : r.lab.score ?? 50;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function competitiveScore(inv: Investigation): number {
  const own = signalProfile(inv.pages);
  const others = inv.competitors.filter(c => c.pages.length).map(c => signalProfile(c.pages));
  const avg = (key: keyof ReturnType<typeof signalProfile>) => others.reduce((s, o) => s + o[key], 0) / others.length;
  const relative = (key: keyof ReturnType<typeof signalProfile>) => { const base = avg(key); return base ? Math.min(2, own[key] / base) : 1; };
  return clamp((relative("words") + relative("schema") + relative("readiness") + relative("trust")) / 4 * 50);
}

export function signalProfile(pages: Investigation["pages"]) {
  if (!pages.length) return { words: 0, schema: 0, readiness: 0, trust: 0, titles: 0, alt: 0 };
  return {
    words: median(pages.map(p => p.content.words)),
    schema: pages.filter(p => p.schema.types.length).length / pages.length * 100,
    readiness: pages.reduce((s, p) => s + geoReadiness(p).score, 0) / pages.length,
    trust: pages.reduce((s, p) => s + [p.trust.https, p.trust.hsts, p.trust.contactLink, p.trust.privacyLink, p.trust.aboutLink].filter(Boolean).length / 5 * 100, 0) / pages.length,
    titles: pages.filter(p => p.title && p.title.length >= 30 && p.title.length <= 65).length / pages.length * 100,
    alt: 100 - pages.reduce((s, p) => s + p.images.missingAlt, 0) / Math.max(1, pages.reduce((s, p) => s + p.images.count, 0)) * 100,
  };
}
