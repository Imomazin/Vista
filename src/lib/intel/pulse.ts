/**
 * VisTa Pulse: baselines, anomaly detection and change monitoring over a client's investigation
 * history. Robust statistics (median and median absolute deviation), so one unusual run does not
 * distort the baseline; too little history is reported as such rather than as an alert.
 * Methodology: docs/proprietary-intelligence.md#5-vista-pulse-monitoring
 */
import type { Investigation } from "./model";
import type { PerformanceResult } from "./psi";
import type { Analysis } from "./analysis";
import { pageKey } from "./observations";

export type Point = { at: string; value: number; ref: string };
export type Baseline = { n: number; median: number; mad: number };
export type SignalStatus = "normal" | "anomaly" | "changed" | "insufficient";
export type Signal = {
  id: string; label: string; unit: string; better: "higher" | "lower" | "neither"; basis: "observed" | "measured" | "estimate";
  points: Point[]; latest: Point | null; baseline: Baseline | null; z: number | null; status: SignalStatus; direction: "better" | "worse" | "neutral" | null; message: string;
};

export const pulseMethod = "VisTa Pulse v1: each metric's latest value is compared with the median of the earlier investigations; robust z = 0.6745 × (latest − median) ÷ MAD. |z| ≥ 3.5 is an anomaly. When earlier values are all identical (MAD = 0), any difference is reported as a change. Fewer than 3 earlier investigations: insufficient history.";
export const minHistory = 3;

const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
export function robustBaseline(values: number[]): Baseline {
  const m = median(values);
  return { n: values.length, median: m, mad: median(values.map(v => Math.abs(v - m))) };
}

export function assess(def: Omit<Signal, "latest" | "baseline" | "z" | "status" | "direction" | "message">): Signal {
  const points = def.points.slice().sort((a, b) => a.at.localeCompare(b.at));
  const latest = points[points.length - 1] || null;
  const earlier = points.slice(0, -1).map(p => p.value);
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-GB") + def.unit;
  if (!latest) return { ...def, points, latest, baseline: null, z: null, status: "insufficient", direction: null, message: "No observations yet." };
  if (earlier.length < minHistory) return { ...def, points, latest, baseline: earlier.length ? robustBaseline(earlier) : null, z: null, status: "insufficient", direction: null, message: "Latest " + fmt(latest.value) + ". " + earlier.length + " earlier investigation" + (earlier.length === 1 ? "" : "s") + "; a baseline needs " + minHistory + "." };
  const baseline = robustBaseline(earlier);
  const diff = latest.value - baseline.median;
  const direction = diff === 0 || def.better === "neither" ? (diff === 0 ? null : "neutral") : (diff > 0) === (def.better === "higher") ? "better" : "worse";
  if (baseline.mad === 0) {
    const status: SignalStatus = diff === 0 ? "normal" : "changed";
    return { ...def, points, latest, baseline, z: null, status, direction, message: status === "normal" ? "Steady at " + fmt(latest.value) + "." : "Changed from a steady " + fmt(baseline.median) + " to " + fmt(latest.value) + "." };
  }
  const z = Math.round(0.6745 * diff / baseline.mad * 10) / 10;
  const status: SignalStatus = Math.abs(z) >= 3.5 ? "anomaly" : "normal";
  return { ...def, points, latest, baseline, z, status, direction, message: (status === "anomaly" ? "Anomaly: " : "") + fmt(latest.value) + " against a baseline median of " + fmt(baseline.median) + " (robust z " + z + ")." };
}

const mobileScore = (perf: PerformanceResult[]) => { const s = perf.filter(p => p.strategy === "mobile" && typeof p.lab.score === "number").map(p => p.lab.score as number); return s.length ? median(s) : null; };

/** Metrics per completed investigation, oldest first; each carries its evidence basis. */
export function pulseSignals(history: { inv: Investigation; analysis: Analysis }[]): Signal[] {
  const runs = history.filter(h => h.inv.pages.length).sort((a, b) => a.inv.createdAt.localeCompare(b.inv.createdAt));
  const series = (fn: (h: { inv: Investigation; analysis: Analysis }) => number | null) => runs.map(h => ({ at: h.inv.createdAt, value: fn(h), ref: h.inv.id })).filter((p): p is Point => typeof p.value === "number" && Number.isFinite(p.value));
  const dim = (id: string) => (h: { analysis: Analysis }) => h.analysis.index.dimensions.find(d => d.id === id)?.score ?? null;
  const defs: Omit<Signal, "latest" | "baseline" | "z" | "status" | "direction" | "message">[] = [
    { id: "index", label: "Intelligence Index", unit: "", better: "higher", basis: "estimate", points: series(h => h.analysis.index.index) },
    { id: "technical", label: "Technical SEO score", unit: "", better: "higher", basis: "estimate", points: series(dim("technical")) },
    { id: "content", label: "Content score", unit: "", better: "higher", basis: "estimate", points: series(dim("content")) },
    { id: "pages", label: "Pages analysed", unit: "", better: "neither", basis: "observed", points: series(h => h.analysis.site.crawled) },
    { id: "failed", label: "Pages that failed", unit: "", better: "lower", basis: "observed", points: series(h => h.analysis.site.failed) },
    { id: "broken", label: "Broken internal links", unit: "", better: "lower", basis: "observed", points: series(h => h.analysis.site.brokenInternal.length) },
    { id: "nonindexable", label: "Non-indexable pages", unit: "%", better: "lower", basis: "observed", points: series(h => { const i = h.analysis.site.indexability; return i.indexable + i.nonIndexable ? 100 * i.nonIndexable / (i.indexable + i.nonIndexable) : null; }) },
    { id: "words", label: "Median words per page", unit: "", better: "neither", basis: "observed", points: series(h => median(h.inv.pages.filter(p => p.status === 200).map(p => p.content.words)) || null) },
    { id: "critical", label: "Critical and high findings", unit: "", better: "lower", basis: "observed", points: series(h => h.analysis.findings.filter(f => f.severity === "critical" || f.severity === "high").length) },
    { id: "mobile", label: "Mobile performance score (PageSpeed)", unit: "", better: "higher", basis: "measured", points: series(h => mobileScore(h.inv.performance)) },
    { id: "ai", label: "Brand mentioned in sampled AI answers", unit: "%", better: "higher", basis: "observed", points: series(h => { const n = h.inv.observations.length; return n ? 100 * h.inv.observations.filter(o => o.brandMentioned).length / n : null; }) },
    { id: "gsc-clicks", label: "Search Console clicks", unit: "", better: "higher", basis: "measured", points: series(h => h.inv.firstParty.gsc ? h.inv.firstParty.gsc.rows.reduce((s, r) => s + r.clicks, 0) : null) },
    { id: "gsc-impressions", label: "Search Console impressions", unit: "", better: "higher", basis: "measured", points: series(h => h.inv.firstParty.gsc ? h.inv.firstParty.gsc.rows.reduce((s, r) => s + r.impressions, 0) : null) },
  ];
  return defs.filter(d => d.points.length).map(assess);
}

export type PageChange = { url: string; kind: "removed" | "added" | "status" | "title" | "noindex" | "decay" | "content"; before: string; after: string };
/** Page-level changes between two investigations of the same site (pages observed in both). */
export function pageChanges(previous: Investigation, latest: Investigation): PageChange[] {
  const before = new Map(previous.pages.map(p => [pageKey(p.finalUrl), p])), after = new Map(latest.pages.map(p => [pageKey(p.finalUrl), p]));
  const changes: PageChange[] = [];
  for (const [k, a] of after) {
    const b = before.get(k);
    if (!b) continue;
    if (b.status !== a.status) changes.push({ url: a.finalUrl, kind: "status", before: String(b.status), after: String(a.status) });
    else if (b.indexable && !a.indexable) changes.push({ url: a.finalUrl, kind: "noindex", before: "Indexable", after: a.indexReasons[0] || "Not indexable" });
    if ((b.title || "") !== (a.title || "")) changes.push({ url: a.finalUrl, kind: "title", before: b.title || "(none)", after: a.title || "(none)" });
    if (b.content.words >= 150 && a.content.words < b.content.words * 0.7) changes.push({ url: a.finalUrl, kind: "decay", before: b.content.words + " words", after: a.content.words + " words" });
    else if (b.content.textHash !== a.content.textHash) changes.push({ url: a.finalUrl, kind: "content", before: b.content.words + " words", after: a.content.words + " words" });
  }
  // Pages that disappeared are only reported when the latest crawl covered the site comparably.
  if (latest.pages.length >= previous.pages.length * 0.8) for (const [k, b] of before) if (!after.has(k) && latest.job.status !== "running") changes.push({ url: b.finalUrl, kind: "removed", before: "Observed " + b.fetchedAt.slice(0, 10), after: "Not found in this crawl" });
  for (const [k, a] of after) if (!before.has(k)) changes.push({ url: a.finalUrl, kind: "added", before: "—", after: "First observed " + a.fetchedAt.slice(0, 10) });
  const order: PageChange["kind"][] = ["status", "noindex", "decay", "removed", "title", "content", "added"];
  return changes.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind) || x.url.localeCompare(y.url));
}

/** Competitor website changes between two investigations (pages sampled in both). */
export function competitorChanges(previous: Investigation, latest: Investigation): { website: string; name: string; changed: PageChange[] }[] {
  return latest.competitors.map(c => {
    const prior = previous.competitors.find(p => pageKey(p.website) === pageKey(c.website));
    if (!prior) return null;
    const changed = pageChanges({ ...previous, pages: prior.pages } as Investigation, { ...latest, pages: c.pages } as Investigation).filter(x => x.kind !== "added" && x.kind !== "removed");
    return { website: c.website, name: c.name, changed };
  }).filter((x): x is { website: string; name: string; changed: PageChange[] } => Boolean(x && x.changed.length));
}
