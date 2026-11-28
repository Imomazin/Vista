/**
 * Browser-orchestrated Intelligent Discovery. Eight stages, each made of bounded server requests;
 * progress counts completed units only, the run is checkpointed after every unit and resumes from
 * the first unfinished stage. AI assistance and search providers are optional: without them the
 * recommendations use website evidence only and the limitation is recorded.
 */
import type { Discovery, PageFailure } from "./crawl";
import type { AiObservation, StageState } from "./model";
import type { PageRecord } from "./page";
import { siteKey } from "./page";
import { buildProfile, evidencePack, mergeAiProfile, type AiProfile } from "./discovery-profile";
import { assessCompetitor, citationSources, geoEvidence, hostOf, isPlatform, offeringVocabulary, relevantLinks, serpCompetitors, type Candidate } from "./discovery-competitors";
import { keywordUniverse, promptRecs, promptTemplates } from "./discovery-keywords";
import { priorityPages, recommendScope } from "./discovery-scope";
import { marketPhrase, type CompetitorKind, type CompetitorRec, type DiscoveryRun, type KeywordRec } from "./discovery-model";
import { mentions, recommendationPosition } from "./geo";

export type DiscoveryCapabilities = { discoveryAi: string; search: string | null };
export type DiscoveryOptions = { signal: AbortSignal; fetcher?: typeof fetch; onUpdate?: (run: DiscoveryRun) => void; save?: (run: DiscoveryRun) => Promise<void>; capabilities: DiscoveryCapabilities; organisationId?: string | null; wait?: (ms: number) => Promise<void> };

class Cancelled extends Error {}
class HttpError extends Error { constructor(message: string, public status: number, public retryAfter = 0) { super(message); } }

export function resetFrom(run: DiscoveryRun, stageId: string): DiscoveryRun {
  const index = run.stages.findIndex(s => s.id === stageId);
  if (index < 0) return run;
  const stages = run.stages.map((s, i) => i >= index ? { ...s, status: "pending" as const, done: 0, total: null, note: "", errors: [] } : s);
  const order = ["identify", "offerings", "audiences", "competitors", "keywords", "prompts", "pages", "scope"];
  const from = order.indexOf(stageId);
  return {
    ...run, stages, status: "idle", gaps: [],
    ...(from <= 0 ? { site: null, pages: [], failures: [] } : {}),
    ...(from <= 1 ? { profile: null, aiPrompts: undefined } : {}),
    ...(from <= 3 ? { competitors: [], citationSources: [], competitorHomes: {}, clientRanks: [] } : {}),
    ...(from <= 4 ? { keywords: [] } : {}),
    ...(from <= 5 ? { prompts: [], samples: [] } : {}),
    ...(from <= 6 ? { priorityPages: [] } : {}),
    scope: null,
  };
}

export async function runDiscovery(input: DiscoveryRun, options: DiscoveryOptions): Promise<DiscoveryRun> {
  const run: DiscoveryRun = { ...input, stages: input.stages.map(s => ({ ...s, errors: [...s.errors] })), status: "running" };
  const fetcher = options.fetcher || fetch;
  const wait = options.wait || (ms => new Promise(r => setTimeout(r, ms)));
  const started = Date.now() - run.elapsedMs;
  const aiOn = run.settings.useAi && options.capabilities.discoveryAi !== "off" && (options.capabilities.discoveryAi === "public" || run.settings.member);
  const publish = async (save = true) => {
    run.elapsedMs = Date.now() - started; run.updatedAt = new Date().toISOString();
    const copy: DiscoveryRun = { ...run, stages: run.stages.map(s => ({ ...s })), competitors: run.competitors.slice(), keywords: run.keywords.slice(), prompts: run.prompts.slice(), pages: run.pages.slice(), samples: run.samples.slice(), priorityPages: run.priorityPages.slice() };
    options.onUpdate?.(copy);
    if (save && options.save) await options.save(copy);
  };
  const check = () => { if (options.signal.aborted) throw new Cancelled("Discovery cancelled."); };
  const post = async <T>(path: string, body: unknown, attempt = 0): Promise<T> => {
    check();
    let response: Response;
    try { response = await fetcher(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: options.signal }); }
    catch (error) { if (options.signal.aborted) throw new Cancelled("Discovery cancelled."); throw new HttpError("The VisTa service could not be reached: " + (error as Error).message, 0); }
    const data = await response.json().catch(() => ({})) as T & { error?: string; retryAfter?: number };
    if (response.status === 429 && attempt === 0 && /^\/api\/intel\/(discover|pages|verify)$/.test(path)) { await wait(Math.min(30, Number(data.retryAfter) || 10) * 1000); return post<T>(path, body, 1); }
    if (!response.ok) throw new HttpError(data.error || "Request failed (HTTP " + response.status + ").", response.status);
    return data;
  };
  const stage = (id: string) => run.stages.find(s => s.id === id)!;
  const settled = (id: string) => ["complete", "partial", "skipped"].includes(stage(id).status);
  const begin = async (id: string, activity: string, total: number | null) => { const s = stage(id); s.status = "active"; s.total = total; s.done = s.done || 0; s.startedAt ||= new Date().toISOString(); run.activity = activity; await publish(false); return s; };
  const finish = async (s: StageState, status: StageState["status"], note: string) => { s.status = status; s.note = note; s.finishedAt = new Date().toISOString(); if (s.total !== null) s.done = s.total; await publish(); };
  const brandNames = () => run.profile ? [run.profile.brand.value, ...run.profile.aliases.filter(a => a.selected).map(a => a.value)] : [];

  try {
    // 1. Identify the business: home page, robots.txt, sitemaps, then a representative page sample.
    if (!settled("identify")) {
      const s = await begin("identify", "Retrieving " + run.website.replace(/^https?:\/\//, "") + "…", null);
      const site = await post<Discovery>("/api/intel/discover", { url: run.website });
      run.site = { ...site, home: null };
      const key = siteKey(new URL(site.origin).hostname);
      const same = (u: string) => { try { return siteKey(new URL(u).hostname) === key; } catch { return false; } };
      const plan: string[] = [];
      const add = (u: string) => { const clean = u.split("#")[0]; if (same(clean) && !plan.includes(clean) && clean.replace(/\/$/, "") !== site.origin && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(clean) && !/\/(privacy|terms|cookie|login|account|cart|basket|checkout|wp-admin|tag|author)(\/|$|-)/i.test(clean)) plan.push(clean); };
      if (site.home) {
        run.pages = [site.home];
        for (const n of site.home.business?.nav || []) add(n.url);
        for (const c of site.home.business?.ctas || []) if (c.url) add(c.url);
        for (const f of site.home.business?.footer || []) if (/about|contact|pricing|fees|accredit|review|testimonial|team/i.test(f.text + f.url)) add(f.url);
      }
      // One or two representatives from each sitemap section, shortest paths first.
      const sections = new Map<string, string[]>();
      for (const e of site.sitemapUrls.slice(0, 2000)) { try { const seg = new URL(e.loc).pathname.split("/").filter(Boolean)[0] || "/"; sections.set(seg, [...(sections.get(seg) || []), e.loc]); } catch { /* ignore */ } }
      for (const [, urls] of [...sections.entries()].sort((a, b) => b[1].length - a[1].length)) for (const u of urls.sort((a, b) => a.length - b.length).slice(0, 2)) add(u);
      const sample = plan.slice(0, site.home ? 15 : 16);
      s.total = sample.length + 1; s.done = site.home ? 1 : 0;
      if (!site.home) s.errors.push({ source: "Home page", message: site.homeFailure?.message || "The home page could not be retrieved.", retryable: true });
      await publish();
      for (let i = 0; i < sample.length; i += 6) {
        const batch = sample.slice(i, i + 6);
        run.activity = "Reading " + batch.map(u => new URL(u).pathname).join(", ").slice(0, 120);
        try {
          const r = await post<{ pages: PageRecord[]; failures: PageFailure[] }>("/api/intel/pages", { urls: batch, depths: batch.map(() => 1), keywords: [] });
          for (const p of r.pages) if (!run.pages.some(x => x.finalUrl === p.finalUrl)) run.pages.push(p);
          run.failures.push(...r.failures);
        } catch (error) { if (error instanceof Cancelled) throw error; s.errors.push({ source: "Page sample", message: (error as Error).message, retryable: true }); }
        s.done = Math.min(s.total!, s.done + batch.length);
        await publish();
      }
      if (!run.pages.length) { await finish(s, "failed", site.homeFailure?.message || "No pages could be retrieved from the website."); throw new HttpError(s.note, 422); }
      await finish(s, site.home ? (s.errors.length ? "partial" : "complete") : "partial", (site.home ? "Home page retrieved" : "Home page unavailable; continued from the sitemap") + " · " + run.pages.length + " pages sampled · " + site.sitemapUrls.length + " sitemap URLs" + (site.robots.state === "found" ? " · robots.txt respected" : ""));
    }

    // 2. Products and services (deterministic, then AI interpretation grounded in the fetched pages).
    if (!settled("offerings")) {
      const s = await begin("offerings", "Mapping products and services…", aiOn ? 2 : 1);
      run.profile = buildProfile(run.pages, run.site, run.website);
      s.done = 1;
      await publish(false);
      if (aiOn) {
        try {
          run.activity = "Interpreting the business with AI (grounded in the sampled pages)…";
          await publish(false);
          const pack = evidencePack(run.pages, run.site, run.website);
          let r: { profile: AiProfile; model: string };
          try { r = await post<{ profile: AiProfile; model: string }>("/api/intel/discovery/profile", { pack }); }
          catch (error) { if (error instanceof Cancelled || (error as HttpError).status === 429 || (error as HttpError).status === 503) throw error; run.activity = "Retrying the AI interpretation once…"; await publish(false); r = await post<{ profile: AiProfile; model: string }>("/api/intel/discovery/profile", { pack }); }
          run.profile = mergeAiProfile(run.profile, r.profile, run.pages);
          run.aiPrompts = r.profile.prompts;
          run.ai = { available: true, note: "AI interpretation by " + r.model + "; statements are kept only where they cite fetched pages.", calls: run.ai.calls + 1, model: r.model };
        } catch (error) {
          if (error instanceof Cancelled) throw error;
          run.ai = { ...run.ai, available: false, note: (error as Error).message };
          s.errors.push({ source: "AI interpretation", message: (error as Error).message, retryable: (error as HttpError).status !== 503 });
        }
      } else run.ai = { ...run.ai, available: false, note: options.capabilities.discoveryAi === "off" ? "AI-assisted discovery is not configured on this deployment." : "AI assistance was switched off for this discovery." };
      const p = run.profile!;
      await finish(s, s.errors.length ? "partial" : "complete", p.offerings.length + " offerings · " + p.industry.value + (p.subsectors[0] ? " (" + p.subsectors[0].value + ")" : "") + (aiOn && !s.errors.length ? " · AI-assisted" : " · website evidence only"));
    }

    // 3. Audiences and markets.
    if (!settled("audiences")) {
      const s = await begin("audiences", "Understanding target audiences and markets…", 1);
      const p = run.profile!;
      await finish(s, p.segments.length || p.markets.length ? "complete" : "partial", (p.segments.slice(0, 3).map(x => x.value).join(", ") || "No audience mentions found") + " · " + (p.markets.slice(0, 3).map(x => x.value).join(", ") || "market not determined") + " · " + p.model.value);
    }

    // 4. Competitors: AI web search candidates, search-provider results, each verified by fetching the website.
    if (!settled("competitors")) {
      const p = run.profile!;
      const s = await begin("competitors", "Discovering market competitors…", null);
      const vocabulary = offeringVocabulary(p, run.pages);
      const candidates = new Map<string, { candidate: Candidate; kinds: CompetitorKind[]; search?: { keywords: string[] } }>();
      const query = { website: run.website, brand: p.brand.value, industry: [p.industry.value, ...p.subsectors.filter(x => x.selected).map(x => x.value)].join(", "), offerings: p.offerings.filter(o => o.selected).map(o => o.value).slice(0, 8), segments: p.segments.filter(x => x.selected).map(x => x.value).slice(0, 6), markets: p.markets.filter(x => x.selected).map(x => x.value).slice(0, 4), model: p.model.value.replace(/\s·.*$/, "") };
      let rounds = 0;
      const research = async (extra: Record<string, unknown>, optional = false) => {
        try {
          const r = await post<{ candidates: Candidate[]; citations: { url: string }[] }>("/api/intel/discovery/competitors", { ...query, ...extra });
          run.ai.calls += 1; rounds += 1;
          const fresh: { candidate: Candidate; kinds: CompetitorKind[] }[] = [];
          for (const c of r.candidates) { const key = siteKey(hostOf(c.website)); if (!candidates.has(key)) { const item = { candidate: c, kinds: ["commercial"] as CompetitorKind[] }; candidates.set(key, item); fresh.push(item); } }
          return fresh;
        } catch (error) {
          if (error instanceof Cancelled) throw error;
          // The follow-up round is an improvement, not a requirement: its failure does not make the stage partial.
          if (!optional) s.errors.push({ source: "AI web search", message: (error as Error).message, retryable: true });
          return [];
        }
      };
      if (aiOn && p.offerings.some(o => o.selected)) await research({});
      if (options.capabilities.search) {
        try {
          const market = p.markets.find(m => m.selected)?.value || "";
          const seeds = p.offerings.filter(o => o.selected).slice(0, 5).map(o => o.value.toLowerCase() + (market ? " " + marketPhrase(market).replace(/^the /i, "").toLowerCase() : ""));
          const r = await post<{ configured: boolean; provider: string; serp: { keyword: string; results: { url: string; position: number }[] }[] }>("/api/intel/discovery/search", { serpKeywords: seeds, keywords: [], market });
          run.search = { configured: r.configured, provider: r.provider, note: "" };
          const organic = serpCompetitors(r.serp, run.website);
          run.clientRanks = organic.clientRanks;
          for (const [key, v] of organic.competitors) {
            const existing = candidates.get(key);
            if (existing) { existing.kinds.push("organic"); existing.search = { keywords: v.keywords }; }
            else candidates.set(key, { candidate: { name: hostOf(v.url), website: v.url, reason: "", offerings: [], markets: [], sources: [] }, kinds: ["organic"], search: { keywords: v.keywords } });
          }
        } catch (error) { if (error instanceof Cancelled) throw error; s.errors.push({ source: "Search data provider", message: (error as Error).message, retryable: true }); }
      } else run.search = { configured: false, provider: null, note: "No search data provider is configured: organic competitors, search volumes, difficulty and rankings are not measured." };
      const verified: CompetitorRec[] = [];
      const verifyAll = async (list: { candidate: Candidate; kinds: CompetitorKind[]; search?: { keywords: string[] } }[]) => {
        s.total = (s.total || 0) + list.length;
        await publish();
        for (const item of list) {
          run.activity = "Verifying " + hostOf(item.candidate.website) + "…";
          let home: PageRecord | null = null, failure: string | null = null;
          try {
            const d = await post<Discovery & { redirectedTo?: string }>("/api/intel/verify", { url: item.candidate.website });
            home = d.home; failure = d.homeFailure?.message || null;
            if (home && d.redirectedTo) item.candidate = { ...item.candidate, website: d.redirectedTo, sources: [...item.candidate.sources, item.candidate.website] };
          }
          catch (error) { if (error instanceof Cancelled) throw error; failure = (error as Error).message; }
          if (home) run.competitorHomes[item.candidate.website] = home;
          let assessed = assessCompetitor(p, vocabulary, item.candidate, item.kinds, home, failure);
          // Look beyond the home page: relevant service pages when the home page is inconclusive, cited pages when it is blocked.
          const key = siteKey(hostOf(item.candidate.website));
          const extraUrls = home ? (assessed.confidence !== "high" ? relevantLinks(home, vocabulary) : []) : item.candidate.sources.filter(u => siteKey(hostOf(u)) === key && u.replace(/\/$/, "") !== item.candidate.website.replace(/\/$/, "")).slice(0, 2);
          if (extraUrls.length) {
            try {
              const r = await post<{ pages: PageRecord[]; failures: PageFailure[] }>("/api/intel/pages", { urls: extraUrls, depths: extraUrls.map(() => 1), keywords: [] });
              if (r.pages.length) assessed = assessCompetitor(p, vocabulary, item.candidate, item.kinds, home, failure, r.pages);
            } catch (error) { if (error instanceof Cancelled) throw error; }
          }
          if (item.search) assessed.overlap.search = { shared: item.search.keywords.length, sampled: Math.max(1, item.search.keywords.length), keywords: item.search.keywords };
          verified.push(assessed);
          s.done += 1;
          run.competitors = rankCompetitors(verified);
          await publish();
        }
      };
      s.total = 0; s.done = 0;
      await verifyAll([...candidates.values()].slice(0, 12));
      // Too few direct competitors (for example only universities or professional bodies): one more research round
      // asking for commercial providers, excluding every website already reviewed.
      if (aiOn && rounds === 1 && run.competitors.filter(c => c.recommended).length < 3) {
        run.activity = "Searching again for direct commercial competitors…";
        await publish();
        const fresh = await research({ round: 2, exclude: [...candidates.keys()].slice(0, 20) }, true);
        await verifyAll(fresh.slice(0, 8));
      }
      const list = verified;
      const recommended = run.competitors.filter(c => c.recommended).length;
      const why = !aiOn && !options.capabilities.search ? "Competitor discovery needs AI web search or a search data provider; neither is available on this deployment, so add competitors manually." : "";
      if (why) s.errors.push({ source: "Competitor discovery", message: why, retryable: false });
      await finish(s, !list.length ? (why ? "partial" : "complete") : s.errors.length ? "partial" : "complete", list.length ? recommended + " recommended of " + list.length + " candidates verified" + (rounds > 1 ? " (2 research rounds)" : "") : why || "No competitor candidates were found.");
    }

    // 5. Keywords: site, offerings, competitor pages, Search Console (connected) and provider metrics.
    if (!settled("keywords")) {
      const p = run.profile!;
      const s = await begin("keywords", "Building keyword intelligence…", options.capabilities.search ? 2 : 1);
      let gsc: { query: string; clicks: number; impressions: number; position: number }[] | undefined, gscAt: string | undefined;
      if (options.organisationId) {
        try {
          const r = await post<{ result: { site?: string; observedAt?: string; rows?: { query: string; clicks: number; impressions: number; position: number }[] } }>("/api/integrations", { organisationId: options.organisationId, source: "gsc" });
          const property = (r.result.site || "").replace(/^sc-domain:/, "");
          if (property && siteKey(hostOf(property.includes("//") ? property : "https://" + property)) === siteKey(hostOf(run.website))) { gsc = r.result.rows; gscAt = r.result.observedAt; }
        } catch (error) { if (error instanceof Cancelled) throw error; s.errors.push({ source: "Search Console", message: (error as Error).message, retryable: true }); }
      }
      run.keywords = keywordUniverse({ profile: p, pages: run.pages, competitorHomes: Object.values(run.competitorHomes), competitors: run.competitors, website: run.website, gsc, gscCollectedAt: gscAt });
      for (const r of run.clientRanks || []) { const k = run.keywords.find(x => x.keyword === r.keyword); if (k) k.metrics = { ...(k.metrics || { source: run.search.provider + " (live results)", collectedAt: new Date().toISOString() }), position: r.position }; }
      s.done = 1;
      await publish();
      if (options.capabilities.search) {
        try {
          const r = await post<{ configured: boolean; provider: string; metrics: { keyword: string; volume?: number; cpc?: number; competition?: number; difficulty?: number; trend?: number[] }[]; collectedAt: string; note: string }>("/api/intel/discovery/search", { keywords: run.keywords.filter(k => !k.groups.includes("branded")).slice(0, 100).map(k => k.keyword), serpKeywords: [], market: p.markets.find(m => m.selected)?.value || "" });
          for (const m of r.metrics) { const k = run.keywords.find(x => x.keyword === m.keyword); if (k) { k.metrics = { ...(k.metrics || {}), ...m, source: r.provider, collectedAt: r.collectedAt }; k.basis = "provider"; } }
          if (r.note) run.search.note = r.note;
          s.done = 2;
        } catch (error) { if (error instanceof Cancelled) throw error; s.errors.push({ source: "Search data provider", message: (error as Error).message, retryable: true }); }
      }
      const measured = run.keywords.filter(k => k.metrics?.volume !== undefined || k.metrics?.impressions !== undefined).length;
      await finish(s, s.errors.length ? "partial" : "complete", run.keywords.length + " keywords in " + new Set(run.keywords.map(k => k.cluster)).size + " clusters · " + (measured ? measured + " with measured demand" : "demand not measured (no provider or Search Console)"));
    }

    // 6. GEO prompts: bank, then a small sample of real AI answers (GEO competitors and cited sources).
    if (!settled("prompts")) {
      const p = run.profile!;
      run.prompts = promptRecs(p, run.competitors, run.keywords, (run.aiPrompts || []) as AiProfile["prompts"]);
      const sampleable = pickSamples(run, aiOn ? run.settings.geoSamples : 0);
      const s = await begin("prompts", "Generating GEO search prompts…", 1 + sampleable.length);
      s.done = 1;
      await publish();
      for (const prompt of sampleable) {
        run.activity = "Sampling an AI answer: “" + prompt.prompt.slice(0, 90) + "”";
        await publish(false);
        try {
          const r = await post<{ prompt: string; category: AiObservation["category"]; provider: string; model: string; response: string; citations: { url: string; title: string }[]; collectedAt: string; methodology: string; limitations: string }>("/api/intel/discovery/geo", { template: prompt.template!.id, slots: prompt.template!.slots });
          run.ai.calls += 1;
          const competitorsMentioned = run.competitors.filter(c => c.verified && mentions(r.response, [c.name, hostOf(c.website)])).map(c => c.name);
          const observation: AiObservation = { id: crypto.randomUUID(), provider: r.provider, model: r.model, surface: "api", method: "automated", prompt: r.prompt, category: r.category, market: prompt.market, language: "en", collectedAt: r.collectedAt, response: r.response, brandMentioned: mentions(r.response, brandNames()), competitorMentions: competitorsMentioned, position: recommendationPosition(r.response, brandNames()), citations: r.citations, inaccurate: null, accuracyNote: "", methodology: r.methodology + " Sampled during Intelligent Discovery.", limitations: r.limitations };
          run.samples.push(observation);
          prompt.sample = { observationId: observation.id, brandMentioned: observation.brandMentioned, competitors: competitorsMentioned, citedDomains: [...new Set(r.citations.map(c => hostOf(c.url)))].slice(0, 8) };
        } catch (error) { if (error instanceof Cancelled) throw error; s.errors.push({ source: "AI answer sampling", message: (error as Error).message, retryable: true }); if ((error as HttpError).status === 429 || (error as HttpError).status === 503) break; }
        s.done += 1;
        await publish();
      }
      if (run.samples.length) await addGeoCompetitors(run, post, s);
      const sampled = run.samples.length;
      await finish(s, s.errors.length ? "partial" : "complete", run.prompts.length + " prompts in " + new Set(run.prompts.map(x => x.category)).size + " categories" + (sampled ? " · brand mentioned in " + run.samples.filter(o => o.brandMentioned).length + " of " + sampled + " sampled AI answers (indicative only)" : aiOn ? "" : " · AI answers not sampled (AI assistance unavailable)"));
    }

    // 7. Priority pages.
    if (!settled("pages")) {
      const s = await begin("pages", "Identifying priority pages…", 1);
      run.priorityPages = priorityPages(run.pages, run.site, run.website);
      await finish(s, "complete", run.priorityPages.length + " priority pages across " + new Set(run.priorityPages.map(x => x.role)).size + " roles");
    }

    // 8. Scope.
    if (!settled("scope")) {
      const s = await begin("scope", "Recommending the investigation scope…", 1);
      run.scope = recommendScope(run, run.profile!.model.value);
      await finish(s, "complete", { quick: "Quick Scan", deep: "Deep Intelligence", enterprise: "Enterprise Investigation" }[run.scope.mode] + " · " + run.scope.pageLimit + " pages · depth " + run.scope.maxDepth);
    }
    run.gaps = discoveryGaps(run);
    run.status = run.gaps.length ? "partial" : "complete";
    run.activity = run.gaps.length ? "Recommendations ready with " + run.gaps.length + " limitation" + (run.gaps.length === 1 ? "" : "s") + ". Review the evidence and launch the investigation." : "Recommendations ready. Review the evidence and launch the investigation.";
    await publish();
    return run;
  } catch (error) {
    if (error instanceof Cancelled) { run.status = "cancelled"; run.activity = "Discovery cancelled. Completed stages are kept; resume to continue."; }
    else { run.status = "failed"; run.activity = (error as Error).message; const active = run.stages.find(s => s.status === "active"); if (active) { active.status = "failed"; active.errors.push({ source: "Discovery", message: (error as Error).message, retryable: true }); } }
    for (const s of run.stages) if (s.status === "active") s.status = "pending";
    await publish();
    return run;
  }
}

function rankCompetitors(list: CompetitorRec[]): CompetitorRec[] {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => Number(b.verified) - Number(a.verified) || rank[a.confidence] - rank[b.confidence] || (b.overlap.offerings?.matched.length || 0) - (a.overlap.offerings?.matched.length || 0)).slice(0, 12);
}

/** Highest-priority sampleable prompts, at most one per category first. */
function pickSamples(run: DiscoveryRun, n: number) {
  const pool = run.prompts.filter(p => p.template && promptTemplates[p.template.id]?.sample).sort((a, b) => b.priority - a.priority);
  const chosen: typeof pool = [];
  for (const p of pool) if (chosen.length < n && !chosen.some(c => c.category === p.category)) chosen.push(p);
  for (const p of pool) if (chosen.length < n && !chosen.includes(p)) chosen.push(p);
  return chosen;
}

async function addGeoCompetitors(run: DiscoveryRun, post: <T>(path: string, body: unknown) => Promise<T>, s: StageState) {
  const p = run.profile!;
  const evidence = geoEvidence(run.samples, run.competitors, [p.brand.value, ...p.aliases.filter(a => a.selected).map(a => a.value)], run.website);
  const n = run.samples.length;
  for (const c of run.competitors) {
    const mentioned = evidence.mentionsBy.get(c.id) || 0;
    const cited = evidence.cited.get(siteKey(hostOf(c.website)));
    if (mentioned || cited) {
      c.overlap.geo = { mentions: mentioned, citations: cited?.citations || 0, samples: n };
      if (!c.kinds.includes("geo")) c.kinds.push("geo");
      c.reason += " Appears in " + mentioned + " of " + n + " sampled AI answers" + (cited ? " and is cited " + cited.citations + " time" + (cited.citations === 1 ? "" : "s") : "") + ".";
    }
  }
  // Cited domains not yet assessed: verify the most-cited few; overlapping ones are GEO competitors, the rest are citation sources.
  const vocabulary = offeringVocabulary(p, run.pages);
  const known = new Set(run.competitors.map(c => siteKey(hostOf(c.website))));
  const fresh = [...evidence.cited.entries()].filter(([k]) => !known.has(k) && !isPlatform(k)).sort((a, b) => b[1].citations - a[1].citations).slice(0, 4);
  for (const [key, v] of fresh) {
    const website = "https://" + hostOf(v.url) + "/";
    let home: PageRecord | null = null, failure: string | null = null;
    try { const d = await post<Discovery>("/api/intel/verify", { url: website }); home = d.home; failure = d.homeFailure?.message || null; }
    catch (error) { if (error instanceof Cancelled) throw error; failure = (error as Error).message; }
    const assessed = assessCompetitor(p, vocabulary, { name: hostOf(website), website, reason: "", offerings: [], markets: [], sources: [v.url] }, ["geo"], home, failure);
    if (assessed.verified && assessed.confidence !== "low") {
      if (home) run.competitorHomes[website] = home;
      assessed.overlap.geo = { mentions: run.samples.filter(o => mentions(o.response, [assessed.name, hostOf(website)])).length, citations: v.citations, samples: n };
      assessed.reason += " Cited in " + v.samples + " of " + n + " sampled AI answers.";
      assessed.selected = false;
      run.competitors.push(assessed);
      known.add(key);
    }
  }
  run.competitors = rankCompetitors(run.competitors);
  run.citationSources = citationSources(evidence.cited, run.competitors, n);
  void s;
}

export function discoveryGaps(run: DiscoveryRun): string[] {
  const gaps: string[] = [];
  if (run.site?.homeFailure && run.pages.length) gaps.push("The home page could not be analysed; the profile is based on other sampled pages.");
  if (run.failures.length) gaps.push(run.failures.length + " sampled page" + (run.failures.length === 1 ? "" : "s") + " could not be retrieved.");
  if (!run.ai.available && run.settings.useAi) gaps.push("AI assistance was unavailable (" + run.ai.note.replace(/\.$/, "") + "); recommendations use website evidence only.");
  if (!run.competitors.some(c => c.recommended)) {
    const alternatives = run.competitors.filter(c => /Academic institution|professional, public or membership body/.test(c.reason)).length;
    gaps.push(run.competitors.length
      ? "None of the " + run.competitors.length + " candidate" + (run.competitors.length === 1 ? "" : "s") + " was confirmed as a direct commercial competitor" + (alternatives ? " (" + alternatives + " " + (alternatives === 1 ? "is an academic institution or professional body" : "are academic institutions or professional bodies") + ")" : "") + "; add direct competitors manually or connect a search data provider."
      : "No competitor could be verified from the available evidence; add competitors manually or connect a search data provider.");
  }
  for (const s of run.stages) for (const e of s.errors) if (!gaps.some(g => g.includes(e.message)) && !/AI interpretation|Competitor discovery/.test(e.source)) gaps.push(s.label + ": " + e.message);
  return gaps.slice(0, 8);
}

export type { KeywordRec };
