import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { ccDate, domainCaptures, fetchArchived, retryDelays, surtDomain } from "./intel/commoncrawl";
import { compareObservations, observe, pageKey, similarity } from "./intel/observations";
import { analysePage } from "./intel/page";

retryDelays.splice(0, retryDelays.length, 0, 0);
const crawl = "CC-MAIN-2026-47";
const filename = "crawl-data/CC-MAIN-2026-47/segments/1762439342658.19/warc/CC-MAIN-20261111-00001.warc.gz";

/** A synthetic ZipNum archive: cluster.idx lines pointing at gzip blocks of CDX lines, and a WARC file. */
function archive() {
  const keys = ["com,aaa)/", "com,bbb)/", "com,example)/", "com,example)/about", "com,example,blog)/post", "com,examplez)/", "com,zzz)/"];
  const cdx = (key: string, i: number) => key + " 2026111" + (i % 10) + "120000 " + JSON.stringify({ url: "https://" + key.split(")")[0].split(",").reverse().join(".") + key.slice(key.indexOf(")") + 1), mime: "text/html", "mime-detected": "text/html", status: "200", digest: "D" + i, length: String(WARC.length), offset: "0", filename });
  // Two keys per block.
  const blocks: Buffer[] = [];
  for (let i = 0; i < keys.length; i += 2) blocks.push(gzipSync(keys.slice(i, i + 2).map((k, j) => cdx(k, i + j)).join("\n") + "\n"));
  let offset = 0;
  const idx = blocks.map((b, i) => { const line = keys[i * 2] + " 20261110000000\tcdx-00000.gz\t" + offset + "\t" + b.length + "\t" + (i + 1); offset += b.length; return line; }).join("\n") + "\n";
  // Pad the index so the binary search runs over several windows.
  const padded = Array.from({ length: 400 }, (_, i) => "aaa,pad" + String(i).padStart(4, "0") + ")/ 20261110000000\tcdx-00000.gz\t0\t" + blocks[0].length + "\t0").join("\n") + "\n" + idx;
  return { idx: Buffer.from(padded), cdx: Buffer.concat(blocks) };
}
const html = (title: string, h1: string, body: string) => `<html><head><title>${title}</title><meta name="description" content="${h1}"></head><body><h1>${h1}</h1><h2>Courses</h2><p>${body}</p><a href="/about">About</a></body></html>`;
const WARC = gzipSync(Buffer.from("WARC/1.0\r\nWARC-Type: response\r\nWARC-Date: 2026-11-11T12:00:00Z\r\nWARC-Target-URI: https://example.com/\r\nContent-Type: application/http; msgtype=response\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nSet-Cookie: session=secret\r\n\r\n" + html("Example Training | Example", "Laboratory training", "Histology training in London for graduates. ".repeat(20)), "latin1"));

function fakeArchive(fail503 = 0) {
  const { idx, cdx } = archive();
  let failures = fail503, calls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const url = String(input);
    if (failures > 0) { failures -= 1; return new Response("slow down", { status: 503 }); }
    const file = url.endsWith("cluster.idx") ? idx : url.endsWith("cdx-00000.gz") ? cdx : url.endsWith(".warc.gz") ? WARC : null;
    if (!file) return new Response("missing", { status: 404 });
    const [a, b] = String((init?.headers as Record<string, string>).Range).replace("bytes=", "").split("-").map(Number);
    return new Response(file.subarray(a, Math.min(file.length, b + 1)), { status: 206, headers: { "Content-Range": "bytes " + a + "-" + b + "/" + file.length } });
  }) as typeof fetch;
  return { fetcher, calls: () => calls };
}

test("Common Crawl: SURT keys and dates", () => {
  assert.equal(surtDomain("www.LabMedExpert.com"), "com,labmedexpert");
  assert.equal(surtDomain("imoenang.co.uk"), "uk,co,imoenang");
  assert.throws(() => surtDomain("10.0.0.1"));
  assert.equal(ccDate("20261117130655"), "2026-11-17T13:06:55Z");
});

test("Common Crawl: binary search finds the domain and its subdomains, not look-alike domains", async () => {
  const svc = fakeArchive();
  const r = await domainCaptures("example.com", crawl, { fetcher: svc.fetcher });
  assert.deepEqual(r.captures.map(c => c.url).sort(), ["https://blog.example.com/post", "https://example.com/", "https://example.com/about"]);
  assert.ok(!r.captures.some(c => c.url.includes("examplez")), "examplez.com is a different domain");
  assert.equal(r.crawl, crawl);
  assert.ok(r.requests < 20, "bounded requests: " + r.requests);
  assert.match(r.first, /^2026-11-1\dT12:00:00Z$/);
  const none = await domainCaptures("missing-site.com", crawl, { fetcher: fakeArchive().fetcher });
  assert.equal(none.uniqueUrls, 0);
  await assert.rejects(domainCaptures("example.com", "../etc", { fetcher: svc.fetcher }), /Unknown crawl/);
});

test("Common Crawl: throttling is retried politely, archived pages are parsed without their headers", async () => {
  const svc = fakeArchive(2);
  const r = await domainCaptures("example.com", crawl, { fetcher: svc.fetcher });
  assert.equal(r.uniqueUrls, 3, "two 503 responses were retried");
  const rec = await fetchArchived({ filename, offset: 0, length: WARC.length }, { fetcher: fakeArchive().fetcher });
  assert.equal(rec.status, 200);
  assert.equal(rec.capturedAt, "2026-11-11T12:00:00Z");
  assert.ok(rec.html.startsWith("<html>"));
  assert.ok(!JSON.stringify(rec).includes("secret"), "captured cookies are not returned");
  await assert.rejects(fetchArchived({ filename: "../../etc/passwd", offset: 0, length: 10 }, { fetcher: svc.fetcher }), /Invalid archive record path/);
  await assert.rejects(fetchArchived({ filename, offset: 0, length: 9_000_000 }, { fetcher: svc.fetcher }), /larger than/);
});

test("observations: archived versus live comparison reports what changed", () => {
  const page = (title: string, h1: string, body: string, at: string) => analysePage({ url: "https://example.com/", finalUrl: "https://example.com/", status: 200, chain: [], headers: {}, html: html(title, h1, body), fetchedAt: at, durationMs: 0, depth: 0 });
  const before = observe(page("Example Training | Example", "Laboratory training", "Histology training in London for graduates. ".repeat(20), "2026-07-14T00:00:00Z"), "common-crawl", "CC-MAIN-2026-30");
  const same = compareObservations(before, observe(page("Example Training | Example", "Laboratory training", "Histology training in London for graduates. ".repeat(20), "2026-11-28T00:00:00Z"), "vista"));
  assert.ok(same.unchanged && same.similarity === 1 && !same.changes.length);
  const after = observe(page("NHS-ready laboratory training | Example", "NHS-ready laboratory training", "Microbiology and biochemistry courses with NHS placements for international students. ".repeat(40), "2026-11-28T00:00:00Z"), "vista");
  const diff = compareObservations(before, after);
  assert.ok(!diff.unchanged);
  assert.deepEqual(diff.changes.filter(c => c.major).map(c => c.field).sort(), ["h1", "title", "words"]);
  assert.ok(diff.similarity !== null && diff.similarity < 0.5);
  assert.equal(diff.before.crawl, "CC-MAIN-2026-30");
  assert.equal(pageKey("http://www.Example.com/about/"), pageKey("https://example.com/about"));
  assert.equal(similarity([], [1]), null);
});

test("reducer: a multi-megabyte inline data: URI does not become page text (word counts stay true)", async () => {
  const { reduceHtml, HtmlReducer } = await import("./intel/reducer");
  const b64 = "iVBORw0KGgoAAAANSUhEUgAA+/".repeat(120_000); // about 3 MB
  const html = `<html><head><title>T</title><style>.a{}</style></head><body><h1>Laboratory training</h1><img alt="logo" src="data:image/png;base64,${b64}" width="10"><p>Histology and microbiology courses.</p><script>var x=1;</script><p>Apply now.</p></body></html>`;
  const once = reduceHtml(html);
  assert.ok(once.html.length < 2000, "data URI removed: " + once.html.length);
  assert.ok(once.html.includes('<img alt="logo" src="data:," width="10">'), "the tag stays intact");
  assert.ok(once.html.includes("<p>Histology and microbiology courses.</p>") && once.html.includes("<p>Apply now.</p>"));
  assert.ok(!/iVBOR/.test(once.html));
  assert.equal(once.stats.dataUris, 1);
  // Streaming in small chunks gives the same result.
  const r = new HtmlReducer(10_000_000);
  for (let i = 0; i < html.length; i += 4096) r.feed(html.slice(i, i + 4096));
  assert.equal(r.finish().html, once.html);
  const page = analysePage({ url: "https://x.example/", finalUrl: "https://x.example/", status: 200, chain: [], headers: {}, html: once.html, fetchedAt: "2026-11-28T00:00:00Z", durationMs: 0, depth: 0 });
  assert.ok(page.content.words < 20, String(page.content.words));
});

test("observations: an archive copy cut short is compared on head fields only", () => {
  const p = (title: string, words: number) => analysePage({ url: "https://example.com/", finalUrl: "https://example.com/", status: 200, chain: [], headers: {}, html: html(title, "H", "word ".repeat(words)), fetchedAt: "2026-11-01T00:00:00Z", durationMs: 0, depth: 0 });
  const c = compareObservations(observe(p("Old title", 50), "common-crawl"), observe(p("New title", 900), "vista"), { beforePartial: true });
  assert.deepEqual(c.changes.map(x => x.field), ["title"], "word count is not compared against a truncated copy");
  assert.equal(c.similarity, null);
  assert.match(c.limitation!, /cut short/);
});
