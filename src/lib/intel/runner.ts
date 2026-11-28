/**
 * Client-orchestrated, persistent and resumable multi-stage investigation runner.
 * Progress is derived from completed units of real work (pages fetched, links checked,
 * prompts sampled), never from timers. State is saved after every unit of work so a
 * reload, cancellation or failure can resume from the same point.
 */
import type { Discovery, LinkStatus, PageFailure } from "./crawl";
import { explainFailure } from "./explain";
import { analyseResponse, competitorNames, hostLabel, promptBank } from "./geo";
import { newJob, type AiObservation, type CompetitorSnapshot, type Investigation, type JobState, type StageState } from "./model";
import { siteKey, type PageRecord } from "./page";
import type { PerformanceResult } from "./psi";
import { parseRobots, robotsDecision } from "./robots";

export type RunOptions = {
  signal: AbortSignal;
  onUpdate: (inv: Investigation) => void;
  save: (inv: Investigation) => Promise<void>;
  organisationId?: string | null;
  automatedAi?: boolean;
  fetcher?: typeof fetch;
};

class Cancelled extends Error {}
class Paused extends Error {}

const skipPath = /\.(pdf|zip|jpe?g|png|gif|webp|avif|svg|mp4|mp3|webm|docx?|xlsx?|pptx?|csv|xml|json|txt|ico|css|js|woff2?)$/i;
const skipSection = /\/(logout|log-out|signout|sign-out|login|log-in|signin|register|cart|basket|checkout|account|my-account|wp-admin|wp-login|admin|search)(\/|$)/i;
export const crawlKey = (url: string) => { try { const u = new URL(url); u.hash = ""; return (u.origin + u.pathname).replace(/\/$/, "") + u.search; } catch { return url; } };

export function crawlable(url: string, site: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol) || siteKey(u.hostname) !== site) return false;
    if (skipPath.test(u.pathname) || skipSection.test(u.pathname)) return false;
    if ([...u.searchParams.keys()].some(k => !/^(page|p)$/i.test(k))) return false;
    return true;
  } catch { return false; }
}

function stage(job: JobState, id: string): StageState { return job.stages.find(s => s.id === id)!; }

export async function runInvestigation(input: Investigation, options: RunOptions): Promise<Investigation> {
  const fetcher = options.fetcher || fetch.bind(globalThis);
  const inv: Investigation = JSON.parse(JSON.stringify(input));
  if (!inv.job || !inv.job.stages?.length) inv.job = newJob();
  const job = inv.job;
  let segmentStart = Date.now();
  const elapsedBase = job.elapsedMs;
  job.status = "running";
  job.startedAt ||= new Date().toISOString();

  const tick = () => {
    job.elapsedMs = elapsedBase + (Date.now() - segmentStart);
    const restricted = inv.failures.filter(f => f.kind === "robots").length;
    const failed = inv.failures.length - restricted;
    job.counts = { pages: inv.pages.length + inv.competitors.reduce((s, c) => s + c.pages.length, 0), records: inv.pages.length + inv.failures.length + inv.links.length + inv.observations.length + inv.performance.length, sources: countSources(inv), discovered: inv.pages.length + inv.failures.length + job.frontier.length, queued: job.frontier.length, processed: inv.pages.length + failed, failed, restricted };
  };
  // Shallow snapshots keep large crawls responsive: arrays are copied, records are shared.
  const snapshot = (): Investigation => ({ ...inv, pages: inv.pages.slice(), failures: inv.failures.slice(), links: inv.links.slice(), observations: inv.observations.slice(), competitors: inv.competitors.slice(), job: { ...job, stages: job.stages.map(s => ({ ...s, errors: s.errors.slice() })), frontier: job.frontier.slice(), counts: { ...job.counts } } });
  const publish = async (persist = true) => { tick(); options.onUpdate(snapshot()); if (persist) await options.save(inv); };
  const checkAbort = () => { if (options.signal.aborted) throw new Cancelled(); };
  const begin = async (id: string, activity: string, total: number | null) => { const s = stage(job, id); s.status = "active"; s.total = total; s.done = s.done || 0; s.startedAt ||= new Date().toISOString(); job.activity = activity; await publish(); return s; };
  const finish = async (s: StageState, status: StageState["status"] = "complete", note?: string) => { s.status = status; if (note) s.note = note; s.finishedAt = new Date().toISOString(); await publish(); };
  const settled = (id: string) => ["complete", "partial", "skipped"].includes(stage(job, id).status);

  async function post<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      checkAbort();
      let response: Response;
      try { response = await fetcher(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: options.signal, credentials: "same-origin" }); }
      catch (error) { if (options.signal.aborted) throw new Cancelled(); if (attempt === 2) throw new Error("The VisTa service could not be reached. Check your connection and resume."); await wait(1500 * (attempt + 1), options.signal); continue; }
      const data = await response.json().catch(() => ({})) as T & { error?: string; retryAfter?: number };
      if (response.status === 429) {
        const seconds = Math.min(90, Number(response.headers.get("Retry-After")) || data.retryAfter || 30);
        if (attempt === 2) throw new Paused(data.error || "Processing limit reached.");
        job.activity = "Processing limit reached — resuming automatically in " + seconds + " s. Completed work is saved.";
        await publish(false);
        await wait(seconds * 1000, options.signal);
        continue;
      }
      if (!response.ok) throw new Error(data.error || "Request failed (HTTP " + response.status + ").");
      return data;
    }
    throw new Error("Request failed after retries.");
  }

  try {
    // 01–02 Connectivity, robots.txt and sitemaps. A failed home page does not end the investigation.
    if (!settled("connectivity") || !settled("architecture")) {
      const s1 = await begin("connectivity", "Connecting to " + inv.brief.website + " and reading its home page…", null);
      let discovery: Discovery;
      try { discovery = await post<Discovery>("/api/intel/discover", { url: inv.brief.website, keywords: inv.brief.keywords }); }
      catch (error) { if (error instanceof Cancelled || error instanceof Paused) throw error; s1.errors = [{ source: "Website", message: (error as Error).message, retryable: true }]; await finish(s1, "failed", (error as Error).message); throw new Error((error as Error).message); }
      inv.discovery = discovery;
      const site = siteKey(new URL(discovery.origin).hostname);
      const seen = new Set(job.visited);
      const frontier: { url: string; depth: number }[] = [];
      const enqueue = (url: string, depth: number) => { const k = crawlKey(url); if (!seen.has(k) && crawlable(url, site)) { seen.add(k); frontier.push({ url, depth }); } };
      const supplied = (inv.brief.seedUrls || []).filter(u => { try { return siteKey(new URL(u).hostname) === site; } catch { return false; } });
      let gscPages: string[] = [];
      if (inv.brief.assessment === "connected" && options.organisationId) {
        try { const r = await post<{ result: { rows?: { page?: string }[] } }>("/api/integrations", { organisationId: options.organisationId, source: "gsc", dimension: "page" }); gscPages = (r.result.rows || []).map(x => String(x.page || "")).filter(Boolean); }
        catch (error) { if (error instanceof Cancelled || error instanceof Paused) throw error; inv.firstParty.errors.push({ source: "Search Console page inventory", message: (error as Error).message, at: new Date().toISOString() }); }
      }
      if (discovery.home) {
        s1.done = 1; s1.total = 1;
        const h = discovery.home;
        const size = h.retrieval ? " · " + (h.retrieval.decodedBytes / 1048576).toFixed(1) + " MB" + (h.retrieval.encoding !== "identity" ? " (" + h.retrieval.encoding + ")" : "") + (h.retrieval.truncated ? ", first 10 MB analysed" : "") : "";
        await finish(s1, "complete", "HTTP " + h.status + " in " + h.durationMs + " ms" + (h.chain.length > 1 ? " after " + (h.chain.length - 1) + " redirect(s)" : "") + size + ".");
        if (!inv.pages.some(p => crawlKey(p.url) === crawlKey(h.url))) inv.pages.push(h);
        seen.add(crawlKey(h.url)); seen.add(crawlKey(h.finalUrl));
        for (const l of h.links.internal) enqueue(l.url, 1);
        if (h.canonical) enqueue(h.canonical, 0);
      } else {
        const failure = discovery.homeFailure;
        const nonRetryable = ["robots", "invalid-url", "blocked-address", "unsupported-type", "off-site-redirect", "too-large", "decompression-limit"];
        s1.errors = [{ source: "Home page", message: failure?.message || "The home page could not be retrieved.", retryable: !nonRetryable.includes(failure?.kind || "") && !(failure?.status && failure.status < 500 && failure.status !== 429) }];
        if (failure && !inv.failures.some(f => crawlKey(f.url) === crawlKey(failure.url))) inv.failures.push(failure);
        seen.add(crawlKey(discovery.requestedUrl));
        const alternatives = discovery.sitemapUrls.length + supplied.length + gscPages.length;
        if (!alternatives || failure?.kind === "robots") {
          await finish(s1, "failed", (failure?.message || "The home page could not be retrieved.") + (failure?.kind === "robots" ? "" : " No sitemap, supplied page or Search Console inventory is available to continue."));
          throw new Error(s1.errors[0].message);
        }
        await finish(s1, "partial", "Home page not analysed: " + (failure?.message || "unavailable") + " Continuing with alternative discovery (" + [discovery.sitemapUrls.length && discovery.sitemapUrls.length + " sitemap URLs", supplied.length && supplied.length + " supplied URLs", gscPages.length && gscPages.length + " Search Console pages"].filter(Boolean).join(", ") + ").");
      }
      const s2 = await begin("architecture", "Reading robots.txt and sitemaps…", discovery.sitemaps.length || 1);
      s2.done = discovery.sitemaps.length || 1;
      for (const u of supplied) enqueue(u, 1);
      for (const e of discovery.sitemapUrls) enqueue(e.loc, -1);
      for (const u of gscPages) enqueue(u, -1);
      job.frontier = [...job.frontier.filter(f => !seen.has(crawlKey(f.url))), ...frontier];
      const queuedKeys = new Set(frontier.map(f => crawlKey(f.url)));
      job.visited = [...seen].filter(k => !queuedKeys.has(k));
      s2.errors = discovery.sitemaps.filter(s => s.kind === "unreachable" || s.kind === "invalid").map(s => ({ source: "Sitemap " + s.url, message: s.error || s.kind, retryable: false }));
      const robotsNote = discovery.robots.state === "found" ? "robots.txt found" + (discovery.robots.blocksVista ? " (restricts VisTa — respected)" : "") : discovery.robots.state === "missing" ? "No robots.txt (all crawling allowed)" : "robots.txt unavailable (crawling paused per RFC 9309)";
      await finish(s2, s2.errors.length ? "partial" : "complete", robotsNote + " · " + discovery.sitemapUrls.length + " sitemap URLs" + (discovery.sitemaps.some(s => s.truncated) ? " (large sitemap sampled)" : "") + " · " + (discovery.home?.links.internal.length ?? 0) + " links on home page" + (supplied.length ? " · " + supplied.length + " supplied URLs" : "") + (gscPages.length ? " · " + gscPages.length + " Search Console pages" : "") + ".");
    }

    // 03 Crawl pages breadth-first within the page budget, with targeted retries of transient failures.
    if (!settled("crawl")) {
      const discovery = inv.discovery!;
      const policy = { ...parseRobots(""), ...discovery.robots };
      const limit = inv.brief.pageLimit;
      const site = siteKey(new URL(discovery.origin).hostname);
      const s3 = await begin("crawl", "Crawling pages…", Math.min(limit, inv.pages.length + job.frontier.length));
      const visited = new Set(job.visited);
      const crawled = new Set(inv.pages.flatMap(p => [crawlKey(p.url), crawlKey(p.finalUrl)]));
      const queued = new Map(job.frontier.map(f => [crawlKey(f.url), f]));
      const retries = new Map<string, number>();
      const transientKinds = new Set(["timeout", "connection"]);
      const enqueue = (url: string, depth: number) => {
        const k = crawlKey(url);
        if (visited.has(k) || crawled.has(k) || !crawlable(url, site)) return;
        const existing = queued.get(k);
        if (existing) { if (existing.depth < 0 && depth >= 0) existing.depth = depth; return; }
        if (queued.size >= 20000) return;
        const entry = { url, depth };
        queued.set(k, entry); job.frontier.push(entry);
      };
      while (job.frontier.length && inv.pages.length < limit) {
        checkAbort();
        // Breadth-first: linked pages by depth before sitemap-only URLs.
        job.frontier.sort((a, b) => (a.depth < 0 ? 99 : a.depth) - (b.depth < 0 ? 99 : b.depth));
        const batch: { url: string; depth: number }[] = [];
        while (job.frontier.length && batch.length < Math.min(6, limit - inv.pages.length)) {
          const next = job.frontier.shift()!;
          const k = crawlKey(next.url);
          queued.delete(k);
          visited.add(k);
          if (!robotsDecision(policy, next.url, "VistaSiteIntelligence/0.3").allowed) { inv.failures.push({ url: next.url, depth: next.depth, kind: "robots", message: explainFailure("robots"), chain: [] }); continue; }
          batch.push(next);
        }
        if (!batch.length) continue;
        job.activity = "Inspecting " + batch.map(b => new URL(b.url).pathname).join(", ").slice(0, 140);
        await publish(false);
        const renderBudget = inv.brief.renderJs ? Math.max(0, 20 - inv.pages.filter(p => p.retrieval?.rendered).length) : 0;
        const result = await post<{ pages: PageRecord[]; failures: PageFailure[]; deferred?: string[] }>("/api/intel/pages", { urls: batch.map(b => b.url), depths: batch.map(b => Math.max(0, b.depth)), keywords: inv.brief.keywords, ...(renderBudget ? { render: batch.slice(0, Math.min(2, renderBudget)).map(b => b.url) } : {}) });
        for (const p of result.pages) {
          const requested = batch.find(b => crawlKey(b.url) === crawlKey(p.url));
          const page = requested && requested.depth < 0 ? { ...p, depth: -1 } : p;
          const fk = crawlKey(page.finalUrl);
          if (!crawled.has(fk)) { inv.pages.push(page); crawled.add(fk); crawled.add(crawlKey(page.url)); }
          visited.add(fk);
          const depth = page.depth < 0 ? -1 : page.depth + 1;
          if (inv.brief.maxDepth === undefined || depth < 0 || depth <= inv.brief.maxDepth) for (const link of page.links.internal) enqueue(link.url, depth);
          if (page.canonical) enqueue(page.canonical, page.depth);
        }
        for (const f of result.failures) {
          const k = crawlKey(f.url);
          const tries = retries.get(k) || 0;
          const transientFailure = transientKinds.has(f.kind) || f.status === 429 || (f.status !== undefined && f.status >= 500);
          if (transientFailure && tries < 1) { retries.set(k, tries + 1); visited.delete(k); enqueue(f.url, f.depth); continue; }
          inv.failures.push(f);
        }
        for (const url of result.deferred || []) { const b = batch.find(x => x.url === url); if (b) { visited.delete(crawlKey(url)); enqueue(url, b.depth); } }
        job.visited = [...visited];
        s3.done = inv.pages.length;
        s3.total = Math.min(limit, inv.pages.length + job.frontier.length);
        await publish();
      }
      const blocked = inv.failures.filter(f => f.kind === "robots").length;
      const errors = inv.failures.filter(f => f.kind !== "robots").length;
      s3.errors = inv.failures.filter(f => f.kind !== "robots").slice(0, 40).map(f => ({ source: f.url, message: f.message, retryable: isRetryable(f) }));
      if (!inv.pages.length) { await finish(s3, "failed", "No page could be analysed. " + (s3.errors[0]?.message || "")); throw new Error("No page could be analysed; see the explained failures."); }
      await finish(s3, errors ? "partial" : "complete", inv.pages.length + " pages analysed" + (errors ? ", " + errors + " failed" : "") + (blocked ? ", " + blocked + " restricted by robots.txt" : "") + (job.frontier.length ? "; " + job.frontier.length + " more URLs beyond the page budget." : "; inventory exhausted."));
    }

    // 04 Technical SEO: link destinations and PageSpeed Insights.
    if (!settled("technical")) {
      const crawled = new Set(inv.pages.flatMap(p => [crawlKey(p.url), crawlKey(p.finalUrl)]));
      const failed = new Set(inv.failures.map(f => crawlKey(f.url)));
      const checked = new Set(inv.links.map(l => crawlKey(l.url)));
      const site = siteKey(new URL(inv.discovery!.origin).hostname);
      const internalTargets = [...new Set(inv.pages.flatMap(p => p.links.internal.map(l => l.url)))].filter(u => { const k = crawlKey(u); return !crawled.has(k) && !failed.has(k) && !checked.has(k) && crawlable(u, site); });
      const externalTargets = inv.brief.includeExternalLinks ? [...new Set(inv.pages.flatMap(p => p.links.external.map(l => l.url)))].filter(u => !checked.has(crawlKey(u)) && /^https?:/.test(u)) : [];
      const budget = Math.max(0, inv.brief.linkCheckLimit - inv.links.length);
      const targets = [...internalTargets, ...externalTargets].slice(0, budget);
      const perfTargets = inv.pages.filter(p => p.status === 200).sort((a, b) => (a.depth === 0 ? -1 : 0) - (b.depth === 0 ? -1 : 0) || ["product", "service", "course", "category", "pricing"].indexOf(b.pageType) - ["product", "service", "course", "category", "pricing"].indexOf(a.pageType)).slice(0, inv.brief.performancePages).map(p => p.finalUrl);
      const perfJobs = perfTargets.flatMap((url, i) => (i === 0 ? [{ url, strategy: "mobile" as const }, { url, strategy: "desktop" as const }] : [{ url, strategy: "mobile" as const }])).filter(j => !inv.performance.some(p => p.url === j.url && p.strategy === j.strategy));
      const s4 = await begin("technical", "Checking link destinations…", targets.length + perfJobs.length + 1);
      for (let i = 0; i < targets.length; i += 25) {
        checkAbort();
        const batch = targets.slice(i, i + 25);
        job.activity = "Checking " + batch.length + " link destinations (" + (i + batch.length) + " of " + targets.length + ")…";
        const result = await post<{ links: LinkStatus[] }>("/api/intel/links", { urls: batch });
        inv.links.push(...result.links);
        s4.done += batch.length;
        await publish();
      }
      for (const jobItem of perfJobs) {
        checkAbort();
        job.activity = "Measuring " + jobItem.strategy + " performance for " + new URL(jobItem.url).pathname + " (PageSpeed Insights)…";
        await publish(false);
        try { inv.performance.push(await post<PerformanceResult>("/api/intel/performance", jobItem)); }
        catch (error) { if (error instanceof Cancelled || error instanceof Paused) throw error; s4.errors.push({ source: "PageSpeed Insights (" + jobItem.strategy + ")", message: (error as Error).message, retryable: true }); }
        s4.done += 1;
        await publish();
      }
      s4.done += 1;
      await finish(s4, s4.errors.length ? "partial" : "complete", inv.links.length + " link destinations checked; " + inv.performance.length + " performance tests" + (s4.errors.length ? "; " + s4.errors.length + " source error(s)" : "") + ".");
    }

    // 05–06 Content and authority are computed from the crawled evidence.
    for (const [id, label] of [["content", "Evaluating content quality, clusters and GEO readiness…"], ["authority", "Assessing entity, trust and security signals…"]] as const) {
      if (settled(id)) continue;
      const s = await begin(id, label, inv.pages.length);
      s.done = inv.pages.length;
      await finish(s, inv.pages.length ? "complete" : "skipped", inv.pages.length + " pages assessed" + (id === "authority" ? "; backlink and mention data require a licensed provider." : "."));
    }

    // 07 Competitors: discovery plus a small, equal page sample each.
    if (!settled("competitive")) {
      const competitors = inv.brief.competitors.filter(Boolean).slice(0, 10);
      if (!competitors.length) { const s = await begin("competitive", "No competitors supplied.", 0); await finish(s, "skipped", "Add competitor websites in the brief to compare positioning."); }
      else {
        const per = inv.brief.mode === "quick" ? 2 : inv.brief.mode === "deep" ? 5 : 10;
        const s7 = await begin("competitive", "Investigating competitors…", competitors.length * per);
        for (const website of competitors) {
          checkAbort();
          if (inv.competitors.some(c => c.website === website && c.pages.length)) { s7.done += per; continue; }
          job.activity = "Investigating " + website + "…";
          await publish(false);
          try {
            const d = await post<Discovery>("/api/intel/discover", { url: website, keywords: inv.brief.keywords });
            const snapshot: CompetitorSnapshot = { website, name: brandName(d.home, website), discovery: { origin: d.origin, robots: d.robots, sitemaps: d.sitemaps, collectedAt: d.collectedAt, sitemapCount: d.sitemapUrls.length }, pages: d.home ? [d.home] : [], failures: d.homeFailure ? [d.homeFailure] : [] };
            const site = siteKey(new URL(d.origin).hostname);
            const candidates = (d.home?.links.internal.map(l => l.url) || []).filter(u => crawlable(u, site) && crawlKey(u) !== crawlKey(d.home!.finalUrl));
            const unique = [...new Map(candidates.map(u => [crawlKey(u), u])).values()].slice(0, per - snapshot.pages.length);
            s7.done += 1;
            if (unique.length) { const r = await post<{ pages: PageRecord[]; failures: PageFailure[] }>("/api/intel/pages", { urls: unique.slice(0, 6), depths: unique.map(() => 1), keywords: inv.brief.keywords }); snapshot.pages.push(...r.pages); snapshot.failures.push(...r.failures); if (unique.length > 6) { const r2 = await post<{ pages: PageRecord[]; failures: PageFailure[] }>("/api/intel/pages", { urls: unique.slice(6, 12), depths: unique.slice(6).map(() => 1), keywords: inv.brief.keywords }); snapshot.pages.push(...r2.pages); snapshot.failures.push(...r2.failures); } }
            s7.done += Math.max(0, per - 1);
            inv.competitors = [...inv.competitors.filter(c => c.website !== website), snapshot];
            if (!d.home) s7.errors.push({ source: website, message: d.homeFailure?.message || "Home page unavailable.", retryable: true });
          } catch (error) { if (error instanceof Cancelled || error instanceof Paused) throw error; s7.errors.push({ source: website, message: (error as Error).message, retryable: true }); s7.done += per; }
          await publish();
        }
        await finish(s7, s7.errors.length ? "partial" : "complete", inv.competitors.filter(c => c.pages.length).length + " of " + competitors.length + " competitors sampled (" + per + " pages each, equal sample).");
      }
    }

    // 08 AI search visibility (authorised API sampling) — never simulated.
    if (!settled("ai")) {
      const bank = promptBank(inv.brief, inv.competitors).slice(0, inv.brief.aiPromptBudget);
      if (!options.automatedAi || !options.organisationId || !bank.length) {
        const s = await begin("ai", "AI sampling not authorised for this run.", 0);
        await finish(s, "skipped", (inv.observations.length ? inv.observations.length + " recorded observations retained. " : "") + (!options.organisationId ? "Sign in as an authorised organisation owner to sample through the OpenAI API, or record verified manual observations in the GEO tab." : "Automated AI sampling was not selected for this run."));
      } else {
        const remaining = bank.filter(b => !inv.observations.some(o => o.prompt === b.prompt && o.method === "automated"));
        const s8 = await begin("ai", "Sampling AI search answers…", bank.length);
        s8.done = bank.length - remaining.length;
        for (const item of remaining) {
          checkAbort();
          job.activity = "Sampling: “" + item.prompt.slice(0, 90) + "”";
          await publish(false);
          try {
            const r = await post<{ provider: string; model: string; surface: "api"; response: string; citations: { url: string; title: string }[]; collectedAt: string; methodology: string; limitations: string }>("/api/intel/ai-sample", { organisationId: options.organisationId, prompt: item.prompt, webSearch: true });
            const analysis = analyseResponse(r.response, inv.brief, r.citations, competitorNames(inv.brief, inv.competitors));
            const observation: AiObservation = { id: crypto.randomUUID(), provider: r.provider, model: r.model, surface: "api", method: "automated", prompt: item.prompt, category: item.category, market: item.market, language: "en", collectedAt: r.collectedAt, response: r.response, ...analysis, citations: r.citations, inaccurate: null, accuracyNote: "", methodology: r.methodology, limitations: r.limitations };
            inv.observations.push(observation);
          } catch (error) {
            if (error instanceof Cancelled || error instanceof Paused) throw error;
            s8.errors.push({ source: "OpenAI API", message: (error as Error).message, retryable: true });
            if (s8.errors.length >= 3) break;
          }
          s8.done += 1;
          await publish();
        }
        await finish(s8, s8.errors.length ? "partial" : "complete", inv.observations.filter(o => o.method === "automated").length + " API observations; consumer AI products require manual capture.");
      }
    }

    // 09 Commercial opportunities: connected first-party data where authorised.
    if (!settled("commercial")) {
      const connected = inv.brief.assessment === "connected" && options.organisationId;
      const s9 = await begin("commercial", connected ? "Retrieving authorised Search Console and GA4 data…" : "Identifying commercial opportunities from public evidence…", connected ? 2 : 1);
      if (connected) {
        for (const source of ["gsc", "ga4"] as const) {
          checkAbort();
          try {
            const r = await post<{ result: { observedAt?: string; scope?: string; rows?: unknown[]; queries?: unknown[]; channels?: unknown[] } }>("/api/integrations", { organisationId: options.organisationId, source });
            if (source === "gsc") inv.firstParty.gsc = normaliseGsc(r.result);
            else inv.firstParty.ga4 = normaliseGa4(r.result);
          } catch (error) {
            if (error instanceof Cancelled || error instanceof Paused) throw error;
            const message = (error as Error).message;
            inv.firstParty.errors.push({ source: source === "gsc" ? "Google Search Console" : "Google Analytics 4", message, at: new Date().toISOString() });
            s9.errors.push({ source: source === "gsc" ? "Google Search Console" : "Google Analytics 4", message, retryable: true });
          }
          s9.done += 1;
          await publish();
        }
      } else s9.done = 1;
      await finish(s9, connected ? (s9.errors.length ? "partial" : "complete") : "complete", connected ? (inv.firstParty.gsc ? inv.firstParty.gsc.rows.length + " Search Console queries. " : "") + (inv.firstParty.ga4 ? inv.firstParty.ga4.rows.length + " GA4 channels." : "") : "Prospect assessment: opportunities are derived from public evidence; no first-party outcomes are claimed.");
    }

    // 10–12 Recommendations, dashboards and report model (computed from saved evidence).
    for (const [id, label] of [["recommendations", "Prioritising interventions and building the 30/60/90-day roadmap…"], ["dashboards", "Assembling engine dashboards and the Intelligence Index…"], ["reports", "Preparing executive report content…"]] as const) {
      if (settled(id)) continue;
      const s = await begin(id, label, 1);
      s.done = 1;
      await finish(s, "complete", id === "reports" ? "Report content ready. Open Executive Studio to generate PowerPoint, PDF and Excel files." : "");
    }
    job.gaps = evidenceGaps(inv);
    job.status = job.gaps.length ? "partial" : "complete";
    job.activity = job.gaps.length ? "Partially complete — " + job.gaps.length + " evidence " + (job.gaps.length === 1 ? "gap" : "gaps") + ". " + job.gaps[0] : "Investigation complete.";
    await publish();
    return inv;
  } catch (error) {
    const active = job.stages.find(s => s.status === "active");
    if (error instanceof Cancelled) { job.status = "cancelled"; job.activity = "Cancelled. Completed work is saved and can be resumed."; if (active) active.status = "pending"; }
    else if (error instanceof Paused) { job.status = "paused"; job.activity = (error as Error).message + " Resume when ready; completed work is saved."; if (active) active.status = "pending"; }
    else { job.status = "failed"; job.activity = (error as Error).message; if (active) { active.status = "failed"; active.errors.push({ source: "Processing", message: (error as Error).message, retryable: true }); } }
    segmentStart = Date.now() - (job.elapsedMs - elapsedBase);
    await publish();
    return inv;
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Cancelled()); }, { once: true });
  });
}

function countSources(inv: Investigation): number {
  return [inv.discovery, inv.discovery?.sitemaps.length, inv.links.length, inv.performance.length, inv.competitors.length, inv.observations.length, inv.firstParty.gsc, inv.firstParty.ga4].filter(Boolean).length;
}

type Loose = Record<string, unknown>;
function normaliseGsc(result: Loose) {
  const rows = (Array.isArray(result.rows) ? result.rows : Array.isArray(result.queries) ? result.queries : []) as Loose[];
  return { collectedAt: String(result.observedAt || new Date().toISOString()), scope: "Search Console " + String(result.site || "authorised property") + (result.period ? " · " + JSON.stringify(result.period).replace(/["{}]/g, "").replace(/,/g, " to ") : "") + " · top queries returned by the API", rows: rows.map(r => ({ query: String(r.query ?? (Array.isArray(r.keys) ? r.keys[0] : "")), clicks: Number(r.clicks) || 0, impressions: Number(r.impressions) || 0, ctr: Number(r.ctr) || 0, position: Number(r.position) || 0 })).filter(r => r.query) };
}
function normaliseGa4(result: Loose) {
  const rows = (Array.isArray(result.rows) ? result.rows : Array.isArray(result.channels) ? result.channels : []) as Loose[];
  return { collectedAt: String(result.observedAt || new Date().toISOString()), scope: "GA4 property " + String(result.property || "") + " · " + String(result.scope || "channels") + (result.period ? " · " + JSON.stringify(result.period).replace(/["{}]/g, "").replace(/,/g, " to ") : ""), rows: rows.map(r => ({ channel: String(r.label ?? r.channel ?? "Unassigned") || "Unassigned", sessions: Number(r.sessions) || 0, users: Number(r.totalUsers ?? r.users) || 0, keyEvents: Number(r.keyEvents ?? r.conversions) || 0 })) };
}

/** Brand name of a crawled website: declared organisation name, then the title's brand segment, then the domain label. */
export function brandName(home: PageRecord | null, website: string): string {
  const declared = home?.schema.organisation?.name;
  if (declared && declared.length <= 60) return declared;
  const segments = (home?.title || "").split(/\s[|–—-]\s/).map(s => s.trim()).filter(Boolean);
  const candidate = segments.length > 1 ? segments.sort((a, b) => a.length - b.length)[0] : "";
  if (candidate && candidate.length <= 40 && !/^\d+$/.test(candidate)) return candidate;
  return hostLabel(website);
}

/** Only transient conditions are worth retrying: timeouts, dropped connections, DNS hiccups, HTTP 429 and 5xx. */
export function isRetryable(f: PageFailure): boolean {
  if (f.kind === "http-error") return f.status === 429 || (f.status !== undefined && f.status >= 500);
  return f.kind === "timeout" || f.kind === "connection" || f.kind === "dns";
}

/** What is missing from an investigation; a non-empty list means the audit is partial, never complete. */
export function evidenceGaps(inv: Investigation): string[] {
  const gaps: string[] = [];
  const failed = inv.failures.filter(f => f.kind !== "robots");
  const restricted = inv.failures.length - failed.length;
  if (!inv.discovery?.home) gaps.push("The home page could not be analysed.");
  if (failed.length) gaps.push(failed.length + " page" + (failed.length === 1 ? "" : "s") + " failed (" + [...new Set(failed.map(f => f.kind === "http-error" ? "HTTP " + f.status : f.kind))].slice(0, 4).join(", ") + ").");
  if (restricted) gaps.push(restricted + " URL" + (restricted === 1 ? " was" : "s were") + " excluded by robots.txt.");
  const unvisited = inv.job.frontier.length;
  if (unvisited) gaps.push("Page budget reached: " + inv.pages.length.toLocaleString("en-GB") + " pages analysed and " + unvisited.toLocaleString("en-GB") + " further discovered URL" + (unvisited === 1 ? " was" : "s were") + " not visited. Raise the page budget or use a deeper audit mode for full coverage.");
  for (const stage of inv.job.stages.filter(s => s.status === "partial" && s.id !== "crawl" && s.id !== "connectivity")) {
    const sources = [...new Set(stage.errors.map(e => e.source.replace(/\s*\((mobile|desktop)\)$/, "")))];
    gaps.push(stage.label + " is incomplete" + (sources.length ? ": " + sources.slice(0, 3).join(", ") + " unavailable" : "") + ".");
  }
  const truncated = inv.pages.filter(p => p.retrieval?.truncated);
  if (truncated.length) gaps.push(truncated.length + " page" + (truncated.length === 1 ? " was" : "s were") + " larger than the " + Math.max(1, Math.round(Math.max(...truncated.map(p => p.retrieval!.retainedBytes)) / 1048576)) + " MB analysis window; only the retained portion was analysed.");
  return gaps;
}

/** Prepare a targeted retry: retryable failed pages go back to the queue and dependent stages re-run. */
export function prepareRetry(input: Investigation): Investigation {
  const retry = input.failures.filter(isRetryable);
  const keep = input.failures.filter(f => !isRetryable(f));
  const rerun = new Set(["crawl", "technical", "content", "authority", "recommendations", "dashboards", "reports"]);
  const homeFailed = !input.discovery?.home && retry.some(f => f.depth === 0);
  return {
    ...input,
    failures: keep,
    job: {
      ...input.job,
      status: "paused",
      activity: retry.length + " failed page" + (retry.length === 1 ? "" : "s") + " queued for retry.",
      visited: (() => { const keys = new Set(retry.map(f => crawlKey(f.url))); return input.job.visited.filter(k => !keys.has(k)); })(),
      frontier: [...retry.map(f => ({ url: f.url, depth: f.depth })), ...input.job.frontier],
      stages: input.job.stages.map(s => (rerun.has(s.id) || (homeFailed && (s.id === "connectivity" || s.id === "architecture"))) ? { ...s, status: "pending", errors: [], note: "", done: s.id === "technical" ? s.done : 0 } : s),
    },
  };
}
