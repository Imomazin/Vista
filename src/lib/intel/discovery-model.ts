/**
 * Intelligent Discovery: the evidence-backed recommendations VisTa produces from a website
 * address before an investigation (business profile, competitors, keywords, AI prompts,
 * priority pages and scope). Every recommendation records how it is known (basis), the
 * evidence behind it and a confidence level, and can be accepted, edited or excluded.
 */
import type { Discovery, PageFailure } from "./crawl";
import type { AiObservation, AuditMode, Confidence, PromptCategory, StageState } from "./model";
import type { PageRecord } from "./page";
import type { Lexicon } from "./lexicon";
import type { DiscoveryIndex } from "./discovery-index";

/** observed: stated on the website · inferred: VisTa rule applied to observed signals · model: AI interpretation grounded in cited pages · measured: computed from collected data · first-party: connected Search Console/GA4 · provider: licensed search data provider. */
export type Basis = "observed" | "inferred" | "model" | "measured" | "first-party" | "provider" | "user";
export const basisLabel: Record<Basis, string> = {
  observed: "Stated on the website",
  inferred: "Inference from observed signals",
  model: "AI interpretation of cited pages",
  measured: "Measured by VisTa",
  "first-party": "Connected first-party data",
  provider: "Search data provider",
  user: "Added by you",
};
/** Evidence: where (url), what (detail), the exact text (excerpt), when (at) and how it was extracted (method). */
export type EvidenceRef = { url: string; detail: string; excerpt?: string; at?: string; method?: string };
export type Rec = { id: string; value: string; basis: Basis; confidence: Confidence; evidence: EvidenceRef[]; note?: string; selected: boolean; /** Short qualifier: buyer role, service family, delivery mode. */ tag?: string };

export type BusinessProfile = {
  brand: Rec;
  aliases: Rec[];
  industry: Rec;
  subsectors: Rec[];
  offerings: Rec[];
  markets: Rec[];
  segments: Rec[];
  model: Rec;
  valueProposition: Rec;
  differentiators: Rec[];
  objectives: Rec[];
  /** Industry vocabulary suggested by the AI model (never presented as measured demand). */
  industryTerms: string[];
};

export type CompetitorKind = "commercial" | "organic" | "geo";
export const competitorKindLabel: Record<CompetitorKind, string> = { commercial: "Commercial competitor", organic: "Organic search competitor", geo: "GEO competitor" };
export type CompetitorRec = {
  id: string;
  name: string;
  website: string;
  kinds: CompetitorKind[];
  overlap: {
    offerings: { matched: string[]; total: number } | null;
    markets: { shared: string[]; theirs: string[] } | null;
    audiences: { shared: string[] } | null;
    search: { shared: number; sampled: number; keywords: string[] } | null;
    geo: { mentions: number; citations: number; samples: number } | null;
  };
  evidence: EvidenceRef[];
  sources: string[];
  confidence: Confidence;
  verified: boolean;
  verification: string;
  /** Separate verdicts: could the website be retrieved, is it the named organisation, does it compete. */
  checks?: { retrieval: { status: "ok" | "failed"; detail: string }; identity: { status: "verified" | "unverified" | "mismatch"; detail: string }; relevance: { status: "measured" | "unknown"; detail: string } };
  reason: string;
  recommended: boolean;
  selected: boolean;
};
/** AI answers cite these sites, but their own pages do not show an overlapping offer: publishers, directories or authorities to earn citations from. */
export type CitationSource = { domain: string; url: string; citations: number; samples: number; note: string };

export type KeywordGroup = "primary" | "secondary" | "long-tail" | "branded" | "non-branded" | "local" | "transactional" | "informational" | "commercial" | "emerging";
export const keywordGroupLabel: Record<KeywordGroup, string> = {
  primary: "Primary", secondary: "Secondary", "long-tail": "Long-tail", branded: "Branded", "non-branded": "Non-branded", local: "Local",
  transactional: "Transactional", informational: "Informational", commercial: "Commercial investigation", emerging: "Emerging opportunity",
};
export type KeywordIntent = "transactional" | "commercial" | "informational" | "navigational";
export type KeywordMetrics = { volume?: number; cpc?: number; competition?: number; difficulty?: number; position?: number; trend?: number[]; clicks?: number; impressions?: number; source: string; collectedAt: string };
export type KeywordRec = { id: string; keyword: string; groups: KeywordGroup[]; intent: KeywordIntent; cluster: string; priority: number; sources: string[]; evidence: EvidenceRef[]; basis: Basis; metrics: KeywordMetrics | null; selected: boolean };

export type DiscoveryPromptCategory = PromptCategory;
export type PromptRec = { id: string; prompt: string; category: PromptCategory; market: string; priority: number; rationale: string; basis: Basis; selected: boolean; template?: { id: string; slots: Record<string, string> }; sample?: { observationId: string; brandMentioned: boolean; competitors: string[]; citedDomains: string[] } };

export type PageRole = "home" | "service" | "product" | "category" | "pricing" | "conversion" | "contact" | "trust" | "content" | "high-performing" | "underperforming";
export const pageRoleLabel: Record<PageRole, string> = {
  home: "Homepage", service: "Primary service pages", product: "Product pages", category: "Category pages", pricing: "Pricing pages", conversion: "Conversion pages",
  contact: "Contact pages", trust: "Authority and trust pages", content: "Content hubs", "high-performing": "High-performing content", underperforming: "Potentially underperforming",
};
export type PriorityPage = { url: string; role: PageRole; title: string; score: number; reasons: string[]; basis: Basis; selected: boolean };

export type SourceStatus = { name: string; status: "active" | "available" | "requires-sign-in" | "not-configured"; note: string };
export type ScopeRec = {
  mode: AuditMode;
  pageLimit: number;
  maxDepth: number;
  linkCheckLimit: number;
  competitorPages: number;
  performancePages: number;
  aiPromptBudget: number;
  renderJs: boolean;
  includeExternalLinks: boolean;
  rationale: string[];
  sources: SourceStatus[];
  resources: { label: string; value: string; note: string }[];
  inventory: number;
};

export type DiscoverySettings = { geoSamples: number; useAi: boolean; member: boolean; render: boolean; pagespeedKey: boolean };
export type DiscoveryStatus = "idle" | "running" | "complete" | "partial" | "failed" | "cancelled";
export type DiscoveryRun = {
  id: string;
  projectId: string;
  website: string;
  createdAt: string;
  updatedAt: string;
  status: DiscoveryStatus;
  activity: string;
  elapsedMs: number;
  stages: StageState[];
  settings: DiscoverySettings;
  site: Discovery | null;
  pages: PageRecord[];
  failures: PageFailure[];
  ai: { available: boolean; note: string; calls: number; model: string | null };
  search: { configured: boolean; provider: string | null; note: string };
  profile: BusinessProfile | null;
  competitors: CompetitorRec[];
  citationSources: CitationSource[];
  competitorHomes: Record<string, PageRecord>;
  keywords: KeywordRec[];
  prompts: PromptRec[];
  samples: AiObservation[];
  priorityPages: PriorityPage[];
  scope: ScopeRec | null;
  gaps: string[];
  /** AI-generated prompt suggestions kept between stages. */
  aiPrompts?: { prompt: string; category: string; rationale: string }[];
  /** Client rankings observed in provider search results. */
  clientRanks?: { keyword: string; position: number }[];
  /** Home and service pages sampled from each competitor during verification. */
  competitorPages?: Record<string, PageRecord[]>;
  /** VisTa Lexicon: opportunity scores, topics and page mapping for the keywords. */
  lexicon?: Lexicon;
  /** VisTa Index: archive history and archived-versus-live comparisons. */
  index?: DiscoveryIndex;
};

export const discoveryStageDefs: { id: string; label: string }[] = [
  { id: "identify", label: "Identifying the business" },
  { id: "offerings", label: "Mapping products and services" },
  { id: "audiences", label: "Understanding target audiences" },
  { id: "competitors", label: "Discovering market competitors" },
  { id: "keywords", label: "Building keyword intelligence" },
  { id: "prompts", label: "Generating GEO search prompts" },
  { id: "pages", label: "Identifying priority pages" },
  { id: "scope", label: "Recommending investigation scope" },
];
const weights: Record<string, number> = { identify: 26, offerings: 12, audiences: 4, competitors: 26, keywords: 8, prompts: 18, pages: 3, scope: 3 };

export function newDiscovery(projectId: string, website: string, settings: DiscoverySettings): DiscoveryRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), projectId, website, createdAt: now, updatedAt: now, status: "idle", activity: "Ready to discover.", elapsedMs: 0,
    stages: discoveryStageDefs.map(s => ({ id: s.id, label: s.label, status: "pending", done: 0, total: null, note: "", errors: [] })),
    settings, site: null, pages: [], failures: [], ai: { available: false, note: "", calls: 0, model: null }, search: { configured: false, provider: null, note: "" },
    profile: null, competitors: [], citationSources: [], competitorHomes: {}, keywords: [], prompts: [], samples: [], priorityPages: [], scope: null, gaps: [],
  };
}

/** Overall progress from completed units only (stages with unknown totals contribute nothing until they finish). */
export function discoveryProgress(run: DiscoveryRun): { percent: number; determinate: boolean } {
  let total = 0, done = 0;
  for (const s of run.stages) {
    const w = weights[s.id] ?? 5;
    total += w;
    if (["complete", "partial", "skipped"].includes(s.status)) done += w;
    else if (s.status === "active" && s.total) done += w * Math.min(1, s.done / s.total);
  }
  const running = run.stages.find(s => s.status === "active");
  return { percent: Math.round((done / total) * 100), determinate: !running || running.total !== null };
}

export const marketPhrase = (m: string) => m === "United Kingdom" ? "the UK" : m === "United States" ? "the US" : m === "United Arab Emirates" ? "the UAE" : m === "Netherlands" ? "the Netherlands" : m === "Philippines" ? "the Philippines" : m;
export const recId = (prefix: string, value: string) => prefix + "-" + value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
