import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { FetchFailure, fetchPublic, testOrigins, validatePublicUrl } from "./intel/http";
import { checkLinks, crawlPage, discover } from "./intel/crawl";
import { parsePsi } from "./intel/psi";

function server(routes: Record<string, (res: http.ServerResponse) => void>) {
  const s = http.createServer((req, res) => { const handler = routes[req.url || ""]; if (handler) handler(res); else { res.writeHead(404, { "Content-Type": "text/html" }); res.end("<h1>Not found</h1>"); } });
  return new Promise<{ origin: string; close: () => void }>(resolve => s.listen(0, "127.0.0.1", () => resolve({ origin: "http://127.0.0.1:" + (s.address() as AddressInfo).port, close: () => s.close() })));
}
const page = (body: string, headers: Record<string, string> = {}) => (res: http.ServerResponse) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...headers }); res.end(body); };
const redirect = (to: string, code = 301) => (res: http.ServerResponse) => { res.writeHead(code, { Location: to }); res.end(); };

test("public URL validation blocks private, credentialed and custom-port targets; test origins are ignored on Vercel", () => {
  for (const url of ["https://localhost/", "https://127.0.0.1/", "https://intranet.local/", "https://user:pw@example.com/", "https://example.com:8443/", "ftp://example.com/", "https://10.0.0.1/"]) assert.throws(() => validatePublicUrl(url, {}), FetchFailure);
  assert.equal(validatePublicUrl("http://example.com/a#frag", {}).href, "http://example.com/a");
  assert.equal(testOrigins({ VISTA_TEST_CRAWL_ORIGINS: "http://127.0.0.1:4810", VERCEL: "1" }).size, 0);
  assert.equal(testOrigins({ VISTA_TEST_CRAWL_ORIGINS: "http://127.0.0.1:4810" }).size, 1);
});

test("fetcher records redirect chains, detects loops, enforces type and size limits; crawler enforces robots.txt", async () => {
  const big = "<html><body>" + "x".repeat(1_600_000) + "</body></html>";
  const site = await server({
    "/robots.txt": res => { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("User-agent: *\nDisallow: /private\nSitemap: /sitemap.xml"); },
    "/sitemap.xml": res => { res.writeHead(200, { "Content-Type": "application/xml" }); res.end("<urlset><url><loc>" + origin() + "/</loc></url><url><loc>" + origin() + "/a</loc></url></urlset>"); },
    "/": page('<html lang="en"><head><title>Home page title for the fixture site</title></head><body><h1>Home</h1><a href="/a">A</a><a href="/private/x">P</a><a href="/gone">Gone</a></body></html>', { "Strict-Transport-Security": "max-age=1" }),
    "/a": page("<html><head><title>A</title></head><body><h1>A</h1></body></html>"),
    "/r1": redirect("/r2"), "/r2": redirect("/a", 302),
    "/loop1": redirect("/loop2"), "/loop2": redirect("/loop1"),
    "/json": res => { res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); },
    "/big": page(big),
    "/private/x": page("<html><title>secret</title></html>"),
  });
  const origin = () => site.origin;
  process.env.VISTA_TEST_CRAWL_ORIGINS = site.origin;
  try {
    const chain = await fetchPublic(site.origin + "/r1");
    assert.equal(chain.status, 200); assert.equal(chain.finalUrl, site.origin + "/a");
    assert.deepEqual(chain.chain.map(h => h.status), [301, 302, 200]);
    await assert.rejects(fetchPublic(site.origin + "/loop1"), (e: FetchFailure) => e.kind === "redirect-loop" && e.chain.length === 2);
    await assert.rejects(fetchPublic(site.origin + "/json"), (e: FetchFailure) => e.kind === "unsupported-type");
    await assert.rejects(fetchPublic(site.origin + "/big"), (e: FetchFailure) => e.kind === "too-large");
    const missing = await fetchPublic(site.origin + "/gone");
    assert.equal(missing.status, 404); assert.equal(missing.body, "");

    const blocked = await crawlPage(site.origin + "/private/x", 1);
    assert.equal(blocked.failure?.kind, "robots");
    const gone = await crawlPage(site.origin + "/gone", 1);
    assert.equal(gone.failure?.kind, "http-error"); assert.equal(gone.failure?.status, 404);
    const ok = await crawlPage(site.origin + "/r1", 2, ["fixture"]);
    assert.equal(ok.page?.chain.length, 3); assert.equal(ok.page?.indexable, false);

    const found = await discover(site.origin + "/");
    assert.equal(found.home?.title, "Home page title for the fixture site");
    assert.equal(found.robots.state, "found"); assert.equal(found.robots.blocksAll, false);
    assert.equal(found.sitemaps[0].kind, "urlset"); assert.equal(found.sitemapUrls.length, 2);

    const links = await checkLinks([site.origin + "/a", site.origin + "/gone", site.origin + "/r1"]);
    assert.deepEqual(links.map(l => l.status), [200, 404, 200]); assert.equal(links[2].redirects, 2);
  } finally { delete process.env.VISTA_TEST_CRAWL_ORIGINS; site.close(); }
});

test("PageSpeed parsing separates Lighthouse lab data from CrUX field data", () => {
  const result = parsePsi({
    lighthouseResult: { lighthouseVersion: "12.0.0", categories: { performance: { score: 0.42 } }, audits: {
      "largest-contentful-paint": { numericValue: 4200 }, "cumulative-layout-shift": { numericValue: 0.05 }, "total-blocking-time": { numericValue: 610 },
      "render-blocking-resources": { score: 0.3, details: { overallSavingsMs: 900, items: [{ url: "https://a.example/app.css", wastedMs: 450 }] } },
      "unused-javascript": { score: 0.5, details: { overallSavingsMs: 300, overallSavingsBytes: 120000 } },
      "network-requests": { details: { items: [{ transferSize: 1000 }, { transferSize: 500 }] } } } },
    loadingExperience: { origin_fallback: true, metrics: {} },
    originLoadingExperience: { overall_category: "SLOW", metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 3900, category: "SLOW" }, INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: "FAST" }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12, category: "AVERAGE" } } },
  }, "https://a.example/", "mobile");
  assert.equal(result.lab.score, 42); assert.equal(result.lab.lcpMs, 4200); assert.equal(result.lab.requests, 2); assert.equal(result.lab.transferBytes, 1500);
  assert.equal(result.field.scope, "origin"); assert.equal(result.field.lcp?.category, "SLOW"); assert.equal(result.field.cls?.percentile, 0.12);
  assert.equal(result.opportunities[0].id, "render-blocking-resources"); assert.equal(result.renderBlocking[0].wastedMs, 450);
});
