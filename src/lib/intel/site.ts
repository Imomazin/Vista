/** Cross-page website analysis built from crawled page records, failures, link checks and discovery. */
import type { Discovery, LinkStatus, PageFailure } from "./crawl";
import type { Hop } from "./http";
import { similarity, siteKey, type Intent, type PageRecord, type PageType } from "./page";

export type TreeNode = { name: string; path: string; pages: number; issues: number; children: TreeNode[] };
export type SiteAnalysis = {
  origin: string;
  crawled: number;
  failed: number;
  statusClasses: Record<"2xx" | "3xx" | "4xx" | "5xx" | "robots" | "error", number>;
  depth: { depth: number; count: number }[];
  hierarchy: TreeNode;
  inlinks: Record<string, number>;
  graph: { nodes: { id: string; inlinks: number; outlinks: number; depth: number; type: PageType }[]; edges: [string, string][] };
  orphans: { state: "assessed" | "insufficient"; urls: string[]; reason: string };
  brokenInternal: { source: string; target: string; status: number | null; reason: string }[];
  brokenExternal: { source: string; target: string; status: number | null; reason: string }[];
  redirects: { url: string; chain: Hop[]; loop: boolean }[];
  internalRedirectLinks: { source: string; target: string; finalUrl: string }[];
  duplicateTitles: { value: string; urls: string[] }[];
  duplicateDescriptions: { value: string; urls: string[] }[];
  nearDuplicates: { a: string; b: string; similarity: number }[];
  parameterUrls: string[];
  canonicalIssues: { url: string; canonical: string; problem: string }[];
  sitemapIssues: { url: string; problem: string }[];
  sitemapCoverage: { inSitemap: number; crawledInSitemap: number; crawledNotInSitemap: string[] };
  indexability: { indexable: number; nonIndexable: number; reasons: Record<string, number> };
  robotsBlocked: string[];
  pageTypes: Partial<Record<PageType, number>>;
  intents: Partial<Record<Intent, number>>;
  clusters: { label: string; terms: string[]; urls: string[]; words: number }[];
  hreflangIssues: { url: string; problem: string }[];
};

const strip = (url: string) => url.replace(/\/$/, "");

export function analyseSite(discovery: Discovery | null, pages: PageRecord[], failures: PageFailure[], links: LinkStatus[], brandTerms: string[] = []): SiteAnalysis {
  const origin = discovery?.origin || (pages[0] ? new URL(pages[0].finalUrl).origin : "");
  const byFinal = new Map(pages.map(p => [strip(p.finalUrl), p]));
  const byRequested = new Map(pages.map(p => [strip(p.url), p]));
  const failureByUrl = new Map(failures.map(f => [strip(f.url), f]));
  const linkByUrl = new Map(links.map(l => [strip(l.url), l]));
  const statusClasses = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, robots: 0, error: 0 };
  for (const p of pages) statusClasses["2xx"] += 1;
  for (const f of failures) {
    if (f.kind === "robots") statusClasses.robots += 1;
    else if (f.status && f.status >= 500) statusClasses["5xx"] += 1;
    else if (f.status && f.status >= 400) statusClasses["4xx"] += 1;
    else statusClasses.error += 1;
  }
  const redirectCount = pages.filter(p => p.chain.length > 1).length;
  statusClasses["3xx"] = redirectCount;

  // Depth distribution.
  const depthMap = new Map<number, number>();
  for (const p of pages) depthMap.set(p.depth, (depthMap.get(p.depth) || 0) + 1);
  const depth = [...depthMap.entries()].sort((a, b) => a[0] - b[0]).map(([d, count]) => ({ depth: d, count }));

  // Internal link graph among crawled pages.
  const inlinks: Record<string, number> = {};
  const edges: [string, string][] = [];
  const crawledKeys = new Set(pages.map(p => strip(p.finalUrl)));
  for (const p of pages) for (const link of p.links.internal) {
    const target = byRequested.get(strip(link.url))?.finalUrl || link.url;
    const key = strip(target);
    if (!crawledKeys.has(key) || key === strip(p.finalUrl)) continue;
    inlinks[key] = (inlinks[key] || 0) + 1;
    if (edges.length < 1500) edges.push([strip(p.finalUrl), key]);
  }
  const graphNodes = pages.slice(0, 180).map(p => ({ id: strip(p.finalUrl), inlinks: inlinks[strip(p.finalUrl)] || 0, outlinks: p.links.internal.length, depth: p.depth, type: p.pageType }));
  const nodeIds = new Set(graphNodes.map(n => n.id));

  // Hierarchy tree from URL paths.
  const root: TreeNode = { name: origin ? new URL(origin).hostname : "site", path: "/", pages: 0, issues: 0, children: [] };
  for (const p of pages) {
    const segments = new URL(p.finalUrl).pathname.split("/").filter(Boolean).slice(0, 4);
    let node = root;
    node.pages += 1;
    const issues = p.headingIssues.length + (p.indexable ? 0 : 1) + (p.title ? 0 : 1) + (p.description ? 0 : 1) + (p.images.missingAlt ? 1 : 0);
    node.issues += issues;
    let path = "";
    for (const segment of segments) {
      path += "/" + segment;
      let child = node.children.find(c => c.name === segment);
      if (!child) { child = { name: decodeURIComponent(segment).slice(0, 40), path, pages: 0, issues: 0, children: [] }; node.children.push(child); }
      child.pages += 1; child.issues += issues; node = child;
    }
  }

  // Broken links: internal targets that failed as pages or link checks; external from link checks.
  const brokenInternal: SiteAnalysis["brokenInternal"] = [];
  const brokenExternal: SiteAnalysis["brokenExternal"] = [];
  const internalRedirectLinks: SiteAnalysis["internalRedirectLinks"] = [];
  const site = origin ? siteKey(new URL(origin).hostname) : "";
  for (const p of pages) {
    for (const link of p.links.internal) {
      const key = strip(link.url);
      const failed = failureByUrl.get(key);
      const checked = linkByUrl.get(key);
      if (failed && ((failed.status ?? 0) >= 400 || failed.kind === "redirect-loop" || failed.kind === "too-many-redirects")) brokenInternal.push({ source: p.finalUrl, target: link.url, status: failed.status ?? null, reason: failed.message });
      else if (checked && (checked.status === null || checked.status >= 400)) brokenInternal.push({ source: p.finalUrl, target: link.url, status: checked.status, reason: checked.message || "HTTP " + checked.status });
      const crawledTarget = byRequested.get(key);
      if (crawledTarget && crawledTarget.chain.length > 1 && internalRedirectLinks.length < 300) internalRedirectLinks.push({ source: p.finalUrl, target: link.url, finalUrl: crawledTarget.finalUrl });
      else if (checked && checked.redirects > 0 && checked.status && checked.status < 400 && internalRedirectLinks.length < 300) internalRedirectLinks.push({ source: p.finalUrl, target: link.url, finalUrl: checked.finalUrl || "" });
    }
    for (const link of p.links.external) {
      const checked = linkByUrl.get(strip(link.url));
      if (checked && (checked.status === null ? checked.kind !== "timeout" : checked.status >= 400 && checked.status !== 403 && checked.status !== 429 && checked.status !== 999)) brokenExternal.push({ source: p.finalUrl, target: link.url, status: checked.status, reason: checked.message || "HTTP " + checked.status });
    }
  }

  // Redirect chains and loops seen while crawling.
  const redirects = [
    ...pages.filter(p => p.chain.length > 2).map(p => ({ url: p.url, chain: p.chain, loop: false })),
    ...failures.filter(f => f.kind === "redirect-loop" || f.kind === "too-many-redirects").map(f => ({ url: f.url, chain: f.chain, loop: f.kind === "redirect-loop" })),
  ];

  // Duplicates.
  const group = (value: (p: PageRecord) => string | null) => {
    const map = new Map<string, string[]>();
    for (const p of pages) { if (!p.indexable) continue; const v = value(p)?.trim().toLowerCase(); if (!v) continue; map.set(v, [...(map.get(v) || []), p.finalUrl]); }
    return [...map.entries()].filter(([, urls]) => urls.length > 1).map(([v, urls]) => ({ value: v, urls })).sort((a, b) => b.urls.length - a.urls.length);
  };
  const duplicateTitles = group(p => p.title);
  const duplicateDescriptions = group(p => p.description);
  const nearDuplicates: SiteAnalysis["nearDuplicates"] = [];
  const comparable = pages.filter(p => p.indexable && p.content.words >= 120).slice(0, 160);
  for (let i = 0; i < comparable.length; i += 1) for (let j = i + 1; j < comparable.length; j += 1) {
    const score = similarity(comparable[i].content.signature, comparable[j].content.signature);
    if (score >= 0.85 && nearDuplicates.length < 100) nearDuplicates.push({ a: comparable[i].finalUrl, b: comparable[j].finalUrl, similarity: Math.round(score * 100) / 100 });
  }

  // Parameter URLs discovered in internal links.
  const parameterUrls = [...new Set(pages.flatMap(p => p.links.internal.map(l => l.url)).filter(u => { try { const q = new URL(u).searchParams; return [...q.keys()].some(k => !/^(page|p)$/i.test(k)); } catch { return false; } }))].slice(0, 100);

  // Canonical issues.
  const canonicalIssues: SiteAnalysis["canonicalIssues"] = [];
  for (const p of pages) {
    if (!p.canonical) continue;
    const target = strip(p.canonical);
    if (target === strip(p.finalUrl)) continue;
    if (siteKey(new URL(p.canonical).hostname) !== site) { canonicalIssues.push({ url: p.finalUrl, canonical: p.canonical, problem: "Canonical points to another website." }); continue; }
    const failed = failureByUrl.get(target);
    const crawled = byFinal.get(target) || byRequested.get(target);
    if (failed?.status && failed.status >= 400) canonicalIssues.push({ url: p.finalUrl, canonical: p.canonical, problem: "Canonical target returns HTTP " + failed.status + "." });
    else if (crawled && crawled.chain.length > 1 && strip(crawled.url) === target) canonicalIssues.push({ url: p.finalUrl, canonical: p.canonical, problem: "Canonical target redirects to " + crawled.finalUrl + "." });
    else if (crawled && /noindex/i.test((crawled.robotsMeta || "") + (crawled.xRobots || ""))) canonicalIssues.push({ url: p.finalUrl, canonical: p.canonical, problem: "Canonical target is marked noindex (conflicting signals)." });
  }

  // Sitemap conflicts and coverage.
  const sitemapSet = new Set((discovery?.sitemapUrls || []).map(e => strip(e.loc)));
  const sitemapIssues: SiteAnalysis["sitemapIssues"] = [];
  for (const p of pages) {
    if (!sitemapSet.has(strip(p.url))) continue;
    if (p.chain.length > 1) sitemapIssues.push({ url: p.url, problem: "Listed in the sitemap but redirects to " + p.finalUrl + "." });
    else if (/noindex/i.test((p.robotsMeta || "") + (p.xRobots || ""))) sitemapIssues.push({ url: p.url, problem: "Listed in the sitemap but marked noindex." });
    else if (p.canonical && strip(p.canonical) !== strip(p.finalUrl)) sitemapIssues.push({ url: p.url, problem: "Listed in the sitemap but canonicalised to " + p.canonical + "." });
  }
  for (const f of failures) if (sitemapSet.has(strip(f.url)) && f.status && f.status >= 400) sitemapIssues.push({ url: f.url, problem: "Listed in the sitemap but returns HTTP " + f.status + "." });
  const crawledNotInSitemap = sitemapSet.size ? pages.filter(p => p.indexable && !sitemapSet.has(strip(p.finalUrl)) && !sitemapSet.has(strip(p.url))).map(p => p.finalUrl) : [];

  // Orphans: sitemap URLs never linked from crawled pages. Only meaningful when the crawl covered the linked inventory.
  const linkedTargets = new Set(pages.flatMap(p => p.links.internal.map(l => strip(l.url))));
  const covered = pages.length;
  const sitemapSize = sitemapSet.size;
  const orphanState = sitemapSize === 0 ? { state: "insufficient" as const, reason: "No XML sitemap inventory was available to compare against linked pages." }
    : covered < Math.min(sitemapSize, 40) * 0.8 ? { state: "insufficient" as const, reason: "The crawl covered " + covered + " pages against " + sitemapSize + " sitemap URLs; increase crawl depth for a reliable orphan assessment." }
    : { state: "assessed" as const, reason: "Sitemap URLs compared with internal links on " + covered + " crawled pages. URLs linked only from uncrawled pages may appear orphaned." };
  const orphans = { ...orphanState, urls: orphanState.state === "assessed" ? [...sitemapSet].filter(u => !linkedTargets.has(u) && strip(origin) !== u).slice(0, 200) : [] };

  // Indexability.
  const reasons: Record<string, number> = {};
  for (const p of pages) for (const r of p.indexReasons) { const key = r.replace(/: .*/, "").replace(/\d+/g, "n"); reasons[key] = (reasons[key] || 0) + 1; }
  const robotsBlocked = failures.filter(f => f.kind === "robots").map(f => f.url);

  // Page types, intents and topic clusters.
  const pageTypes: SiteAnalysis["pageTypes"] = {};
  const intents: SiteAnalysis["intents"] = {};
  for (const p of pages) { pageTypes[p.pageType] = (pageTypes[p.pageType] || 0) + 1; intents[p.intent] = (intents[p.intent] || 0) + 1; }
  const brand = new Set(brandTerms.flatMap(t => t.toLowerCase().split(/\W+/)).filter(Boolean));
  const df = new Map<string, number>();
  for (const p of pages) for (const [term] of p.content.terms.slice(0, 8)) if (!brand.has(term)) df.set(term, (df.get(term) || 0) + 1);
  const ubiquitous = new Set([...df.entries()].filter(([, n]) => pages.length >= 6 && n / pages.length > 0.6).map(([t]) => t));
  const clusterTerms = [...df.entries()].filter(([t, n]) => n >= 2 && !ubiquitous.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  const clusterMap = new Map<string, PageRecord[]>();
  for (const p of pages) {
    const termWeights = new Map(p.content.terms);
    const best = clusterTerms.map(t => [t, termWeights.get(t) || 0] as const).sort((a, b) => b[1] - a[1])[0];
    const label = best && best[1] > 0 ? best[0] : "Other";
    clusterMap.set(label, [...(clusterMap.get(label) || []), p]);
  }
  const clusters = [...clusterMap.entries()].map(([label, members]) => {
    const combined = new Map<string, number>();
    for (const m of members) for (const [t, n] of m.content.terms) if (!brand.has(t)) combined.set(t, (combined.get(t) || 0) + n);
    return { label, terms: [...combined.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t), urls: members.map(m => m.finalUrl), words: members.reduce((s, m) => s + m.content.words, 0) };
  }).sort((a, b) => b.urls.length - a.urls.length);

  // hreflang reciprocity and self-reference.
  const hreflangIssues: SiteAnalysis["hreflangIssues"] = [];
  for (const p of pages) {
    if (!p.hreflang.length) continue;
    if (!p.hreflang.some(h => strip(h.href) === strip(p.finalUrl))) hreflangIssues.push({ url: p.finalUrl, problem: "hreflang set does not include a self-referencing entry." });
    for (const h of p.hreflang) {
      if (!/^([a-z]{2,3}(-[a-z0-9]{2,4})?|x-default)$/i.test(h.lang)) hreflangIssues.push({ url: p.finalUrl, problem: "Invalid hreflang code \"" + h.lang + "\"." });
      const alternate = byFinal.get(strip(h.href)) || byRequested.get(strip(h.href));
      if (alternate && alternate.hreflang.length && !alternate.hreflang.some(x => strip(x.href) === strip(p.finalUrl))) hreflangIssues.push({ url: p.finalUrl, problem: "Alternate " + h.href + " does not link back (non-reciprocal)." });
    }
  }

  return {
    origin, crawled: pages.length, failed: failures.length, statusClasses, depth, hierarchy: root, inlinks,
    graph: { nodes: graphNodes, edges: edges.filter(([a, b]) => nodeIds.has(a) && nodeIds.has(b)).slice(0, 800) },
    orphans, brokenInternal: dedupe(brokenInternal), brokenExternal: dedupe(brokenExternal), redirects, internalRedirectLinks,
    duplicateTitles, duplicateDescriptions, nearDuplicates, parameterUrls, canonicalIssues, sitemapIssues,
    sitemapCoverage: { inSitemap: sitemapSize, crawledInSitemap: pages.filter(p => sitemapSet.has(strip(p.url)) || sitemapSet.has(strip(p.finalUrl))).length, crawledNotInSitemap },
    indexability: { indexable: pages.filter(p => p.indexable).length, nonIndexable: pages.filter(p => !p.indexable).length, reasons },
    robotsBlocked, pageTypes, intents, clusters, hreflangIssues: hreflangIssues.slice(0, 200),
  };
}

function dedupe<T extends { source: string; target: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = item.source + "→" + item.target; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 500);
}

/** GEO readiness for one page: transparent criteria, each worth equal weight. */
export function geoReadiness(p: PageRecord): { score: number; criteria: { name: string; met: boolean }[] } {
  const criteria = [
    { name: "Substantive content (300+ words)", met: p.content.words >= 300 },
    { name: "Question-led or structured headings", met: p.content.questionHeadings > 0 || p.headings.filter(h => h.level === 2).length >= 3 },
    { name: "Scannable lists or tables", met: p.content.lists > 0 || p.content.tables > 0 },
    { name: "Typed structured data", met: p.schema.types.length > 0 && p.schema.errors === 0 },
    { name: "Organisation or author identity", met: Boolean(p.schema.organisation) || p.trust.authorSignal },
    { name: "Verifiable date", met: Boolean(p.dates?.modified || p.dates?.published) },
    { name: "Cites external sources", met: p.links.external.filter(l => !l.nofollow).length >= 2 },
    { name: "Single clear H1 and description", met: p.h1.length === 1 && Boolean(p.description) },
  ];
  return { score: Math.round(criteria.filter(c => c.met).length / criteria.length * 100), criteria };
}
