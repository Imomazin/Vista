import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { cronAuthorised, runSpider, spiderConfigured } from "./intel/spider";
import { analysePage } from "./intel/page";

test("VisTa Spider: inactive until migrations and secrets exist; cron authorisation is exact", () => {
  assert.equal(spiderConfigured({}), false);
  const secret = "s".repeat(40);
  assert.equal(cronAuthorised(new Request("https://x.example/", { headers: { authorization: "Bearer " + secret } }), { CRON_SECRET: secret }), true);
  assert.equal(cronAuthorised(new Request("https://x.example/", { headers: { authorization: "Bearer wrong" } }), { CRON_SECRET: secret }), false);
  assert.equal(cronAuthorised(new Request("https://x.example/"), { CRON_SECRET: "short" }), false, "short secrets are refused");
});

test("VisTa Spider worker: schedules, claims, crawls, records observations and finishes under lease", async () => {
  process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  const calls: { path: string; body: Record<string, unknown>; token?: string }[] = [];
  const call = (async (path: string, init: RequestInit = {}, token?: string) => {
    const body = JSON.parse(String(init.body || "{}"));
    calls.push({ path, body, token });
    if (path.endsWith("vista_spider_schedule")) return 2;
    if (path.endsWith("vista_spider_claim")) return [{ id: 1, url: "https://ok.example/", host: "ok.example", render: false, lease_token: "t1" }, { id: 2, url: "https://down.example/", host: "down.example", render: true, lease_token: "t2" }];
    if (path.endsWith("vista_spider_finish")) return body.job === 1;
    return null;
  }) as never;
  const crawl = (async (url: string, _d: number, _k: string[], _dl: number, opts: { render?: boolean }) => url.startsWith("https://ok") ? { page: analysePage({ url, finalUrl: url, status: 200, chain: [], headers: {}, html: "<html><head><title>OK</title></head><body><h1>Training</h1><a href='https://ibms.org/'>IBMS</a></body></html>", fetchedAt: "2026-11-28T03:23:00Z", durationMs: 1, depth: 1 }) } : { failure: { url, depth: 1, kind: "dns", message: "The hostname did not resolve." + (opts.render ? " (render)" : ""), chain: [] } }) as never;
  const run = await runSpider({ call, crawl });
  assert.deepEqual(run, { scheduled: 2, claimed: 2, done: 1, failed: 0, lost: 1, observations: 1 });
  assert.ok(calls.every(c => c.token === "service-role-test"), "service role used for worker RPCs");
  const obs = calls.find(c => c.path.startsWith("/rest/v1/vista_index_observations"))!;
  assert.equal(obs.body.key, "ok.example");
  assert.equal(obs.body.source, "vista");
  assert.deepEqual((obs.body.links_out as { external: string[] }).external, ["https://ibms.org/"]);
  const finishes = calls.filter(c => c.path.endsWith("vista_spider_finish")).map(c => c.body);
  assert.deepEqual(finishes[0], { job: 1, fence: "t1", failure: null });
  assert.match(String(finishes[1].failure), /did not resolve/);
  delete process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY;
});

const chromium = ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", process.env.VISTA_CHROMIUM_PATH || ""].find(p => p && existsSync(p));
test("VisTa Spider rendering: JavaScript content is rendered and private-network requests are blocked", { skip: !chromium && "no local Chromium" }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/app.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end("document.getElementById('root').innerHTML='<h1>Rendered analytics platform</h1><p>Dashboards and funnels for product teams.</p>';fetch('http://10.1.2.3/x').catch(function(){});"); }
    res.writeHead(200, { "Content-Type": "text/html" }); res.end('<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", () => r()));
  const origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  process.env.VISTA_TEST_CRAWL_ORIGINS = origin; process.env.VISTA_CHROMIUM_PATH = chromium;
  try {
    const { renderLocally } = await import("./intel/render-local");
    const r = await renderLocally(origin + "/", 2_000_000, 20000);
    const page = analysePage({ url: origin + "/", finalUrl: origin + "/", status: 200, chain: [], headers: {}, html: r.html, fetchedAt: new Date().toISOString(), durationMs: 0, depth: 0, rendered: true });
    assert.deepEqual(page.h1, ["Rendered analytics platform"]);
    assert.ok(r.blocked >= 1, "the private-address request was blocked");
  } finally { server.close(); delete process.env.VISTA_TEST_CRAWL_ORIGINS; delete process.env.VISTA_CHROMIUM_PATH; }
});
