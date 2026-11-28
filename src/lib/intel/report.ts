/**
 * Executive report model. Slides are built from investigation evidence only; slides whose
 * evidence is unavailable either state the gap (standard/detailed) or are omitted (summary).
 */
import type { Analysis } from "./analysis";
import * as charts from "./charts";
import type { ChartSpec } from "./charts";
import { promptCategories } from "./geo";
import { evidenceClassLabel, type EngineId, type Investigation } from "./model";
import { signalProfile } from "./scoring";
import { geoReadiness } from "./site";
import { median } from "./findings";

export type ReportProduct = "executive-brief" | "board" | "seo-geo" | "competitive" | "technical" | "monthly" | "prospect" | "quarterly";
export type SlideKind = "cover" | "summary" | "landscape" | "profile" | "market" | "search" | "technical" | "architecture" | "content" | "authority" | "reputation" | "geo" | "competitive" | "commercial" | "risks" | "interventions" | "roadmap" | "decisions" | "methodology" | "evidence";

export const reportProducts: Record<ReportProduct, { label: string; audience: string; slides: SlideKind[] }> = {
  "executive-brief": { label: "Executive Intelligence Brief", audience: "CEO and executive leadership", slides: ["cover", "summary", "profile", "risks", "interventions", "roadmap", "decisions"] },
  board: { label: "Board Strategy Presentation", audience: "Board of directors", slides: ["cover", "summary", "landscape", "profile", "market", "search", "technical", "architecture", "content", "authority", "reputation", "geo", "competitive", "commercial", "risks", "interventions", "roadmap", "decisions"] },
  "seo-geo": { label: "SEO and GEO Diagnostic", audience: "Marketing leadership", slides: ["cover", "summary", "profile", "search", "technical", "architecture", "content", "authority", "geo", "interventions", "roadmap"] },
  competitive: { label: "Competitive Intelligence Report", audience: "Strategy and commercial teams", slides: ["cover", "summary", "landscape", "market", "competitive", "geo", "risks", "interventions"] },
  technical: { label: "Technical Remediation Report", audience: "Digital and technical teams", slides: ["cover", "summary", "technical", "architecture", "interventions", "roadmap"] },
  monthly: { label: "Monthly Performance Review", audience: "Existing clients", slides: ["cover", "summary", "profile", "search", "technical", "geo", "commercial", "roadmap"] },
  prospect: { label: "Prospect Opportunity Assessment", audience: "Business development teams", slides: ["cover", "summary", "profile", "technical", "content", "geo", "competitive", "interventions", "decisions"] },
  quarterly: { label: "Quarterly Strategic Review", audience: "Senior client stakeholders", slides: ["cover", "summary", "landscape", "profile", "market", "search", "content", "geo", "commercial", "risks", "roadmap", "decisions"] },
};

export type ReportConfig = {
  product: ReportProduct;
  audience: string;
  depth: "summary" | "standard" | "detailed";
  engines: EngineId[];
  clientName: string;
  whiteLabel: boolean;
  agencyName: string;
  primary: string;
  accent: string;
  clientLogo?: string;
  agencyLogo?: string;
  photography: boolean;
  appendix: boolean;
};

export type Slide = {
  kind: SlideKind;
  number: number;
  kicker: string;
  title: string;
  lead?: string;
  bullets: string[];
  metrics: { label: string; value: string; note?: string }[];
  chart?: ChartSpec;
  table?: { columns: string[]; rows: (string | number)[][] };
  source: string;
  photo?: string;
  gap?: string;
};

const engineOf: Partial<Record<SlideKind, EngineId[]>> = { search: [1], commercial: [2, 8], technical: [3], architecture: [3], content: [4], authority: [5], reputation: [6], geo: [9], market: [1], competitive: [1] };
const pct = (v: number) => Math.round(v * 100) + "%";
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function buildSlides(inv: Investigation, a: Analysis, config: ReportConfig, photos: Record<string, string> = {}): Slide[] {
  const product = reportProducts[config.product];
  const client = config.clientName || inv.brief.brand || host(inv.brief.website);
  const collected = (inv.discovery?.collectedAt || inv.updatedAt).slice(0, 10);
  const crawlSource = "Source: VisTa public crawl of " + host(inv.brief.website) + " (" + inv.pages.length + " pages), " + collected + ".";
  const severe = a.findings.filter(f => f.severity === "critical" || f.severity === "high");
  const top = a.interventions.slice(0, 6);
  const own = signalProfile(inv.pages);
  const geo = a.geo;
  const content = inv.pages.filter(p => p.indexable);
  const slides: Omit<Slide, "number">[] = [];
  const include = (kind: SlideKind) => !engineOf[kind] || engineOf[kind]!.some(e => config.engines.includes(e));
  const add = (slide: Omit<Slide, "number">) => { if (slide.gap && config.depth === "summary") return; slides.push(slide); };

  for (const kind of product.slides) {
    if (!include(kind)) continue;
    switch (kind) {
      case "cover": add({ kind, kicker: product.label.toUpperCase(), title: client, lead: "Marketing intelligence assessment · " + new Date(inv.updatedAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), bullets: ["Prepared for " + config.audience, inv.brief.assessment === "prospect" ? "Prospect assessment from public evidence" : "Connected client assessment", ...(inv.job.status === "partial" ? ["Partial investigation: see the evidence gaps in the summary"] : [])], metrics: [], source: "Prepared by " + (config.whiteLabel ? config.agencyName || "your agency" : "VisTa by Ambidexters"), photo: config.photography ? photos.cover : undefined }); break;
      case "summary": add({ kind, kicker: "EXECUTIVE SUMMARY", title: severe.length ? severe.length + " material issues stand between " + client + " and stronger visibility" : client + " has a sound technical base; growth now depends on content and authority", lead: a.index.index !== null ? "VisTa Intelligence Index " + a.index.index + " (range " + a.index.range![0] + "–" + a.index.range![1] + ") at " + pct(a.index.coverage) + " evidence coverage." : "An overall index is not stated: evidence coverage is " + pct(a.index.coverage) + ", below the threshold for a credible composite score.", bullets: [...(inv.job.status === "partial" ? ["Partial investigation — evidence is incomplete: " + (inv.job.gaps || []).slice(0, 3).join(" ") + ((inv.job.gaps || []).length > 3 ? " Further gaps are listed in the Excel evidence workbook." : "")] : []), ...severe.slice(0, 3).map(f => f.title + " — " + f.implication.split(".")[0] + "."), top[0] ? "First priority: " + top[0].action : "No priority interventions identified."].slice(0, 5), metrics: [{ label: "Pages analysed", value: String(inv.pages.length) }, { label: "Critical / high findings", value: String(severe.length) }, { label: "Interventions", value: String(a.interventions.length) }, { label: "AI mention rate", value: geo.n ? pct(geo.mentionRate.value) : "Not sampled", note: geo.n ? "n=" + geo.n : undefined }], source: crawlSource }); break;
      case "landscape": add({ kind, kicker: "STRATEGIC MARKETING LANDSCAPE", title: "Competing for " + (inv.brief.offerings[0] || inv.brief.industry || "demand") + " in " + (inv.brief.markets.join(", ") || "target markets"), bullets: [inv.brief.industry && "Industry: " + inv.brief.industry, inv.brief.audience && "Audience: " + inv.brief.audience, inv.brief.objectives.length ? "Objectives: " + inv.brief.objectives.join("; ") : "", inv.brief.competitors.length ? "Competitors assessed: " + inv.brief.competitors.map(host).join(", ") : "No competitors supplied", inv.brief.keywords.length ? "Target keywords: " + inv.brief.keywords.slice(0, 8).join(", ") : ""].filter(Boolean) as string[], metrics: [], source: "Source: client brief supplied in VisTa, " + collected + "." }); break;
      case "profile": { const spec = charts.capabilityRadar(a.index); add({ kind, kicker: "OVERALL INTELLIGENCE PROFILE", title: spec ? "Strongest in " + lowerFirst(a.index.dimensions.filter(d => d.score !== null).sort((x, y) => (y.score as number) - (x.score as number))[0].label) + "; weakest in " + lowerFirst(a.index.dimensions.filter(d => d.score !== null).sort((x, y) => (x.score as number) - (y.score as number))[0].label) : "Too few evidence-backed dimensions to profile capability", chart: spec || undefined, table: { columns: ["Dimension", "Score", "Coverage", "Evidence"], rows: a.index.dimensions.map(d => [d.label, d.score ?? "—", pct(d.coverage), evidenceClassLabel[d.evidenceClass]]) }, bullets: a.index.dimensions.filter(d => d.score === null).map(d => d.label + ": " + d.basis).slice(0, 4), metrics: [], source: "Method: " + a.index.method, gap: spec ? undefined : "Connect additional sources to profile capability." }); break; }
      case "market": { const spec = charts.competitorRadar(inv); add({ kind, kicker: "MARKET AND COMPETITIVE POSITIONING", title: spec ? positioningHeadline(inv, client) : "Competitive positioning was not assessed", chart: spec || undefined, bullets: spec ? ["Equal page samples per website; indicative, not market share."] : [], metrics: [], source: "Source: VisTa public crawl of client and competitor pages, " + collected + ".", gap: spec ? undefined : "Add competitor websites to the brief and re-run the investigation." }); break; }
      case "search": { const gsc = inv.firstParty.gsc; const spec = charts.gscOpportunity(inv); const gaps = inv.brief.keywords.filter(k => !inv.pages.some(p => p.keywords.find(x => x.keyword === k.toLowerCase())?.inTitle)); add({ kind, kicker: "SEARCH VISIBILITY PERFORMANCE", title: gsc ? gsc.rows.reduce((s, r) => s + r.impressions, 0).toLocaleString("en-GB") + " impressions; " + a.findings.filter(f => f.rule === "gsc-low-ctr").length + " query groups under-clicked" : gaps.length ? gaps.length + " of " + inv.brief.keywords.length + " target keywords have no focused page" : "On-page foundations are in place for target keywords", chart: spec || undefined, bullets: gsc ? ["Clicks: " + gsc.rows.reduce((s, r) => s + r.clicks, 0).toLocaleString("en-GB"), "Scope: " + gsc.scope] : [...gaps.slice(0, 5).map(g => "No title/H1 focus: " + g), "Ranking, impression and click data require Search Console connection."], metrics: [], source: gsc ? "Source: Google Search Console (authorised), " + gsc.collectedAt.slice(0, 10) + "." : crawlSource, gap: gsc || inv.brief.keywords.length ? undefined : "Search visibility evidence requires Search Console or target keywords." }); break; }
      case "technical": add({ kind, kicker: "TECHNICAL WEBSITE INTELLIGENCE", title: a.site.indexability.nonIndexable || a.site.brokenInternal.length ? count(a.site.brokenInternal.length, "broken internal link") + " and " + count(a.site.indexability.nonIndexable, "non-indexable page") + " need remediation" : "Technical foundations are sound across the crawled pages", chart: charts.kpiBullets(inv, a.site, inv.settings?.targets) || undefined, bullets: a.findings.filter(f => ["architecture", "indexability", "performance", "accessibility"].includes(f.module)).slice(0, 4).map(f => f.title), metrics: [{ label: "Technically indexable", value: inv.pages.length ? pct(a.site.indexability.indexable / inv.pages.length) : "—" }, { label: "Redirect chains", value: String(a.site.redirects.length) }, { label: "Sitemap URLs", value: String(a.site.sitemapCoverage.inSitemap) }], source: crawlSource + " Technical indexability is not confirmed indexing." }); break;
      case "architecture": { const spec = (config.product === "technical" ? charts.pageHealthTreemap(inv) : null) || charts.responseSankey(inv) || charts.crawlFunnel(inv, a.site); add({ kind, kicker: "WEBSITE ARCHITECTURE AND CRITICAL FINDINGS", title: a.site.depth.some(d => d.depth > 3) ? "Important pages sit too deep in the link structure" : "Architecture keeps content within reach", chart: spec || undefined, bullets: severe.filter(f => ["architecture", "indexability"].includes(f.module)).slice(0, 4).map(f => f.evidenceId + " · " + f.title), metrics: [], source: crawlSource }); break; }
      case "content": { const spec = charts.contentTreemap(a.site) || charts.readinessScatter(inv, a.site); const avg = content.length ? Math.round(content.reduce((s, p) => s + geoReadiness(p).score, 0) / content.length) : 0; add({ kind, kicker: "CONTENT PERFORMANCE AND OPPORTUNITIES", title: avg < 50 ? "Content is not yet structured to win AI answers (readiness " + avg + "/100)" : "Content is well structured; deepen topical coverage (readiness " + avg + "/100)", chart: spec || undefined, bullets: [content.length + " indexable content pages, median " + median(content.map(p => p.content.words)) + " words.", a.site.nearDuplicates.length + " near-duplicate page pairs.", ...a.findings.filter(f => f.module === "content" || f.module === "geo").slice(0, 2).map(f => f.title)], metrics: [], source: crawlSource + " GEO readiness is a transparent eight-criterion heuristic.", photo: config.photography ? photos.content : undefined }); break; }
      case "authority": { const org = inv.pages.map(p => p.schema.organisation).find(Boolean); add({ kind, kicker: "BRAND AUTHORITY AND TRUST", title: org ? "The brand entity is declared; corroboration should be strengthened" : "The brand is not declared as a structured entity", chart: charts.entityNetwork(inv) || undefined, bullets: [org ? "Organization: " + (org.name || "unnamed") + " with " + org.sameAs.length + " sameAs profiles" : "No Organization structured data", ...a.findings.filter(f => f.module === "trust" || f.module === "authority").slice(0, 3).map(f => f.title), "Backlink authority requires a licensed provider (not connected)."], metrics: [], source: crawlSource }); break; }
      case "reputation": add({ kind, kicker: "REPUTATION INTELLIGENCE", title: "Reputation monitoring is not yet connected", bullets: ["No media, review or brand-mention source is connected, so sentiment and coverage are not reported.", inv.pages.some(p => p.schema.rating) ? "Self-declared review ratings found on " + inv.pages.filter(p => p.schema.rating).length + " pages (not independently verified)." : "No review ratings declared on crawled pages."], metrics: [], source: "Evidence status as of " + collected + ".", gap: "Connect a media or review monitoring provider." }); break;
      case "geo": { const spec = charts.geoCategoryChart(inv) || charts.geoShareChart(inv); add({ kind, kicker: "AI AND GEO VISIBILITY", title: geo.n ? client + " appears in " + pct(geo.mentionRate.value) + " of sampled AI answers (n=" + geo.n + ")" : "AI search visibility has not yet been sampled", chart: spec || undefined, bullets: geo.n ? ["95% interval " + pct(geo.mentionRate.low) + "–" + pct(geo.mentionRate.high) + "; citation rate " + pct(geo.citationRate.value) + ".", a.opportunities.length + " prompts where competitors appear and " + client + " does not.", "Categories covered: " + geo.categoryCoverage.covered + " of " + promptCategories.length + ".", Math.round(geo.apiShare * 100) + "% API observations; consumer products captured manually."] : ["Record verified observations or enable authorised API sampling."], metrics: [], source: "Source: " + geo.n + " AI observations (" + [...new Set(inv.observations.map(o => o.provider))].join(", ") + "). Small samples are directional.", gap: geo.n ? undefined : "Sample AI answers before reporting AI visibility." }); break; }
      case "competitive": add({ kind, kicker: "COMPETITIVE INTELLIGENCE", title: inv.competitors.length ? "Where competitors out-invest " + client : "No competitors were assessed", table: inv.competitors.length ? { columns: ["Website", "Median words", "Schema %", "GEO readiness", "Trust signals"], rows: [[client, Math.round(own.words), Math.round(own.schema), Math.round(own.readiness), Math.round(own.trust)], ...inv.competitors.filter(c => c.pages.length).map(c => { const s = signalProfile(c.pages); return [c.name, Math.round(s.words), Math.round(s.schema), Math.round(s.readiness), Math.round(s.trust)] as (string | number)[]; })] } : undefined, bullets: a.findings.filter(f => f.module === "competitive").map(f => f.summary).slice(0, 3), metrics: [], source: "Source: equal samples of public competitor pages, " + collected + ". Indicative only.", gap: inv.competitors.length ? undefined : "Add competitors to the brief.", photo: config.photography && inv.competitors.length ? photos.competitive : undefined }); break;
      case "commercial": { const spec = charts.ga4Channels(inv); add({ kind, kicker: "COMMERCIAL PERFORMANCE", title: inv.firstParty.ga4 ? inv.firstParty.ga4.rows.reduce((s, r) => s + r.keyEvents, 0).toLocaleString("en-GB") + " key events across " + inv.firstParty.ga4.rows.length + " channels" : a.upside.available ? "Modelled upside from improved rankings" : "Commercial outcomes are not yet measured", chart: spec || undefined, bullets: a.upside.available ? a.upside.scenarios.map(s => s.label + ": +" + s.monthlyClicks.toLocaleString("en-GB") + " clicks/month" + (s.value !== null ? " (≈" + s.value.toLocaleString("en-GB") + " value)" : "")) : ["No attributed revenue or conversions are reported without connected GA4 or CRM data."], metrics: [], source: inv.firstParty.ga4 ? "Source: GA4 (authorised) " + inv.firstParty.ga4.scope : "Evidence status as of " + collected + ".", gap: spec || a.upside.available ? undefined : "Connect GA4 or CRM data to report commercial outcomes." }); break; }
      case "risks": add({ kind, kicker: "PRIORITY RISKS AND OPPORTUNITIES", title: "Protect what matters first, then pursue upside", chart: charts.quadrant(a.interventions, "risk-opportunity") || undefined, bullets: [...a.interventions.filter(i => i.risk >= 4).slice(0, 3).map(i => "Risk: " + i.finding), ...a.interventions.filter(i => i.opportunity >= 4 && i.risk < 4).slice(0, 2).map(i => "Opportunity: " + i.finding)], metrics: [], source: "Risk and opportunity derived from finding severity, impact and discipline." }); break;
      case "interventions": add({ kind, kicker: "RECOMMENDED STRATEGIC INTERVENTIONS", title: top.length ? top.length + " interventions deliver most value for the effort" : "No interventions required", table: { columns: ["Intervention", "Evidence", "Effort", "Cost range", "Success metric"], rows: top.map(i => [i.action.slice(0, 110), i.evidenceId, i.effortDays.join("–") + " days", (inv.settings?.currency || "GBP") + " " + i.cost[0].toLocaleString("en-GB") + "–" + i.cost[1].toLocaleString("en-GB"), i.metric.slice(0, 70)]) }, bullets: [], metrics: [], source: "Cost ranges assume a day rate of " + (inv.settings?.dayRate ?? 650) + " " + (inv.settings?.currency || "GBP") + "." }); break;
      case "roadmap": add({ kind, kicker: "30 · 60 · 90-DAY ROADMAP", title: "A sequenced programme: stabilise, build, then scale", table: { columns: ["Days 1–30", "Days 31–60", "Days 61–90"], rows: Array.from({ length: Math.min(6, Math.max(...a.phases.map(p => p.items.length), 1)) }, (_, r) => a.phases.map(p => p.items[r]?.finding.slice(0, 60) || "")) }, bullets: [], metrics: a.phases.map(p => ({ label: p.label.split("·")[0].trim(), value: p.items.length + " actions" })), source: "Sequenced by priority and dependency (access and indexability before content and AI visibility).", photo: config.photography ? photos.roadmap : undefined }); break;
      case "decisions": add({ kind, kicker: "DECISIONS REQUIRED", title: "Decisions required from the board", bullets: [a.phases[0].items.length ? "Approve the 30-day stabilisation programme (" + a.phases[0].items.length + " actions, " + (inv.settings?.currency || "GBP") + " " + a.phases[0].items.reduce((s, i) => s + i.cost[0], 0).toLocaleString("en-GB") + "–" + a.phases[0].items.reduce((s, i) => s + i.cost[1], 0).toLocaleString("en-GB") + ")." : "", "Assign accountable owners for each intervention and confirm review dates.", ...a.index.dimensions.filter(d => d.evidenceClass === "unavailable").slice(0, 3).map(d => "Authorise data access for " + d.label.toLowerCase() + ": " + d.basis), "Agree success metrics and the 90-day review checkpoint."].filter(Boolean), metrics: [], source: "Decisions are drawn from the intervention register and evidence gaps." }); break;
      default: break;
    }
  }
  if (config.appendix) {
    slides.push({ kind: "methodology", kicker: "APPENDIX · METHODOLOGY", title: "How this assessment was produced", bullets: ["Crawl: robots.txt respected; up to " + inv.brief.pageLimit + " pages; retrieved HTML only (JavaScript not executed).", "Findings: rule-based, each with an evidence identifier, source, collection time and limitations.", "Index: " + a.index.method, "AI visibility: rates with Wilson 95% intervals; API answers differ from consumer AI products.", "Evidence classes: " + Object.values(evidenceClassLabel).join(", ") + "."], metrics: [], source: "VisTa methodology." });
    const register = a.findings.slice(0, config.depth === "detailed" ? 44 : 22);
    for (let i = 0; i < register.length; i += 11) slides.push({ kind: "evidence", kicker: "APPENDIX · EVIDENCE REGISTER" + (register.length > 11 ? " · " + (i / 11 + 1) + " OF " + Math.ceil(register.length / 11) : ""), title: "Evidence register", table: { columns: ["Evidence ID", "Finding", "Severity", "Affected", "Source"], rows: register.slice(i, i + 11).map(f => [f.evidenceId, f.title.slice(0, 70), f.severity, f.affectedCount, f.evidenceClass]) }, bullets: [], metrics: [], source: "Full register in the Excel evidence workbook." });
  }
  return slides.map((s, i) => ({ ...s, number: i + 1 }));
}

function positioningHeadline(inv: Investigation, client: string): string {
  const own = signalProfile(inv.pages);
  const others = inv.competitors.filter(c => c.pages.length).map(c => ({ name: c.name, p: signalProfile(c.pages) }));
  const leader = others.sort((a, b) => (b.p.readiness + b.p.schema) - (a.p.readiness + a.p.schema))[0];
  if (!leader) return "Competitive positioning";
  return leader.p.readiness + leader.p.schema > own.readiness + own.schema ? leader.name + " leads on content structure and markup; " + client + " trails" : client + " leads its sampled competitors on structure and markup";
}

/** Lower-case the first letter for use mid-sentence, keeping acronyms such as "AI" intact. */
function lowerFirst(label: string): string { return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label; }

const count = (n: number, noun: string) => n + " " + noun + (n === 1 ? "" : "s");
