import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import { FetchFailure, fetchPublic, resourcePolicy } from "./intel/http";
import { crawlPage, discover } from "./intel/crawl";
import { reduceHtml } from "./intel/reducer";

const MB = 1024 * 1024;
const jsonLd = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Heavy Co","sameAs":["https://www.linkedin.com/company/heavy"]}</script>';
/** A realistic oversized page: inline bundle, inline CSS, base64 images and SVG around real content. */
function heavyPage(targetMb: number) {
  // Pseudo-random filler compresses like a real minified bundle (a few times, not a thousand).
  let seed = 7; const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$";
  const chars: string[] = []; for (let i = 0; i < targetMb * MB; i += 1) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; chars.push(alphabet[seed % 64]); }
  const filler = "var x='" + chars.join("") + "';";
  return `<!doctype html><html lang="en"><head><title>Heavy Co laboratory medicine training courses</title><meta name="description" content="Courses."><link rel="canonical" href="/">${jsonLd}<style>${"body{color:red}".repeat(5000)}</style><script>${filler}</script></head><body><main><h1>Laboratory medicine training</h1><p>${"Real course content about clinical laboratory practice. ".repeat(60)}</p><img src="data:image/png;base64,${"A".repeat(200000)}" alt="Lab"><svg>${"<path d='M0 0L1 1'/>".repeat(20000)}</svg><a href="/courses">Courses</a><a href="/about-us">About</a></main></body></html>`;
}

function server(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const s = http.createServer(handler);
  return new Promise<{ origin: string; close: () => void }>(resolve => s.listen(0, "127.0.0.1", () => resolve({ origin: "http://127.0.0.1:" + (s.address() as AddressInfo).port, close: () => { s.closeAllConnections(); s.close(); } })));
}

test("resource policy defaults: 10 MB retained HTML, separate transfer and decoded limits, bounded retries", () => {
  const p = resourcePolicy({});
  assert.equal(p.maxHtmlBytes, 10 * MB); assert.equal(p.maxTransferBytes, 15 * MB); assert.equal(p.maxDecodedBytes, 60 * MB); assert.equal(p.retries, 1);
  const tuned = resourcePolicy({ VISTA_CRAWL_MAX_HTML_MB: "4", VISTA_CRAWL_RETRIES: "9", VISTA_CRAWL_MAX_TRANSFER_MB: "abc" });
  assert.equal(tuned.maxHtmlBytes, 4 * MB); assert.equal(tuned.retries, 3, "retries are clamped"); assert.equal(tuned.maxTransferBytes, 15 * MB, "invalid values fall back");
});

test("streaming reducer keeps SEO evidence and JSON-LD while discarding scripts, styles, SVG and data URIs", () => {
  const { html, stats } = reduceHtml(heavyPage(3) + "<!-- " + "c".repeat(100000) + " -->");
  assert.ok(html.length < 40_000, "reduced to " + html.length);
  assert.ok(html.includes('"@type":"Organization"'));
  assert.ok(html.includes("<title>Heavy Co laboratory medicine training courses</title>"));
  assert.ok(html.includes('src="data:,"') && stats.dataUris === 1);
  assert.ok(stats.inlineScriptBytes > 3 * MB && stats.jsonLdBytes > 50);
  assert.ok(!html.includes("var x="));
  // Malformed markup and a script closing tag split across chunks.
  const split = reduceHtml('<div><p>Unclosed <b>bold <script>var a="x";</scr' + 'ipt><p>after</p><a href="/x">link');
  assert.ok(split.html.includes("after") && split.html.includes('href="/x"') && !split.html.includes("var a"));
});

test("pages over 1 MB, 5 MB and 10 MB are retrieved and analysed; compressed responses decode safely", async () => {
  const pages: Record<string, string> = { "/1mb": heavyPage(1.2), "/5mb": heavyPage(5.5), "/12mb": heavyPage(12) };
  const huge = "<html><head><title>Huge text page</title></head><body>" + "<p>Paragraph of real text content for the page. </p>".repeat(260000) + "</body></html>";
  const site = await server((req, res) => {
    const url = new URL(req.url!, "http://x");
    if (url.pathname === "/robots.txt") { res.writeHead(404); res.end(); return; }
    if (url.pathname === "/huge-text") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(huge); return; }
    const body = pages[url.pathname.replace(/\/(gzip|br|deflate)$/, "")];
    if (!body) { res.writeHead(404, { "Content-Type": "text/html" }); res.end("missing"); return; }
    const enc = url.pathname.match(/(gzip|br|deflate)$/)?.[1];
    const payload = enc === "gzip" ? zlib.gzipSync(body) : enc === "br" ? zlib.brotliCompressSync(body) : enc === "deflate" ? zlib.deflateSync(body) : Buffer.from(body);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...(enc ? { "Content-Encoding": enc } : {}) });
    res.end(payload);
  });
  process.env.VISTA_TEST_CRAWL_ORIGINS = site.origin;
  try {
    for (const path of ["/1mb", "/5mb", "/12mb", "/12mb/gzip", "/5mb/br", "/1mb/deflate"]) {
      const r = await crawlPage(site.origin + path, 0, ["laboratory medicine"]);
      assert.ok(r.page, path + " " + JSON.stringify(r.failure));
      assert.equal(r.page!.title, "Heavy Co laboratory medicine training courses");
      assert.ok(r.page!.schema.types.includes("Organization"), path + " keeps JSON-LD");
      assert.ok(r.page!.retrieval!.decodedBytes > (path.startsWith("/12") ? 12 * MB : path.startsWith("/5") ? 5 * MB : 1 * MB));
      if (/gzip|br|deflate/.test(path)) { assert.ok(r.page!.retrieval!.transferBytes < r.page!.retrieval!.decodedBytes, path + " compressed"); assert.ok(["gzip", "br", "deflate"].includes(r.page!.retrieval!.encoding)); }
      assert.equal(r.page!.keywords[0].inTitle, true);
      assert.ok(r.page!.performance.htmlBytes > MB);
    }
    // More than 10 MB of retained text: bounded streaming keeps the first 10 MB and marks truncation.
    const text = await crawlPage(site.origin + "/huge-text", 0);
    assert.ok(text.page, JSON.stringify(text.failure));
    assert.equal(text.page!.retrieval!.truncated, true);
    assert.ok(text.page!.retrieval!.retainedBytes <= 10 * MB);
  } finally { delete process.env.VISTA_TEST_CRAWL_ORIGINS; site.close(); }
});

test("decompression bombs, declared oversize bodies and corrupt encodings are stopped with explanations", async () => {
  const bomb = zlib.gzipSync(Buffer.alloc(80 * MB, 0x20));
  const site = await server((req, res) => {
    if (req.url === "/bomb") { res.writeHead(200, { "Content-Type": "text/html", "Content-Encoding": "gzip" }); res.end(bomb); return; }
    if (req.url === "/declared") { res.writeHead(200, { "Content-Type": "text/html", "Content-Length": String(40 * MB) }); res.write("<html>"); setTimeout(() => res.destroy(), 50); return; }
    if (req.url === "/corrupt") { res.writeHead(200, { "Content-Type": "text/html", "Content-Encoding": "gzip" }); res.end(Buffer.from("not gzip at all")); return; }
    if (req.url === "/zstd") { res.writeHead(200, { "Content-Type": "text/html", "Content-Encoding": "zstd" }); res.end("x"); return; }
    res.writeHead(404); res.end();
  });
  process.env.VISTA_TEST_CRAWL_ORIGINS = site.origin;
  try {
    const started = Date.now();
    await assert.rejects(fetchPublic(site.origin + "/bomb", { reduce: true, retries: 0 }), (e: FetchFailure) => e.kind === "decompression-limit" && /decompression|processing/.test(e.message));
    assert.ok(Date.now() - started < 10000, "bomb stopped early");
    await assert.rejects(fetchPublic(site.origin + "/declared", { retries: 0 }), (e: FetchFailure) => e.kind === "too-large" && /declares 40 MB/.test(e.message));
    await assert.rejects(fetchPublic(site.origin + "/corrupt", { retries: 0 }), (e: FetchFailure) => e.kind === "decode");
    await assert.rejects(fetchPublic(site.origin + "/zstd", { retries: 0 }), (e: FetchFailure) => e.kind === "decode");
  } finally { delete process.env.VISTA_TEST_CRAWL_ORIGINS; site.close(); }
});

test("slow servers time out with an explanation; transient 503s and resets are retried within limits", async () => {
  let flaky = 0, reset = 0;
  const site = await server((req, res) => {
    if (req.url === "/slow") { res.writeHead(200, { "Content-Type": "text/html" }); res.write("<html><title>slow"); return; }
    if (req.url === "/flaky") { flaky += 1; if (flaky === 1) { res.writeHead(503, { "Content-Type": "text/html" }); res.end("busy"); return; } res.writeHead(200, { "Content-Type": "text/html" }); res.end("<html><title>Recovered after a retry</title></html>"); return; }
    if (req.url === "/reset") { reset += 1; if (reset === 1) { req.socket.destroy(); return; } res.writeHead(200, { "Content-Type": "text/html" }); res.end("<html><title>Recovered after reset</title></html>"); return; }
    if (req.url === "/always503") { res.writeHead(503, { "Content-Type": "text/html" }); res.end("down"); return; }
    res.writeHead(404); res.end();
  });
  process.env.VISTA_TEST_CRAWL_ORIGINS = site.origin;
  try {
    await assert.rejects(fetchPublic(site.origin + "/slow", { timeoutMs: 3000, retries: 0 }), (e: FetchFailure) => e.kind === "timeout");
    const recovered = await fetchPublic(site.origin + "/flaky", { timeoutMs: 4000, retries: 1 });
    assert.equal(recovered.status, 200); assert.equal(recovered.retrieval.attempts, 2);
    const afterReset = await fetchPublic(site.origin + "/reset", { timeoutMs: 4000, retries: 1 });
    assert.equal(afterReset.status, 200); assert.equal(afterReset.retrieval.attempts, 2);
    const down = await crawlPage(site.origin + "/always503", 1);
    assert.equal(down.failure?.kind, "http-error"); assert.equal(down.failure?.status, 503);
  } finally { delete process.env.VISTA_TEST_CRAWL_ORIGINS; site.close(); }
});

test("an oversized or failing home page does not stop discovery: sitemaps still supply the inventory", async () => {
  const urls = Array.from({ length: 30 }, (_, i) => "/page-" + i);
  let origin = "";
  const site = await server((req, res) => {
    if (req.url === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("User-agent: *\nAllow: /\nSitemap: " + origin + "/sitemap_index.xml"); return; }
    if (req.url === "/sitemap_index.xml") { res.writeHead(200, { "Content-Type": "application/xml" }); res.end("<sitemapindex><sitemap><loc>" + origin + "/post-sitemap.xml</loc></sitemap></sitemapindex>"); return; }
    if (req.url === "/post-sitemap.xml") { res.writeHead(200, { "Content-Type": "application/xml" }); res.end("<urlset>" + urls.map(u => "<url><loc>" + origin + u + "</loc></url>").join("") + "</urlset>"); return; }
    if (req.url === "/") { res.writeHead(500, { "Content-Type": "text/html" }); res.end("error"); return; }
    res.writeHead(200, { "Content-Type": "text/html" }); res.end("<html><title>" + req.url + "</title></html>");
  });
  origin = site.origin;
  process.env.VISTA_TEST_CRAWL_ORIGINS = site.origin;
  try {
    const d = await discover(site.origin + "/");
    assert.equal(d.home, null);
    assert.equal(d.homeFailure?.status, 500);
    assert.equal(d.sitemapUrls.length, 30, "sitemap index followed despite the failed home page");
  } finally { delete process.env.VISTA_TEST_CRAWL_ORIGINS; site.close(); }
});
