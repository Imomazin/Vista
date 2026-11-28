/**
 * Priority pages, investigation scope and the hand-off from accepted recommendations to the
 * existing investigation pipeline (Brief). Scope rules are transparent: inventory size, site
 * complexity, JavaScript dependence and entitlement determine the tier and budgets.
 */
import type { Discovery } from "./crawl";
import { auditModes, tierCap, type AuditMode, type Brief } from "./model";
import type { PageRecord } from "./page";
import { siteKey } from "./page";
import { humaniseSlug } from "./discovery-profile";
import type { DiscoveryRun, PageRole, PriorityPage, ScopeRec, SourceStatus } from "./discovery-model";

const rolePath: [PageRole, RegExp][] = [
  ["pricing", /\/(pricing|plans|fees|prices)(\/|$)/i],
  ["contact", /\/(contact|get-in-touch|enquir|book-a-call)/i],
  ["conversion", /\/(apply|enrol|enroll|register|checkout|basket|cart|quote|book|booking|demo|trial|signup|sign-up|application|course-form)/i],
  ["trust", /\/(about|team|our-story|who-we-are|accreditation|accreditations|reviews|testimonials|case-studies|awards|partners|advisory|faculty|tutors|experts)(\/|$|-)/i],
  ["product", /\/(products?|p|item)\//i],
  ["category", /\/(collections?|categor(y|ies)|shop|range|department)(\/|$)/i],
  ["service", /\/(services?|solutions?|courses?|training|programmes?|programs?|treatments?|what-we-do|expertise|practice-areas?)(\/|$)/i],
  ["content", /\/(blog|news|insights?|articles?|resources|guides?)(\/|$)/i],
];
const roleWeight: Record<PageRole, number> = { home: 100, service: 70, product: 64, category: 62, pricing: 66, conversion: 68, contact: 58, trust: 46, content: 30, "high-performing": 72, underperforming: 60 };
const typeRole: Partial<Record<PageRecord["pageType"], PageRole>> = { home: "home", service: "service", course: "service", product: "product", category: "category", pricing: "pricing", contact: "contact", about: "trust", article: "content" };

export function priorityPages(pages: PageRecord[], site: Discovery | null, website: string, gscPages?: { page: string; clicks: number; impressions: number }[]): PriorityPage[] {
  let key = "";
  try { key = siteKey(new URL(website).hostname); } catch { /* ignore */ }
  const sameSite = (u: string) => { try { return siteKey(new URL(u).hostname) === key; } catch { return false; } };
  const home = pages.find(p => p.pageType === "home") || pages[0];
  const navUrls = new Set((home?.business?.nav || []).map(n => n.url.split("#")[0]));
  const ctaUrls = new Map<string, string>();
  for (const p of pages) for (const c of p.business?.ctas || []) if (c.url && sameSite(c.url) && ["enrol", "buy", "book", "quote", "demo", "contact"].includes(c.kind)) ctaUrls.set(c.url.split("#")[0], c.text);
  const inlinks = new Map<string, number>();
  for (const p of pages) for (const l of p.links.internal) inlinks.set(l.url, (inlinks.get(l.url) || 0) + 1);
  const candidates = new Map<string, { title: string; page?: PageRecord }>();
  for (const p of pages) candidates.set(p.finalUrl, { title: p.title || p.h1[0] || p.finalUrl, page: p });
  for (const n of home?.business?.nav || []) if (sameSite(n.url) && !candidates.has(n.url)) candidates.set(n.url, { title: n.text });
  for (const s of (site?.sitemapUrls || []).slice(0, 300)) if (!candidates.has(s.loc)) candidates.set(s.loc, { title: humaniseSlug(s.loc) || s.loc });
  const gsc = new Map((gscPages || []).map(r => [r.page, r]));
  const out: PriorityPage[] = [];
  for (const [url, c] of candidates) {
    if (!sameSite(url)) continue;
    let path = "/";
    try { path = new URL(url).pathname; } catch { continue; }
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?)$/i.test(path) || /\/(privacy|terms|cookies?|legal|sitemap|login|account|wp-admin|tag|author)(\/|$|-)/i.test(path)) continue;
    const p = c.page;
    const matched: PageRole | undefined = (p && typeRole[p.pageType]) || rolePath.find(([, re]) => re.test(path))?.[0] || (path === "/" ? "home" : undefined);
    // Unclassified pages are content hubs only when they carry real content.
    if (!matched && (!p || p.content.words < 150)) continue;
    let role: PageRole = matched || "content";
    if (ctaUrls.has(url) && !["home", "contact", "pricing", "service", "product"].includes(role)) role = "conversion";
    const reasons: string[] = [];
    let score = roleWeight[role];
    if (navUrls.has(url)) { score += 12; reasons.push("In the main navigation"); }
    if (ctaUrls.has(url)) { score += 10; reasons.push("Target of the call to action “" + ctaUrls.get(url) + "”"); }
    const links = inlinks.get(url) || 0;
    if (links >= 2) { score += Math.min(12, links * 2); reasons.push("Linked from " + links + " sampled pages"); }
    const depth = path.split("/").filter(Boolean).length;
    if (depth <= 1) score += 6;
    if (p) {
      if (p.business?.entities.some(e => /Product|Service|Course|Program/.test(e.type))) { score += 6; reasons.push("Declares " + p.business.entities.filter(e => /Product|Service|Course|Program/.test(e.type)).map(e => e.type).slice(0, 2).join(" and ") + " structured data"); }
      reasons.unshift("Fetched: " + p.pageType + " page, " + p.content.words + " words");
      const commercial = ["service", "product", "category", "pricing"].includes(role);
      const weak = [p.content.words < 250 && "thin content (" + p.content.words + " words)", !p.indexable && "not technically indexable", !p.description && "no meta description", p.jsDependent && "content depends on JavaScript"].filter(Boolean) as string[];
      if (commercial && weak.length) { out.push({ url, role: "underperforming", title: c.title, score: score - 5, reasons: ["Commercial page with " + weak.join(", ")], basis: "measured", selected: true }); }
    } else reasons.unshift(navUrls.has(url) ? "Discovered in navigation" : "Discovered in the XML sitemap");
    const g = gsc.get(url);
    if (g && g.clicks > 0) { out.push({ url, role: "high-performing", title: c.title, score: score + Math.min(25, Math.log10(g.clicks + 1) * 10), reasons: [g.clicks + " clicks and " + g.impressions + " impressions in Search Console"], basis: "first-party", selected: true }); }
    out.push({ url, role, title: c.title, score, reasons, basis: p ? "measured" : "observed", selected: false });
  }
  const best = new Map<string, PriorityPage>();
  for (const page of out.sort((a, b) => b.score - a.score)) { const k = page.role + " " + page.url; if (!best.has(k)) best.set(k, page); }
  const perRole = new Map<PageRole, number>();
  const chosen: PriorityPage[] = [];
  const caps: Partial<Record<PageRole, number>> = { home: 1, service: 8, product: 6, category: 4, pricing: 2, conversion: 4, contact: 2, trust: 4, content: 3, "high-performing": 5, underperforming: 5 };
  for (const page of best.values()) { const n = perRole.get(page.role) || 0; if (n < (caps[page.role] ?? 3)) { perRole.set(page.role, n + 1); chosen.push({ ...page, selected: true }); } }
  return chosen.sort((a, b) => b.score - a.score).slice(0, 36);
}

export function recommendScope(run: Pick<DiscoveryRun, "site" | "pages" | "competitors" | "prompts" | "settings" | "search">, profileModel: string): ScopeRec {
  const site = run.site;
  // Known inventory: canonical-deduplicated sitemap URLs plus internal links seen in the sample.
  const canonical = (u: string) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + decodeURIComponent(x.pathname).replace(/\/index\.(php|html?)(?=\/|$)/i, "").replace(/\/+$/, "")).toLowerCase(); } catch { return u; } };
  const sitemapRaw = site?.sitemapUrls.length || 0;
  const sitemapSet = new Set((site?.sitemapUrls || []).map(e => canonical(e.loc)));
  const linkSet = new Set(run.pages.flatMap(p => [p.finalUrl, ...p.links.internal.map(l => l.url)]).filter(u => !/\.(pdf|jpe?g|png|gif|webp|zip|docx?)$/i.test(u)).map(canonical));
  const known = new Set([...sitemapSet, ...linkSet]);
  const sitemap = sitemapSet.size;
  const inventory = Math.max(known.size, run.pages.length);
  const member = run.settings.member;
  const js = run.pages.filter(p => p.jsDependent).length;
  const jsShare = run.pages.length ? js / run.pages.length : 0;
  const heavy = run.pages.filter(p => (p.retrieval?.decodedBytes ?? 0) > 1024 * 1024).length;
  const depths = (site?.sitemapUrls || []).map(s => { try { return new URL(s.loc).pathname.split("/").filter(Boolean).length; } catch { return 1; } });
  const deepest = depths.length ? Math.max(...depths) : 3;
  const rationale: string[] = [];
  let mode: AuditMode;
  if (inventory <= 25) { mode = "quick"; rationale.push("About " + inventory + " URLs were found, so a Quick Scan can cover the whole site."); }
  else if (inventory <= 250 || !member) { mode = "deep"; rationale.push(inventory <= 250 ? "About " + inventory + " URLs were found; Deep Intelligence covers the full inventory." : "About " + inventory.toLocaleString("en-GB") + " URLs were found. Enterprise Investigation (5,000 pages) requires signing in; Deep Intelligence covers the 250 most reachable pages."); }
  else { mode = "enterprise"; rationale.push("About " + inventory.toLocaleString("en-GB") + " URLs were found; Enterprise Investigation is needed for representative coverage."); }
  const cap = tierCap(mode, member);
  const raw = Math.ceil(inventory * 1.15) + 10;
  const pageLimit = Math.max(10, Math.min(cap, raw));
  rationale.push("Known inventory " + inventory.toLocaleString("en-GB") + " unique URLs: " + sitemap.toLocaleString("en-GB") + " from the XML sitemap" + (sitemapRaw > sitemap ? " (" + (sitemapRaw - sitemap) + " duplicate variants removed, e.g. index.php or trailing-slash forms)" : "") + " and " + Math.max(0, inventory - sitemap).toLocaleString("en-GB") + " further internal links found in the sample.");
  rationale.push("Page budget = min(tier cap " + cap.toLocaleString("en-GB") + ", inventory × 1.15 + 10 = " + raw.toLocaleString("en-GB") + ") = " + pageLimit.toLocaleString("en-GB") + (pageLimit > inventory ? ": the known inventory plus " + (pageLimit - inventory) + " pages of additional budget for URLs discovered while crawling." : pageLimit < inventory ? ": capped below the known inventory; the most reachable pages are crawled first." : "."));
  const maxDepth = Math.max(3, Math.min(8, deepest + 1));
  rationale.push("Crawl depth " + maxDepth + ": the deepest sitemap URL is " + deepest + " level" + (deepest === 1 ? "" : "s") + " below the home page.");
  const linkCheckLimit = Math.min(auditModes[mode].linkChecks, Math.max(40, pageLimit * 2));
  const competitors = run.competitors.filter(c => c.selected).length;
  const competitorPages = auditModes[mode].competitorPages;
  if (competitors) rationale.push(competitors + " recommended competitor" + (competitors === 1 ? "" : "s") + " × " + competitorPages + " pages each, equal samples for a fair comparison.");
  const templates = new Set(run.pages.map(p => p.pageType)).size;
  const performancePages = Math.min(auditModes[mode].performancePages, Math.max(1, Math.min(templates, 4)));
  rationale.push("PageSpeed on " + performancePages + " page template" + (performancePages === 1 ? "" : "s") + " (home and key commercial templates) rather than every page.");
  const prompts = run.prompts.filter(p => p.selected).length;
  const aiPromptBudget = Math.min(auditModes[mode].aiPrompts, prompts);
  const renderJs = jsShare >= 0.3 && run.settings.render;
  if (jsShare >= 0.3) rationale.push(js + " of " + run.pages.length + " sampled pages depend on JavaScript for their content" + (run.settings.render ? "; rendering is recommended." : "; no rendering service is configured, so those pages will be flagged rather than fully analysed."));
  if (heavy) rationale.push(heavy + " sampled pages exceed 1 MB of HTML; the streaming resource policy handles them.");
  if (/ecommerce/i.test(profileModel) && inventory > 200) rationale.push("Large product catalogue: the page budget prioritises categories and products reachable from navigation.");
  const sources: SourceStatus[] = [
    { name: "Website crawl", status: "active", note: "Public pages, robots.txt respected." },
    { name: "Google Search Console", status: "requires-sign-in", note: "Connected-client mode for authorised owners: confirmed queries, clicks, impressions and rankings." },
    { name: "Google Analytics 4", status: "requires-sign-in", note: "Connected-client mode for authorised owners: channels, engagement and key events." },
    { name: "PageSpeed Insights", status: run.settings.pagespeedKey ? "active" : "available", note: run.settings.pagespeedKey ? "API key configured." : "Shared quota without an API key; tests may be unavailable." },
    { name: "AI answer sampling (OpenAI API)", status: "requires-sign-in", note: "Automated sampling in the investigation needs an authorised owner; observations can also be recorded manually." },
    { name: "Search data provider (volumes, difficulty, rankings)", status: run.search.configured ? "active" : "not-configured", note: run.search.configured ? run.search.provider + " configured." : "Configure DataForSEO or Brave Search credentials to measure search volume, difficulty and organic competitors." },
    { name: "JavaScript rendering", status: run.settings.render ? "available" : "not-configured", note: run.settings.render ? "Rendering service configured." : "Set VISTA_RENDER_ENDPOINT to execute JavaScript-dependent pages." },
    { name: "Backlink provider", status: "not-configured", note: "Link authority needs a licensed backlink provider." },
  ];
  const requests = pageLimit + linkCheckLimit + competitors * competitorPages;
  const minutes = Math.max(1, Math.round((pageLimit / 6) * 3 / 60 + competitors * 0.4 + performancePages * 0.5 + aiPromptBudget * 0.2));
  const resources = [
    { label: "Page requests", value: "≈ " + requests.toLocaleString("en-GB"), note: pageLimit + " site pages, " + linkCheckLimit + " link checks, " + competitors * competitorPages + " competitor pages." },
    { label: "Estimated duration", value: "≈ " + minutes + " min", note: "Checkpointed batches; the investigation resumes after interruptions." },
    { label: "PageSpeed tests", value: String(performancePages * 2), note: "Mobile and desktop per template; external quota." },
    { label: "AI API calls", value: String(aiPromptBudget), note: "One OpenAI Responses API call with web search per sampled prompt (owner accounts); billed to the configured API key." },
  ];
  return { mode, pageLimit, maxDepth, linkCheckLimit, competitorPages, performancePages, aiPromptBudget, renderJs, includeExternalLinks: true, rationale, sources, resources, inventory };
}

/** Accepted recommendations → the existing investigation brief. */
export function briefFromDiscovery(run: DiscoveryRun, scope: ScopeRec, assessment: "prospect" | "connected" = "prospect"): Brief {
  const p = run.profile!;
  const pick = <T extends { selected: boolean }>(list: T[]) => list.filter(x => x.selected);
  const segments = pick(p.segments).map(s => s.value);
  return {
    website: run.website,
    brand: p.brand.value,
    aliases: pick(p.aliases).map(a => a.value).slice(0, 8),
    industry: [p.industry.value, ...pick(p.subsectors).map(s => s.value)].filter(v => v && v !== "Not determined").slice(0, 3).join(" · "),
    markets: pick(p.markets).map(m => m.value).slice(0, 6),
    audience: segments.slice(0, 4).join(", "),
    offerings: pick(p.offerings).map(o => o.value).slice(0, 12),
    objectives: pick(p.objectives).map(o => o.value).slice(0, 6),
    competitors: pick(run.competitors).map(c => c.website).slice(0, 10),
    keywords: pick(run.keywords).sort((a, b) => b.priority - a.priority).map(k => k.keyword).slice(0, 25),
    prompts: [],
    promptBank: pick(run.prompts).sort((a, b) => b.priority - a.priority).map(x => ({ prompt: x.prompt, category: x.category, market: x.market, priority: x.priority })),
    mode: scope.mode,
    assessment,
    pageLimit: scope.pageLimit,
    linkCheckLimit: scope.linkCheckLimit,
    performancePages: scope.performancePages,
    aiPromptBudget: scope.aiPromptBudget,
    includeExternalLinks: scope.includeExternalLinks,
    seedUrls: pick(run.priorityPages).map(x => x.url).filter((u, i, a) => a.indexOf(u) === i).slice(0, 60),
    renderJs: scope.renderJs,
    maxDepth: scope.maxDepth,
    discoveryId: run.id,
  };
}
