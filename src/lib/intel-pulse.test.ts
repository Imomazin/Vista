import test from "node:test";
import assert from "node:assert/strict";
import { assess, competitorChanges, pageChanges, robustBaseline } from "./intel/pulse";
import { analysePage } from "./intel/page";
import type { Investigation } from "./intel/model";

const pts = (values: number[]) => values.map((value, i) => ({ at: "2026-0" + (i + 1) + "-01T00:00:00Z", value, ref: "r" + i }));
const def = (values: number[], better: "higher" | "lower" | "neither" = "lower") => ({ id: "m", label: "Metric", unit: "", better, basis: "observed" as const, points: pts(values) });

test("Pulse: robust baseline and anomaly detection", () => {
  assert.deepEqual(robustBaseline([4, 5, 6, 100]), { n: 4, median: 5.5, mad: 1 });
  const normal = assess(def([10, 12, 11, 13, 12]));
  assert.equal(normal.status, "normal");
  const spike = assess(def([10, 12, 11, 13, 40]));
  assert.equal(spike.status, "anomaly");
  assert.equal(spike.direction, "worse", "more of a lower-is-better metric is worse");
  assert.ok(spike.z! >= 3.5);
  const better = assess(def([60, 62, 61, 63, 95], "higher"));
  assert.equal(better.status, "anomaly");
  assert.equal(better.direction, "better");
});

test("Pulse: insufficient history is not an alert; a steady baseline reports changes", () => {
  const short = assess(def([3, 9]));
  assert.equal(short.status, "insufficient");
  assert.equal(short.z, null);
  assert.match(short.message, /a baseline needs 3/);
  const steady = assess(def([0, 0, 0, 2]));
  assert.equal(steady.status, "changed");
  assert.equal(steady.direction, "worse");
  assert.match(steady.message, /Changed from a steady 0 to 2/);
  assert.equal(assess(def([0, 0, 0, 0])).status, "normal");
});

const page = (url: string, title: string, words: number, status = 200, noindex = false) => analysePage({ url, finalUrl: url, status, chain: [], headers: {}, html: `<html><head><title>${title}</title>${noindex ? '<meta name="robots" content="noindex">' : ""}</head><body><p>${"word ".repeat(words)}</p></body></html>`, fetchedAt: "2026-11-01T00:00:00Z", durationMs: 0, depth: 1 });
const inv = (pages: ReturnType<typeof page>[], competitors: Investigation["competitors"] = []) => ({ pages, competitors, job: { status: "complete" } }) as unknown as Investigation;

test("Pulse: page changes between investigations (status, indexability, decay, title, removed, added)", () => {
  const before = inv([page("https://a.example/", "Home", 300), page("https://a.example/courses", "Courses", 600), page("https://a.example/old", "Old", 200), page("https://a.example/fees", "Fees", 200), page("https://a.example/blog", "Blog", 200)]);
  const after = inv([page("https://a.example/", "Home | A", 300), page("https://a.example/courses", "Courses", 200), page("https://a.example/fees", "Fees", 200, 404), page("https://a.example/blog", "Blog", 200, 200, true), page("https://a.example/new", "New", 200)]);
  const kinds = pageChanges(before, after).map(c => c.kind + " " + new URL(c.url).pathname);
  assert.deepEqual(kinds, ["status /fees", "noindex /blog", "decay /courses", "removed /old", "title /", "added /new"]);
});

test("Pulse: competitor website changes on pages sampled in both investigations", () => {
  const snap = (title: string) => [{ website: "https://rival.example/", name: "Rival", pages: [page("https://rival.example/", title, 300)] }] as unknown as Investigation["competitors"];
  const changes = competitorChanges(inv([], snap("Rival Training")), inv([], snap("Rival Training | Now with NHS placements")));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].name, "Rival");
  assert.equal(changes[0].changed[0].kind, "title");
});
