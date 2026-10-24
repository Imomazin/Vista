import test from "node:test";
import assert from "node:assert/strict";
import { buildOpportunities, latestProjectSnapshots, technicalTrend } from "./opportunities";
import type { Workspace } from "./workspace";

const base: Workspace = {
  version: 1,
  projects: [{ id: "p", name: "Alpha", url: "https://alpha.test", audience: "", goal: "" }],
  snapshots: [],
  briefs: [],
  observations: [],
  completed: [],
};

function snapshot(url: string, at: string, score: number, status: "issue" | "warning" | "pass") {
  return {
    id: at + url,
    projectId: "p",
    report: {
      url,
      inspectedAt: at,
      title: "Alpha",
      description: null,
      canonical: null,
      language: "en",
      headingOneCount: 1,
      headingTwoCount: 0,
      imageCount: 0,
      imagesMissingAlt: 0,
      structuredDataBlocks: 0,
      technicalScore: score,
      signals: [{ id: "title", name: "Title", detail: "Page title check", status, recommendation: "Edit the page title" }],
      limitations: [],
    },
  };
}

test("only latest evidence per exact page contributes to radar and project score", () => {
  const w: Workspace = {
    ...base,
    snapshots: [
      snapshot("https://alpha.test/a", "2026-10-01T00:00:00Z", 20, "issue"),
      snapshot("https://alpha.test/a", "2026-10-03T00:00:00Z", 90, "pass"),
      snapshot("https://alpha.test/b", "2026-10-02T00:00:00Z", 50, "warning"),
    ],
  };
  const opportunities = buildOpportunities(w);
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].status, "warning");
  assert.equal(opportunities[0].affectedPages, 1);
  assert.equal(latestProjectSnapshots(w).length, 2);
  assert.deepEqual(technicalTrend(w, "p", "https://alpha.test/a").map(v => v.score), [20, 90]);
});

test("repeat issues increase technical priority without claiming revenue impact", () => {
  const w: Workspace = {
    ...base,
    snapshots: [
      snapshot("https://alpha.test/a", "2026-10-01T00:00:00Z", 20, "issue"),
      snapshot("https://alpha.test/b", "2026-10-02T00:00:00Z", 30, "issue"),
    ],
  };
  const opportunities = buildOpportunities(w);
  assert.equal(opportunities.length, 2);
  assert.ok(opportunities.every(o => o.priority === "Priority" && o.affectedPages === 2 && o.score === 81));
});

test("a new audit with no issues removes resolved technical findings", () => {
  const w: Workspace = {...base, snapshots: [
    snapshot("https://alpha.test/a", "2026-10-01T00:00:00Z", 30, "issue"),
    snapshot("https://alpha.test/a", "2026-10-02T00:00:00Z", 100, "pass"),
  ]};
  assert.deepEqual(buildOpportunities(w), []);
});
