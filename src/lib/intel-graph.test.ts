import test from "node:test";
import assert from "node:assert/strict";
import { analysePage } from "./intel/page";
import { buildGraph, pagerank } from "./intel/graph";

const page = (url: string, links: string[], extra = "") => analysePage({ url, finalUrl: url, status: 200, chain: [], headers: {}, html: `<html><head><title>${url}</title>${extra}</head><body><nav>${links.map(l => `<a href="${l}">${l}</a>`).join("")}</nav><p>Laboratory training.</p></body></html>`, fetchedAt: "2026-11-28T10:00:00.000Z", durationMs: 0, depth: 1 });
const site = "https://client.example";
const footer = ["/privacy", "/terms"];
const clientPages = [
  page(site + "/", ["/courses", "/courses/histology", ...footer, "https://ibms.org/", "https://www.facebook.com/client"], `<script type="application/ld+json">{"@type":"Organization","name":"Client Academy","sameAs":["https://www.facebook.com/client"]}</script>`),
  page(site + "/courses", ["/courses/histology", "/courses/microbiology", ...footer, "https://ibms.org/"]),
  page(site + "/courses/histology", ["/courses", ...footer]),
  page(site + "/courses/microbiology", ["/courses/histology", ...footer]),
  page(site + "/about", [...footer, "https://ukas.com/"]),
];
const rival = "https://rival.example/";
const input = {
  website: site + "/", pages: clientPages,
  competitorPages: { [rival]: [page(rival, ["https://ibms.org/", "https://ukas.com/", "https://www.linkedin.com/company/rival"])], "https://rejected-university.ac.uk/": [page("https://rejected-university.ac.uk/", ["https://weibo.com/x", "https://football.example/"])] },
  competitors: [{ name: "Rival Training", website: rival }],
  sourcePages: [page("https://careers.example.org/labs", [site + "/courses/histology", rival])],
  citations: [{ url: "https://ibms.org/education", at: "2026-11-28" }, { url: "https://ibms.org/registration", at: "2026-11-28" }],
  priority: [site + "/courses/histology", site + "/courses/microbiology", site + "/about"],
  at: "2026-11-28T12:00:00.000Z",
};

test("PageRank: rank flows to linked nodes and sums to one", () => {
  const r = pagerank(["a", "b", "c"], [["a", "c"], ["b", "c"], ["c", "a"]]);
  const total = [...r.values()].reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 1e-6);
  assert.ok(r.get("c")! > r.get("a")! && r.get("a")! > r.get("b")!);
});

test("VisTa Graph: internal authority discounts template links and flags weakly linked priority pages", () => {
  const g = buildGraph(input);
  const auth = (path: string) => g.internal.find(p => p.url === site + path)!.authority;
  assert.ok(auth("/courses/histology") > auth("/privacy"), "content links outweigh footer links");
  assert.deepEqual(g.weakPriority, [site + "/about"], "no sampled page links to /about");
  assert.ok(!g.weakPriority.includes(site + "/courses/microbiology"));
});

test("VisTa Graph: observed referring domains, co-citation and coverage are evidence-only", () => {
  const g = buildGraph(input);
  assert.deepEqual(g.referringToClient.map(r => r.domain), ["example.org"], "registrable domain");
  assert.deepEqual(g.referringToClient[0].pages, ["https://careers.example.org/labs"]);
  const ibms = g.coCitation.find(c => c.domain === "ibms.org")!;
  assert.deepEqual(ibms.linkedBy, ["Rival Training", "client"]);
  assert.equal(ibms.citations, 2);
  assert.ok(g.coCitation.some(c => c.domain === "ukas.com"), "linked by the client and the rival");
  assert.ok(!g.domains.some(d => d.domain === "football.example" || d.domain === "weibo.com"), "a rejected candidate's links are not part of the sector graph");
  assert.ok(g.domains.find(d => d.domain === "linkedin.com")!.platform);
  assert.equal(g.domains.find(d => d.domain === "rival.example")!.kind, "competitor");
  assert.match(g.coverage.statement, /^Observed links only: 7 pages crawled by VisTa on 3 websites, plus 2 citations/);
  assert.match(g.coverage.statement, /not a global backlink index/);
  assert.equal(g.entities.organisations[0].name, "Client Academy");
  assert.ok(g.entities.profiles.includes("https://www.facebook.com/client"));
  assert.deepEqual(buildGraph(input), g, "deterministic");
});
