import test from "node:test";
import assert from "node:assert/strict";
import { runInvestigation } from "./intel/runner";
import { analysePage } from "./intel/page";
import { jobProgress, newJob, type Brief, type Investigation } from "./intel/model";
import type { Discovery } from "./intel/crawl";

const origin = "https://fixture.example.com";
const brief: Brief = { website: origin, brand: "Fixture", aliases: [], industry: "training", markets: ["UK"], audience: "teams", offerings: ["courses"], objectives: ["Leads"], competitors: [], keywords: ["courses"], prompts: [], mode: "quick", assessment: "prospect", pageLimit: 8, linkCheckLimit: 10, performancePages: 1, aiPromptBudget: 3, includeExternalLinks: false };

function html(path: string) {
  const links = path === "/" ? Array.from({ length: 12 }, (_, i) => "/courses/c" + i).concat(["/private/a", "/gone"]) : ["/", "/courses/c0"];
  return `<html lang="en"><head><title>Page ${path} title for testing purposes</title></head><body><h1>${path}</h1>${links.map(l => `<a href="${l}">${l}</a>`).join("")}</body></html>`;
}
const record = (path: string, depth: number) => analysePage({ url: origin + path, finalUrl: origin + path, status: 200, chain: [{ url: origin + path, status: 200 }], headers: {}, html: html(path), fetchedAt: new Date().toISOString(), durationMs: 5, depth });

function fakeService(options: { failOnceWith429?: boolean } = {}) {
  const calls: Record<string, number> = {};
  const fetched: string[] = [];
  let throttled = false;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls[path] = (calls[path] || 0) + 1;
    const body = JSON.parse(String(init?.body || "{}"));
    const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
    if (path === "/api/intel/discover") {
      const d: Discovery = { requestedUrl: origin + "/", origin, collectedAt: new Date().toISOString(), durationMs: 10, home: record("/", 0), homeFailure: null, robots: { state: "found", groups: [{ agents: ["*"], rules: [{ allow: false, pattern: "/private" }] }], sitemaps: [], bytes: 30, url: origin + "/robots.txt", status: 200, blocksVista: false, blocksAll: false }, sitemaps: [], sitemapUrls: [] };
      return json(d);
    }
    if (path === "/api/intel/pages") {
      if (options.failOnceWith429 && !throttled) { throttled = true; return json({ error: "limit", retryAfter: 0.01 }, 429, { "Retry-After": "0" }); }
      fetched.push(...body.urls);
      const pages = body.urls.filter((u: string) => !u.endsWith("/gone")).map((u: string, i: number) => record(new URL(u).pathname, body.depths[i]));
      const failures = body.urls.filter((u: string) => u.endsWith("/gone")).map((u: string) => ({ url: u, depth: 1, kind: "http-error", status: 404, message: "HTTP 404", chain: [] }));
      return json({ pages, failures });
    }
    if (path === "/api/intel/links") return json({ links: body.urls.map((u: string) => ({ url: u, status: 200, finalUrl: u, redirects: 0 })) });
    if (path === "/api/intel/performance") return json({ error: "PageSpeed Insights quota is exhausted." }, 502);
    return json({ error: "unknown" }, 404);
  }) as typeof fetch;
  return { fetcher, calls, fetched };
}

const fresh = (): Investigation => ({ id: "i1", projectId: "p1", createdAt: "", updatedAt: "", brief, discovery: null, pages: [], failures: [], links: [], performance: [], competitors: [], observations: [], firstParty: { errors: [] }, job: newJob() });

test("runner completes all twelve stages with measured progress, robots filtering and honest skips", async () => {
  const service = fakeService({ failOnceWith429: true });
  const updates: number[] = [];
  const result = await runInvestigation(fresh(), { signal: new AbortController().signal, fetcher: service.fetcher, onUpdate: inv => updates.push(jobProgress(inv.job).percent ?? -1), save: async () => {} });
  assert.equal(result.job.status, "partial", "a PageSpeed failure means the evidence is incomplete");
  assert.ok(result.job.gaps!.some(g => /technical seo is incomplete: PageSpeed Insights unavailable/i.test(g)), JSON.stringify(result.job.gaps));
  assert.equal(result.pages.length, 8, "page budget respected");
  assert.ok(result.job.frontier.length > 0 && result.job.gaps!.some(g => g.startsWith("Page budget reached: 8 pages analysed and " + result.job.frontier.length)), "unvisited URLs are reported as a coverage gap");
  assert.ok(result.failures.some(f => f.kind === "robots" && f.url.endsWith("/private/a")) || !service.fetched.some(u => u.includes("/private/")));
  assert.ok(!service.fetched.some(u => u.includes("/private/")), "robots-disallowed URLs are never requested");
  assert.equal(result.job.stages.find(s => s.id === "technical")?.status, "partial", "PageSpeed failure is reported, not hidden");
  assert.ok(result.job.stages.find(s => s.id === "technical")!.errors[0].message.includes("quota"));
  assert.equal(result.job.stages.find(s => s.id === "ai")?.status, "skipped");
  assert.equal(result.job.stages.find(s => s.id === "competitive")?.status, "skipped");
  assert.ok(result.job.stages.every(s => ["complete", "partial", "skipped"].includes(s.status)));
  for (let i = 1; i < updates.length; i += 1) assert.ok(updates[i] >= updates[i - 1] - 1, "progress never jumps backwards");
  assert.equal(updates.at(-1), 100);
});

test("cancellation saves state and resuming continues without refetching completed pages", async () => {
  const service = fakeService();
  const controller = new AbortController();
  let saved: Investigation | null = null;
  const partial = await runInvestigation(fresh(), { signal: controller.signal, fetcher: service.fetcher, save: async inv => { saved = JSON.parse(JSON.stringify(inv)); if (inv.pages.length >= 3) controller.abort(); }, onUpdate: () => {} });
  assert.equal(partial.job.status, "cancelled");
  assert.ok(saved);
  const before = service.fetched.length;
  const crawledBefore = new Set(partial.pages.map(p => p.url));
  const resumed = await runInvestigation(partial, { signal: new AbortController().signal, fetcher: service.fetcher, save: async () => {}, onUpdate: () => {} });
  assert.equal(resumed.job.status, "partial");
  assert.equal(resumed.pages.length, 8);
  const refetched = service.fetched.slice(before).filter(u => crawledBefore.has(u));
  assert.deepEqual(refetched, [], "completed pages are not fetched again");
  assert.ok(resumed.job.elapsedMs >= partial.job.elapsedMs);
});

test("connected client mode retrieves authorised first-party data and uses it in findings and the index", async () => {
  const service = fakeService();
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/integrations") {
      const body = JSON.parse(String(init?.body));
      const result = body.source === "gsc"
        ? { source: "Google Search Console API", site: "sc-domain:fixture.example.com", period: { startDate: "2026-10-30", endDate: "2026-11-26" }, observedAt: "2026-11-27T09:00:00Z", rows: [{ query: "leadership courses", clicks: 4, impressions: 900, ctr: 0.0044, position: 6.2 }, { query: "fixture training", clicks: 120, impressions: 400, ctr: 0.3, position: 1.1 }, { query: "management training uk", clicks: 2, impressions: 650, ctr: 0.003, position: 9.4 }] }
        : { source: "GA4 Analytics Data API", property: "123456", observedAt: "2026-11-27T09:00:00Z", scope: "sessionDefaultChannelGroup", period: { startDate: "2026-10-30", endDate: "2026-11-26" }, rows: [{ label: "Organic Search", sessions: 1200, totalUsers: 900, keyEvents: 36 }, { label: "Direct", sessions: 400, totalUsers: 350, keyEvents: 8 }] };
      return new Response(JSON.stringify({ connected: true, source: body.source, result }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return service.fetcher(input, init);
  }) as typeof fetch;
  const inv = fresh();
  inv.brief = { ...brief, assessment: "connected" };
  const result = await runInvestigation(inv, { signal: new AbortController().signal, fetcher, save: async () => {}, onUpdate: () => {}, organisationId: "00000000-0000-4000-8000-000000000001" });
  assert.equal(result.job.stages.find(s => s.id === "commercial")?.status, "complete");
  assert.equal(result.firstParty.gsc?.rows.length, 3);
  assert.ok(result.firstParty.gsc?.scope.includes("sc-domain:fixture.example.com"));
  assert.deepEqual(result.firstParty.ga4?.rows.map(r => r.channel), ["Organic Search", "Direct"]);
  const { computeAnalysis } = await import("./intel/analysis");
  const analysis = computeAnalysis(result);
  assert.ok(analysis.findings.some(f => f.rule === "gsc-low-ctr" && f.evidenceClass === "first-party"));
  assert.equal(analysis.index.dimensions.find(d => d.id === "search")?.evidenceClass, "first-party");
  assert.equal(analysis.index.dimensions.find(d => d.id === "impact")?.evidenceClass, "first-party");
  assert.equal(analysis.upside.available, true);
});

test("failed provider connections are reported with explanations, never substituted", async () => {
  const service = fakeService();
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => String(input) === "/api/integrations" ? new Response(JSON.stringify({ error: "Provider has no server credentials configured." }), { status: 503, headers: { "Content-Type": "application/json" } }) : service.fetcher(input, init)) as typeof fetch;
  const inv = fresh();
  inv.brief = { ...brief, assessment: "connected" };
  const result = await runInvestigation(inv, { signal: new AbortController().signal, fetcher, save: async () => {}, onUpdate: () => {}, organisationId: "00000000-0000-4000-8000-000000000001" });
  const stage = result.job.stages.find(s => s.id === "commercial")!;
  assert.equal(stage.status, "partial");
  assert.equal(stage.errors.length, 2);
  assert.ok(stage.errors[0].message.includes("credentials"));
  assert.equal(result.firstParty.gsc, undefined);
  assert.equal(result.job.status, "partial");
});

test("competitor brand names come from crawled evidence before domain labels", async () => {
  const { brandName } = await import("./intel/runner");
  const { analyseResponse, competitorNames } = await import("./intel/geo");
  const home = record("/", 0);
  assert.equal(brandName({ ...home, schema: { ...home.schema, organisation: { name: "Ridgeline Supply", sameAs: [] } } }, "http://127.0.0.16:4810"), "Ridgeline Supply");
  assert.equal(brandName({ ...home, title: "Hiking boots | Ridgeline" }, "https://ridgeline.example"), "Ridgeline");
  const names = competitorNames({ ...brief, competitors: ["http://127.0.0.16:4810"] }, [{ website: "http://127.0.0.16:4810", name: "Ridgeline Supply" }]);
  assert.deepEqual(analyseResponse("1. Ridgeline Supply\n2. Another", { ...brief, competitors: ["http://127.0.0.16:4810"] }, [], names).competitorMentions, ["Ridgeline Supply"]);
});

test("an oversized home page falls back to sitemap and supplied URLs, and transient failures are retried once", async () => {
  const calls: string[][] = [];
  let flaky = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = JSON.parse(String(init?.body || "{}"));
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/api/intel/discover") return json({ requestedUrl: origin + "/", origin, collectedAt: new Date().toISOString(), durationMs: 10, home: null, homeFailure: { url: origin + "/", depth: 0, kind: "too-large", message: "The response exceeds the transfer limit of the resource policy and was not analysed.", chain: [] }, robots: { state: "found", groups: [], sitemaps: [origin + "/sitemap.xml"], bytes: 10, url: origin + "/robots.txt", status: 200, blocksVista: false, blocksAll: false }, sitemaps: [{ url: origin + "/sitemap.xml", status: 200, kind: "urlset", entries: 3, truncated: false }], sitemapUrls: ["/a", "/b", "/flaky"].map(p => ({ loc: origin + p })) });
    if (path === "/api/intel/pages") {
      calls.push(body.urls);
      const failures = body.urls.filter((u: string) => u.endsWith("/flaky") && flaky++ === 0).map((u: string) => ({ url: u, depth: 1, kind: "timeout", message: "The server did not respond in time.", chain: [] }));
      const pages = body.urls.filter((u: string) => !failures.some((f: { url: string }) => f.url === u)).map((u: string, i: number) => record(new URL(u).pathname, body.depths[i]));
      return json({ pages, failures, deferred: [] });
    }
    if (path === "/api/intel/links") return json({ links: [] });
    return json({ error: "PageSpeed Insights quota is exhausted." }, 502);
  }) as typeof fetch;
  const inv = fresh();
  inv.brief = { ...brief, pageLimit: 20, seedUrls: [origin + "/courses/c3"] };
  const result = await runInvestigation(inv, { signal: new AbortController().signal, fetcher, save: async () => {}, onUpdate: () => {} });
  assert.equal(result.job.stages[0].status, "partial", "home failure is recorded, not fatal");
  assert.ok(result.job.stages[0].note.includes("alternative discovery"));
  assert.ok(result.pages.some(p => p.url.endsWith("/flaky")), "transient failure retried and recovered");
  assert.ok(result.pages.some(p => p.url.endsWith("/courses/c3")), "supplied URL inspected");
  assert.ok(result.failures.some(f => f.depth === 0 && f.kind === "too-large"), "home failure kept as evidence");
  assert.equal(result.job.status, "partial");
  assert.ok(result.job.gaps!.includes("The home page could not be analysed."));
});

test("targeted retry re-queues only retryable failures and re-runs dependent stages", async () => {
  const { prepareRetry, isRetryable } = await import("./intel/runner");
  const inv = fresh();
  inv.failures = [
    { url: origin + "/timeout", depth: 1, kind: "timeout", message: "t", chain: [] },
    { url: origin + "/gone", depth: 1, kind: "http-error", status: 404, message: "404", chain: [] },
    { url: origin + "/busy", depth: 1, kind: "http-error", status: 503, message: "503", chain: [] },
    { url: origin + "/private", depth: 1, kind: "robots", message: "robots", chain: [] },
  ];
  inv.job.stages.forEach(s => { s.status = "complete"; });
  assert.deepEqual(inv.failures.map(isRetryable), [true, false, true, false]);
  for (const kind of ["redirect-loop", "too-many-redirects", "too-large", "decompression-limit", "decode", "unsupported-type", "off-site-redirect", "invalid-url", "blocked-address"] as const)
    assert.equal(isRetryable({ url: origin + "/x", depth: 1, kind, message: "", chain: [] }), false, kind + " is permanent");
  assert.equal(isRetryable({ url: origin + "/x", depth: 1, kind: "http-error", status: 429, message: "", chain: [] }), true);
  const next = prepareRetry(inv);
  assert.deepEqual(next.job.frontier.map(f => f.url), [origin + "/timeout", origin + "/busy"]);
  assert.equal(next.failures.length, 2);
  assert.equal(next.job.stages.find(s => s.id === "crawl")?.status, "pending");
  assert.equal(next.job.stages.find(s => s.id === "ai")?.status, "complete", "independent stages are not repeated");
});
