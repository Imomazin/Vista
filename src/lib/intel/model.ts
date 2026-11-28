/** Shared intelligence model: evidence classes, findings, investigations and processing jobs. */
import type { Discovery, LinkStatus, PageFailure } from "./crawl";
import type { PageRecord } from "./page";
import type { PerformanceResult } from "./psi";

export type EngineId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";
/** How a value or finding is known. Never mixed silently. */
export type EvidenceClass = "observed" | "first-party" | "third-party" | "model" | "forecast" | "unavailable";
export const evidenceClassLabel: Record<EvidenceClass, string> = {
  observed: "Directly observed",
  "first-party": "Connected first-party measurement",
  "third-party": "Third-party estimate",
  model: "Model-generated interpretation",
  forecast: "Forecast scenario",
  unavailable: "Evidence unavailable",
};
export type Module = "architecture" | "indexability" | "on-page" | "performance" | "trust" | "accessibility" | "content" | "authority" | "competitive" | "geo" | "search" | "analytics" | "impact" | "reputation";
export const moduleEngine: Record<Module, EngineId> = { architecture: 3, indexability: 3, "on-page": 1, performance: 3, trust: 5, accessibility: 3, content: 4, authority: 5, competitive: 1, geo: 9, search: 1, analytics: 8, impact: 2, reputation: 6 };

export type Finding = {
  id: string;
  evidenceId: string;
  rule: string;
  module: Module;
  engine: EngineId;
  title: string;
  severity: Severity;
  confidence: Confidence;
  evidenceClass: EvidenceClass;
  summary: string;
  affected: { url: string; detail: string }[];
  affectedCount: number;
  evidence: string[];
  factors: string[];
  implication: string;
  recommendation: string;
  effort: "low" | "medium" | "high";
  impact: 1 | 2 | 3 | 4 | 5;
  metric: string;
  source: string;
  collectedAt: string;
  methodology: string;
  limitations: string[];
};

export type AuditMode = "quick" | "deep" | "enterprise";
export const auditModes: Record<AuditMode, { label: string; purpose: string; pages: number; competitorPages: number; linkChecks: number; performancePages: number; aiPrompts: number }> = {
  quick: { label: "Quick Scan", purpose: "Initial assessment of priority pages", pages: 25, competitorPages: 3, linkChecks: 60, performancePages: 1, aiPrompts: 6 },
  deep: { label: "Deep Intelligence", purpose: "Extensive website and marketing analysis", pages: 250, competitorPages: 6, linkChecks: 400, performancePages: 3, aiPrompts: 18 },
  enterprise: { label: "Enterprise Investigation", purpose: "Comprehensive, multi-source strategic assessment", pages: 5000, competitorPages: 12, linkChecks: 2000, performancePages: 6, aiPrompts: 36 },
};

export type Brief = {
  website: string;
  brand: string;
  aliases: string[];
  industry: string;
  markets: string[];
  audience: string;
  offerings: string[];
  objectives: string[];
  competitors: string[];
  keywords: string[];
  prompts: string[];
  mode: AuditMode;
  assessment: "prospect" | "connected";
  pageLimit: number;
  linkCheckLimit: number;
  performancePages: number;
  aiPromptBudget: number;
  includeExternalLinks: boolean;
  /** Pages to inspect in addition to discovered links (also used when the home page cannot be analysed). */
  seedUrls?: string[];
  /** Re-render JavaScript-dependent pages through the configured rendering service (bounded). */
  renderJs?: boolean;
};

/** Deployment page caps per tier and entitlement (signed-in organisation members unlock Enterprise). */
export function tierCap(mode: AuditMode, member: boolean, env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}): number {
  const cap = (key: string, fallback: number) => { const n = Number(env[key]); return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback; };
  const limits = { quick: cap("NEXT_PUBLIC_VISTA_MAX_PAGES_QUICK", 25), deep: cap("NEXT_PUBLIC_VISTA_MAX_PAGES_DEEP", 250), enterprise: cap("NEXT_PUBLIC_VISTA_MAX_PAGES_ENTERPRISE", 5000) };
  return mode === "enterprise" && !member ? limits.deep : limits[mode];
}

export type CompetitorSnapshot = { website: string; name: string; discovery: Pick<Discovery, "origin" | "robots" | "sitemaps" | "collectedAt"> & { sitemapCount: number }; pages: PageRecord[]; failures: PageFailure[]; performance?: PerformanceResult };

export type AiObservation = {
  id: string;
  provider: string;
  model: string;
  surface: "api" | "consumer";
  method: "automated" | "manual";
  prompt: string;
  category: PromptCategory;
  market: string;
  language: string;
  collectedAt: string;
  response: string;
  brandMentioned: boolean;
  competitorMentions: string[];
  position: number | null;
  citations: { url: string; title: string }[];
  inaccurate: boolean | null;
  accuracyNote: string;
  methodology: string;
  limitations: string;
};

export type PromptCategory = "branded" | "discovery" | "product" | "service" | "comparison" | "local" | "problem" | "purchase" | "expertise";

export type FirstPartyData = {
  gsc?: { collectedAt: string; scope: string; rows: { query: string; clicks: number; impressions: number; ctr: number; position: number }[] };
  ga4?: { collectedAt: string; scope: string; rows: { channel: string; sessions: number; users: number; keyEvents: number }[] };
  errors: { source: string; message: string; at: string }[];
};

export type Investigation = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  brief: Brief;
  discovery: Discovery | null;
  pages: PageRecord[];
  failures: PageFailure[];
  links: LinkStatus[];
  performance: PerformanceResult[];
  competitors: CompetitorSnapshot[];
  observations: AiObservation[];
  firstParty: FirstPartyData;
  job: JobState;
  settings?: InvestigationSettings;
  /** Present on summaries loaded without page records. */
  pageCount?: number;
};

export type InvestigationSettings = {
  owners?: Record<string, string>;
  weights?: Record<string, number>;
  dayRate?: number;
  currency?: string;
  valuePerClick?: number | null;
  targets?: Record<string, number>;
  decisions?: { id: string; at: string; interventionId: string; decision: "approved" | "deferred" | "rejected"; note: string }[];
};

export type StageStatus = "pending" | "active" | "complete" | "partial" | "failed" | "skipped";
export type StageState = { id: string; label: string; status: StageStatus; done: number; total: number | null; note: string; startedAt?: string; finishedAt?: string; errors: { source: string; message: string; retryable: boolean }[] };
export type JobState = {
  status: "idle" | "running" | "paused" | "cancelled" | "complete" | "partial" | "failed";
  stages: StageState[];
  activity: string;
  startedAt: string | null;
  elapsedMs: number;
  frontier: { url: string; depth: number }[];
  visited: string[];
  counts: { pages: number; records: number; sources: number; discovered?: number; queued?: number; processed?: number; failed?: number; restricted?: number };
  /** Plain-language list of evidence gaps when the investigation is partial. */
  gaps?: string[];
};

export const websiteStages: [string, string][] = [
  ["connectivity", "Establishing website connectivity"],
  ["architecture", "Discovering website architecture"],
  ["crawl", "Crawling and inspecting pages"],
  ["technical", "Analysing technical SEO"],
  ["content", "Evaluating content intelligence"],
  ["authority", "Assessing authority and trust"],
  ["competitive", "Investigating competitive positioning"],
  ["ai", "Sampling AI search visibility"],
  ["commercial", "Identifying commercial opportunities"],
  ["recommendations", "Generating strategic recommendations"],
  ["dashboards", "Assembling intelligence dashboards"],
  ["reports", "Generating executive reports"],
];

export function newJob(): JobState {
  return {
    status: "idle",
    stages: websiteStages.map(([id, label]) => ({ id, label, status: "pending", done: 0, total: null, note: "", errors: [] })),
    activity: "Ready to begin.",
    startedAt: null,
    elapsedMs: 0,
    frontier: [],
    visited: [],
    counts: { pages: 0, records: 0, sources: 0 },
  };
}

/** Overall progress from measured stage units. Stages with unknown totals contribute only when complete. */
export function jobProgress(job: JobState): { percent: number | null; determinate: boolean } {
  const active = job.stages.find(s => s.status === "active");
  const settled = job.stages.filter(s => ["complete", "partial", "failed", "skipped"].includes(s.status)).length;
  let fraction = settled;
  if (active && active.total) fraction += Math.min(1, active.done / active.total);
  const percent = Math.round((fraction / job.stages.length) * 100);
  return { percent, determinate: !active || active.total !== null };
}

/** Stable short evidence identifier: EV-<project>-<rule>-<hash>. */
export function evidenceId(projectId: string, rule: string, scope = ""): string {
  let hash = 0x811c9dc5;
  const input = projectId + "|" + rule + "|" + scope;
  for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return "EV-" + projectId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X") + "-" + (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}
