/** Server-side crawl primitives. Each call is bounded so it fits a single serverless request. */
import { crawlerUserAgent, explainFailure, FetchFailure, fetchPublic, type FailureKind, type Hop } from "./http";
import { analysePage, siteKey, type PageRecord } from "./page";
import { parseRobots, robotsDecision, type RobotsPolicy } from "./robots";
import { parseSitemap } from "./sitemap";

export type PageFailure = { url: string; depth: number; kind: FailureKind | "http-error" | "robots" | "off-site-redirect"; status?: number; message: string; chain: Hop[] };
export type SitemapSummary = { url: string; status: number | null; kind: "urlset" | "index" | "invalid" | "unreachable"; entries: number; truncated: boolean; error?: string };
export type Discovery = {
  requestedUrl: string;
  origin: string;
  collectedAt: string;
  durationMs: number;
  home: PageRecord | null;
  homeFailure: PageFailure | null;
  robots: RobotsPolicy & { url: string; status: number | null; blocksVista: boolean; blocksAll: boolean };
  sitemaps: SitemapSummary[];
  sitemapUrls: { loc: string; lastmod?: string }[];
};

const robotsCache = new Map<string, { policy: RobotsPolicy; status: number | null; until: number }>();

export async function loadRobots(origin: string): Promise<{ policy: RobotsPolicy; status: number | null }> {
  const cached = robotsCache.get(origin);
  if (cached && cached.until > Date.now()) return cached;
  let result: { policy: RobotsPolicy; status: number | null };
  try {
    const response = await fetchPublic(origin + "/robots.txt", { accept: "text/plain,*/*;q=0.5", bodyTypes: /text\/|application\/octet-stream/i, maxBytes: 512_000, timeoutMs: 8000 });
    if (response.status >= 200 && response.status < 300) result = { policy: { state: "found", ...parseRobots(response.body) }, status: response.status };
    else if (response.status >= 400 && response.status < 500) result = { policy: { state: "missing", groups: [], sitemaps: [], bytes: 0 }, status: response.status };
    else result = { policy: { state: "unavailable", groups: [], sitemaps: [], bytes: 0 }, status: response.status };
  } catch (error) {
    // A robots.txt that is not HTML/text (for example served as HTML 404 pages) is treated as missing.
    result = error instanceof FetchFailure && error.kind === "unsupported-type"
      ? { policy: { state: "missing", groups: [], sitemaps: [], bytes: 0 }, status: error.chain.at(-1)?.status ?? null }
      : { policy: { state: "unavailable", groups: [], sitemaps: [], bytes: 0 }, status: null };
  }
  if (robotsCache.size > 500) robotsCache.clear();
  robotsCache.set(origin, { ...result, until: Date.now() + 10 * 60_000 });
  return result;
}

function failure(url: string, depth: number, error: unknown): PageFailure {
  if (error instanceof FetchFailure) return { url, depth, kind: error.kind, message: explainFailure(error.kind), chain: error.chain };
  return { url, depth, kind: "connection", message: explainFailure("connection"), chain: [] };
}

/** Fetch and analyse one page, respecting robots.txt for the VisTa user agent. */
export async function crawlPage(url: string, depth: number, keywords: string[] = [], deadline = Date.now() + 15000): Promise<{ page?: PageRecord; failure?: PageFailure }> {
  let origin: string;
  try { origin = new URL(url).origin; } catch { return { failure: { url, depth, kind: "invalid-url", message: explainFailure("invalid-url"), chain: [] } }; }
  try {
    const robots = await loadRobots(origin);
    if (!robotsDecision(robots.policy, url, crawlerUserAgent).allowed) return { failure: { url, depth, kind: "robots", message: robots.policy.state === "unavailable" ? "robots.txt could not be retrieved (server error), so crawling is paused for this site as RFC 9309 requires." : explainFailure("robots"), chain: [] } };
    const response = await fetchPublic(url, { timeoutMs: Math.max(3000, Math.min(12000, deadline - Date.now())) });
    if (siteKey(new URL(response.finalUrl).hostname) !== siteKey(new URL(url).hostname)) return { failure: { url, depth, kind: "off-site-redirect", message: "The URL redirects to another website (" + new URL(response.finalUrl).hostname + ").", chain: response.chain } };
    if (response.status < 200 || response.status >= 300) return { failure: { url, depth, kind: "http-error", status: response.status, message: explainFailure("http-error", response.status), chain: response.chain } };
    const page = analysePage({ url, finalUrl: response.finalUrl, status: response.status, chain: response.chain, headers: response.headers, html: response.body, fetchedAt: new Date().toISOString(), durationMs: response.durationMs, depth, keywords });
    return { page };
  } catch (error) { return { failure: failure(url, depth, error) }; }
}

/** Run tasks with a concurrency limit, preserving input order. */
export async function pool<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index], index); }
  }));
  return results;
}

export async function discover(input: string, keywords: string[] = []): Promise<Discovery> {
  const started = Date.now();
  const collectedAt = new Date().toISOString();
  let requested: URL;
  try { requested = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : "https://" + input.trim()); } catch { throw new FetchFailure("invalid-url", explainFailure("invalid-url")); }
  const home = await crawlPage(requested.href, 0, keywords, started + 15000);
  const origin = new URL(home.page?.finalUrl || requested.href).origin;
  const robots = await loadRobots(origin);
  const vista = robotsDecision(robots.policy, origin + "/", crawlerUserAgent);
  const generic = robotsDecision(robots.policy, origin + "/", "Googlebot");
  // Relative sitemap paths are invalid per the protocol but occur in practice; resolve them against the origin.
  const declared = robots.policy.sitemaps.flatMap(s => { try { return [new URL(s, origin).href]; } catch { return []; } });
  const candidates = declared.length ? declared : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
  const sitemaps: SitemapSummary[] = [];
  const urls = new Map<string, { loc: string; lastmod?: string }>();
  const queue = [...new Set(candidates)].slice(0, 6);
  const homeSite = siteKey(new URL(origin).hostname);
  while (queue.length && sitemaps.length < 8 && Date.now() - started < 22000) {
    const sitemapUrl = queue.shift()!;
    try {
      const response = await fetchPublic(sitemapUrl, { accept: "application/xml,text/xml,*/*;q=0.5", bodyTypes: /xml|text\/plain/i, maxBytes: 5_000_000, timeoutMs: 8000 });
      if (response.status < 200 || response.status >= 300) { if (!declared.length && [404, 410].includes(response.status)) continue; sitemaps.push({ url: sitemapUrl, status: response.status, kind: "unreachable", entries: 0, truncated: false, error: explainFailure("http-error", response.status) }); continue; }
      const parsed = parseSitemap(response.body);
      sitemaps.push({ url: sitemapUrl, status: response.status, kind: parsed.kind, entries: parsed.entries.length, truncated: parsed.truncated, ...(parsed.error ? { error: parsed.error } : {}) });
      if (parsed.kind === "index") queue.push(...parsed.entries.map(e => e.loc).filter(loc => !sitemaps.some(s => s.url === loc)).slice(0, 5));
      else for (const entry of parsed.entries) { if (urls.size >= 3000) break; try { if (siteKey(new URL(entry.loc).hostname) === homeSite) urls.set(entry.loc, entry); } catch { /* skip */ } }
    } catch (error) {
      const kind = error instanceof FetchFailure ? error.kind : "connection";
      // Default locations that do not exist are expected and are not reported as failures.
      if (!declared.length && kind === "unsupported-type") continue;
      sitemaps.push({ url: sitemapUrl, status: null, kind: "unreachable", entries: 0, truncated: false, error: explainFailure(kind) });
    }
  }
  return {
    requestedUrl: requested.href,
    origin,
    collectedAt,
    durationMs: Date.now() - started,
    home: home.page || null,
    homeFailure: home.failure || null,
    robots: { ...robots.policy, groups: robots.policy.groups.slice(0, 40).map(g => ({ ...g, rules: g.rules.slice(0, 120) })), url: origin + "/robots.txt", status: robots.status, blocksVista: !vista.allowed, blocksAll: !generic.allowed },
    sitemaps,
    sitemapUrls: [...urls.values()],
  };
}

export type LinkStatus = { url: string; status: number | null; finalUrl: string | null; redirects: number; kind?: string; message?: string };

/** Check link destinations with HEAD, falling back to GET (body discarded) when HEAD is not supported. */
export async function checkLinks(urls: string[]): Promise<LinkStatus[]> {
  return pool(urls, 5, async url => {
    try {
      let response = await fetchPublic(url, { method: "HEAD", readBody: false, timeoutMs: 7000, maxRedirects: 5 });
      if ([405, 501, 403].includes(response.status)) response = await fetchPublic(url, { method: "GET", readBody: false, timeoutMs: 7000, maxRedirects: 5 });
      return { url, status: response.status, finalUrl: response.finalUrl, redirects: response.chain.length - 1 };
    } catch (error) {
      const kind = error instanceof FetchFailure ? error.kind : "connection";
      return { url, status: null, finalUrl: null, redirects: error instanceof FetchFailure ? Math.max(0, error.chain.length - 1) : 0, kind, message: explainFailure(kind) };
    }
  });
}
