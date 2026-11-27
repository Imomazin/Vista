/** Interventions, prioritisation matrices, roadmaps, scenario modelling and finding dossiers. */
import type { Brief, CompetitorSnapshot, Finding, FirstPartyData, Module } from "./model";
import { severityRank } from "./findings";

export type Intervention = {
  id: string;
  findingId: string;
  evidenceId: string;
  finding: string;
  evidence: string;
  objective: string;
  action: string;
  outcome: string;
  effort: Finding["effort"];
  effortDays: [number, number];
  cost: [number, number];
  owner: string;
  metric: string;
  reviewDate: string;
  impact: number;
  urgency: number;
  importance: number;
  risk: number;
  opportunity: number;
  confidence: number;
  priority: number;
  phase: 30 | 60 | 90;
  dependsOn: string[];
  module: Module;
};

export type CostAssumptions = { dayRate: number; currency: string };
export const defaultCosts: CostAssumptions = { dayRate: 650, currency: "GBP" };
const effortDays: Record<Finding["effort"], [number, number]> = { low: [0.5, 2], medium: [2, 6], high: [6, 20] };
const confidenceValue = { high: 1, medium: 0.75, low: 0.5 } as const;
const sevValue = { critical: 5, high: 4, medium: 3, low: 2, info: 1 } as const;
/** Dependency order: access and indexability before content, content before AI visibility. */
const order: Module[] = ["indexability", "architecture", "trust", "performance", "accessibility", "on-page", "search", "content", "authority", "competitive", "geo", "analytics", "impact", "reputation"];
const riskModules = new Set<Module>(["indexability", "trust", "architecture", "performance", "accessibility"]);

const outcomeFor: Partial<Record<Module, string>> = {
  indexability: "Priority pages become eligible for search results.",
  architecture: "Crawl paths and user journeys work without dead ends.",
  "on-page": "Clearer relevance for target queries and stronger click-through.",
  performance: "Faster experiences that protect conversion rates.",
  trust: "Verifiable business identity and security for users and AI systems.",
  accessibility: "Inclusive journeys and lower compliance risk.",
  content: "Content that satisfies intent and earns visibility.",
  authority: "Clearer entity understanding and stronger authority signals.",
  geo: "Higher likelihood of being cited in AI-generated answers.",
  competitive: "Narrowed gap against competitors on shared topics.",
  search: "More clicks from existing impressions.",
};

export function buildInterventions(findings: Finding[], brief: Brief, owners: Record<string, string> = {}, costs: CostAssumptions = defaultCosts, now = new Date()): Intervention[] {
  const objective = brief.objectives[0] || "Grow qualified organic demand";
  const items = findings.filter(f => f.severity !== "info").map(f => {
    const impact = f.impact;
    const urgency = sevValue[f.severity];
    const commercial = f.affected.some(a => /product|service|course|pricing|category|contact/i.test(a.detail)) || ["search", "on-page", "geo", "competitive"].includes(f.module);
    const importance = Math.min(5, impact + (commercial ? 1 : 0));
    const risk = riskModules.has(f.module) ? urgency : Math.max(1, urgency - 2);
    const opportunity = riskModules.has(f.module) ? Math.max(1, impact - 1) : impact;
    const effortScore = { low: 1, medium: 2, high: 3 }[f.effort];
    const confidence = confidenceValue[f.confidence];
    const priority = Math.round((impact * urgency * confidence) / effortScore * 10) / 10;
    const days = effortDays[f.effort];
    return {
      id: "INT-" + f.evidenceId.slice(3),
      findingId: f.id,
      evidenceId: f.evidenceId,
      finding: f.title,
      evidence: f.evidence[0] || f.summary,
      objective,
      action: f.recommendation,
      outcome: outcomeFor[f.module] || "Measured improvement against the success metric.",
      effort: f.effort,
      effortDays: days,
      cost: [Math.round(days[0] * costs.dayRate), Math.round(days[1] * costs.dayRate)] as [number, number],
      owner: owners[f.id] || "Unassigned",
      metric: f.metric,
      reviewDate: "",
      impact, urgency, importance, risk, opportunity, confidence, priority,
      phase: 30 as Intervention["phase"],
      dependsOn: [] as string[],
      module: f.module,
    };
  });
  items.sort((a, b) => b.priority - a.priority || order.indexOf(a.module) - order.indexOf(b.module));
  // Phase: quick, urgent work first; dependent and heavier work later.
  for (const item of items) {
    const blockers = items.filter(o => o !== item && order.indexOf(o.module) < order.indexOf(item.module) && ["indexability", "architecture"].includes(o.module) && o.urgency >= 4);
    item.dependsOn = ["content", "geo", "authority", "on-page"].includes(item.module) ? blockers.map(b => b.id).slice(0, 3) : [];
    item.phase = item.urgency >= 4 && item.effort !== "high" ? 30 : item.effort === "high" || item.dependsOn.length || item.priority < 3 ? (item.priority < 2 ? 90 : 60) : 30;
    if (item.effort === "high" && item.phase === 30) item.phase = 60;
    const review = new Date(now.getTime() + (item.phase + 30) * 86400000);
    item.reviewDate = review.toISOString().slice(0, 10);
  }
  return items;
}

export function roadmap(items: Intervention[]) {
  return ([30, 60, 90] as const).map(phase => ({ phase, label: phase === 30 ? "Days 1–30 · Stabilise and quick wins" : phase === 60 ? "Days 31–60 · Build and optimise" : "Days 61–90 · Scale authority and visibility", items: items.filter(i => i.phase === phase) }));
}

/**
 * Commercial upside scenarios. Only produced when first-party search data exists; every
 * assumption is explicit and the output is a range, never a point forecast.
 */
export function upsideScenarios(firstParty: FirstPartyData, valuePerClick: number | null) {
  const rows = firstParty.gsc?.rows || [];
  if (!rows.length) return { available: false as const, reason: "Connect Search Console (and ideally GA4 conversion values) to model commercial upside. No upside is estimated without first-party demand data." };
  const candidates = rows.filter(r => r.impressions >= 50 && r.position > 3 && r.position <= 20);
  const ctrAt = (position: number) => position <= 1 ? 0.28 : position <= 2 ? 0.16 : position <= 3 ? 0.11 : position <= 5 ? 0.07 : position <= 10 ? 0.03 : 0.01;
  const scenario = (label: string, gain: number) => {
    const clicks = candidates.reduce((sum, r) => sum + Math.max(0, r.impressions * (ctrAt(Math.max(1, r.position - gain)) - r.ctr)), 0);
    return { label, positionGain: gain, monthlyClicks: Math.round(clicks * (30 / 28)), value: valuePerClick ? Math.round(clicks * (30 / 28) * valuePerClick) : null };
  };
  return {
    available: true as const,
    queries: candidates.length,
    assumptions: ["Impressions held at the last 28 days' level.", "CTR by position from a generic reference curve (1: 28%, 2: 16%, 3: 11%, 4–5: 7%, 6–10: 3%, 11+: 1%).", "Gains apply only to queries ranking 4–20 with ≥ 50 impressions.", valuePerClick ? "Value per click: " + valuePerClick + " (user supplied)." : "No value per click supplied; value not estimated."],
    scenarios: [scenario("Conservative", 1), scenario("Expected", 2), scenario("Ambitious", 4)],
  };
}

/** The ten diagnostic questions for one finding, answered only from recorded evidence. */
export function dossier(finding: Finding, competitors: CompetitorSnapshot[], intervention?: Intervention) {
  const competitorNote = (() => {
    if (!competitors.length) return "No competitors were assessed in this investigation.";
    const rule = finding.rule;
    const ahead = competitors.filter(c => c.pages.length && (
      rule === "missing-descriptions" ? c.pages.every(p => p.description) :
      rule === "structured-data-gaps" || rule === "organisation-entity" ? c.pages.some(p => p.schema.types.length) :
      rule === "image-alt" ? c.pages.every(p => !p.images.missingAlt) :
      rule === "thin-content" ? c.pages.every(p => p.content.words >= 250) :
      rule === "trust-signals" ? c.pages.some(p => p.trust.contactLink && p.trust.privacyLink) :
      rule === "hsts" ? c.pages.some(p => p.trust.hsts) : false));
    return ahead.length ? "On sampled pages, " + ahead.map(c => c.name).join(", ") + " do not show this issue." : "Sampled competitor pages do not provide a direct comparison for this finding.";
  })();
  return [
    { q: "What happened?", a: finding.summary },
    { q: "Where did it happen?", a: finding.affectedCount + " location(s): " + finding.affected.slice(0, 3).map(a => a.url).join(", ") + (finding.affectedCount > 3 ? " …" : "") },
    { q: "How significant is it?", a: finding.severity.toUpperCase() + " severity, impact " + finding.impact + "/5, confidence " + finding.confidence + "." },
    { q: "What evidence supports it?", a: finding.evidenceId + " · " + finding.evidence.join("; ") + " (" + finding.source + ", " + finding.collectedAt.slice(0, 10) + ")" },
    { q: "What are the plausible contributing factors?", a: finding.factors.join(" ") + " These are plausible explanations, not established causes." },
    { q: "Which competitors are performing differently?", a: competitorNote },
    { q: "What are the commercial implications?", a: finding.implication },
    { q: "What interventions are available?", a: finding.recommendation },
    { q: "What should be prioritised?", a: intervention ? "Priority score " + intervention.priority + " → " + intervention.phase + "-day phase" + (intervention.dependsOn.length ? ", after " + intervention.dependsOn.join(", ") : "") + "." : "Informational; no intervention required." },
    { q: "How will improvement be measured?", a: finding.metric },
  ];
}

/** Cross-engine diagnostic paths: which evidence to examine and how to validate hypotheses. */
export const crossEngineInvestigations = [
  { id: "organic-conversions", question: "Why have organic conversions declined?", engines: [1, 2, 3, 4, 8], checks: [
    { engine: 1, evidence: "Search demand and impressions trend (Search Console)", validation: "Compare impressions for the same queries year on year to separate demand from ranking change." },
    { engine: 1, evidence: "Ranking movement for converting queries", validation: "Segment queries by landing page; check average position change for converting pages." },
    { engine: 3, evidence: "Technical changes on converting landing pages", validation: "Re-crawl and compare indexability, canonicals and status codes with the previous snapshot." },
    { engine: 4, evidence: "Content freshness and intent match", validation: "Check modification dates and whether top-ranking competitors answer the intent differently." },
    { engine: 8, evidence: "Landing-page conversion rate (GA4)", validation: "Compare key-event rate per session for organic landing pages before/after the change date." },
    { engine: 2, evidence: "Lead quality and revenue (CRM)", validation: "Confirm whether qualified pipeline fell or only form volume." },
  ] },
  { id: "ai-absence", question: "Why is the brand absent from AI-generated recommendations?", engines: [9, 5, 4, 6], checks: [
    { engine: 9, evidence: "Prompt-level mention and citation rates by category", validation: "Repeat sampling across providers and dates; compare categories where competitors appear." },
    { engine: 5, evidence: "Entity clarity (Organization schema, sameAs, consistent naming)", validation: "Check that knowledge sources describe the brand consistently." },
    { engine: 4, evidence: "GEO readiness of pages matching the prompts", validation: "Verify direct answers, structure, authorship and dates on mapped pages." },
    { engine: 6, evidence: "Independent mentions and reviews cited by AI answers", validation: "List sources cited for competitors and assess presence on those sources." },
  ] },
  { id: "visibility-decline", question: "Why has organic visibility declined?", engines: [1, 3, 4, 5], checks: [
    { engine: 1, evidence: "Impressions and position trend by query group", validation: "Identify whether declines concentrate on specific templates or topics." },
    { engine: 3, evidence: "Indexability, redirects and broken links", validation: "Confirm affected URLs remain indexable 200 pages." },
    { engine: 4, evidence: "Content decay and duplication", validation: "Compare content depth with currently ranking pages." },
    { engine: 5, evidence: "Authority and links (licensed backlink data)", validation: "Check lost referring domains in the period (requires provider)." },
  ] },
];

export function priorityRank(findings: Finding[]) {
  return [...findings].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.impact - a.impact);
}
