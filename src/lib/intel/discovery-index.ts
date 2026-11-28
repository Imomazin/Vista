/**
 * VisTa Index in Intelligent Discovery: the domain's Common Crawl history (capture counts and dates
 * per crawl) and archived-versus-live comparisons of priority pages. Historical evidence is dated
 * by its capture; derived observations only.
 */
import type { CcCapture, CcDomainResult } from "./commoncrawl";
import { compareObservations, observe, pageKey, type Comparison, type Observation } from "./observations";
import type { PageRecord } from "./page";
import type { DiscoveryRun } from "./discovery-model";

export type ArchiveCrawl = { crawl: string; capturedUrls: number; first: string; last: string; truncated: boolean; error?: string };
export type DiscoveryIndex = {
  computedAt: string;
  archive: { source: "Common Crawl"; terms: string; method: string; limitation: string; crawls: ArchiveCrawl[]; error?: string; skipped?: string; notInInventory: string[]; requests: number };
  comparisons: Comparison[];
  observations: Observation[];
};

type Post = <T>(path: string, body: unknown) => Promise<T>;

export async function archiveIndex(run: DiscoveryRun, post: Post, maxComparisons = 4): Promise<DiscoveryIndex> {
  const index: DiscoveryIndex = { computedAt: new Date().toISOString(), archive: { source: "Common Crawl", terms: "https://commoncrawl.org/terms-of-use", method: "", limitation: "", crawls: [], notInInventory: [], requests: 0 }, comparisons: [], observations: run.pages.map(p => observe(p, "vista")) };
  let crawls: (CcDomainResult & { error?: string })[];
  const host = new URL(run.website).hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === "localhost" || !host.includes(".")) { index.archive.skipped = "Not applicable: the website address is not a public domain name."; return index; }
  try {
    const r = await post<{ crawls: (CcDomainResult & { error?: string })[]; method: string; limitation: string; terms: string }>("/api/intel/archive", { domain: host, crawls: 3 });
    crawls = r.crawls;
    index.archive.method = r.method; index.archive.limitation = r.limitation; index.archive.terms = r.terms;
  } catch (error) {
    index.archive.error = (error as Error).message;
    return index;
  }
  index.archive.crawls = crawls.map(c => ({ crawl: c.crawl, capturedUrls: c.uniqueUrls, first: c.first, last: c.last, truncated: c.truncated, ...(c.error ? { error: c.error } : {}) }));
  index.archive.requests = crawls.reduce((n, c) => n + (c.requests || 0), 0);
  // Archived pages VisTa did not find in the sitemap or links (inventory beyond the sitemap).
  const known = new Set([...(run.site?.sitemapUrls || []).map(u => pageKey(u.loc)), ...run.pages.map(p => pageKey(p.finalUrl)), ...(run.site?.home?.links.internal || []).map(l => pageKey(l.url))]);
  const latest = crawls.find(c => c.captures.length) || null;
  index.archive.notInInventory = latest ? [...new Set(latest.captures.filter(c => c.status === 200 && /html/.test(c.mime) && !known.has(pageKey(c.url))).map(c => c.url))].slice(0, 30) : [];
  // Archived versus live: priority pages first, the home page always included when archived.
  const byKey = new Map<string, CcCapture>();
  for (const c of crawls) for (const cap of c.captures) if (cap.status === 200 && /html/.test(cap.mime) && cap.length <= 4_000_000 && !byKey.has(pageKey(cap.url))) byKey.set(pageKey(cap.url), cap);
  const live = new Map(run.pages.filter(p => p.status === 200).map(p => [pageKey(p.finalUrl), p] as [string, PageRecord]));
  const order = [run.website, ...run.priorityPages.filter(p => p.selected).map(p => p.url)];
  const targets = [...new Set(order.map(pageKey))].filter(k => byKey.has(k) && live.has(k)).slice(0, maxComparisons);
  for (const key of targets) {
    const cap = byKey.get(key)!;
    try {
      const r = await post<{ page: PageRecord; capturedAt: string; crawl: string; truncated?: boolean }>("/api/intel/archive", { capture: { filename: cap.filename, offset: cap.offset, length: cap.length, url: cap.url, crawl: cap.crawl } });
      const archived = observe(r.page, "common-crawl", cap.crawl);
      index.observations.push(archived);
      index.comparisons.push(compareObservations(archived, observe(live.get(key)!, "vista"), { beforePartial: Boolean(r.truncated) }));
    } catch (error) {
      index.comparisons.push({ url: cap.url, before: { at: "", source: "common-crawl", crawl: cap.crawl }, after: { at: live.get(key)!.fetchedAt, source: "vista" }, similarity: null, unchanged: false, changes: [{ field: "error", label: "Archived copy unavailable", before: "", after: (error as Error).message, major: false }] });
    }
  }
  return index;
}
