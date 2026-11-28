/**
 * VisTa Index observations: derived, dated fingerprints of pages (never full copies) and change
 * detection between two observations of the same URL (VisTa crawls or Common Crawl captures).
 * Methodology: docs/proprietary-intelligence.md#2-vista-index-observations
 */
import type { PageRecord } from "./page";

export type ObservationSource = "vista" | "common-crawl";
export type Observation = {
  url: string; key: string; observedAt: string; source: ObservationSource; crawl?: string;
  status: number; title: string; description: string; h1: string[]; headings: string[];
  words: number; textHash: string; signature: number[]; internalLinks: number; externalLinks: number;
  schemaTypes: string[]; canonical: string; indexable: boolean;
};
export type Change = { field: string; label: string; before: string; after: string; major: boolean };
export type Comparison = { url: string; before: { at: string; source: ObservationSource; crawl?: string }; after: { at: string; source: ObservationSource }; similarity: number | null; unchanged: boolean; changes: Change[] };

/** Same page across http/https, www and trailing slashes. */
export function pageKey(url: string): string {
  try { const u = new URL(url); return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + u.search).toLowerCase(); } catch { return url.toLowerCase(); }
}

export function observe(page: PageRecord, source: ObservationSource, crawl?: string): Observation {
  return {
    url: page.finalUrl, key: pageKey(page.finalUrl), observedAt: page.fetchedAt, source, ...(crawl ? { crawl } : {}),
    status: page.status, title: page.title || "", description: page.description || "", h1: page.h1.slice(0, 3),
    headings: page.headings.filter(h => h.level <= 3).map(h => h.text).slice(0, 30), words: page.content.words,
    textHash: page.content.textHash, signature: page.content.signature.slice(0, 64),
    internalLinks: page.links.internalCount, externalLinks: page.links.externalCount,
    schemaTypes: [...new Set(page.schema.types)].sort().slice(0, 20), canonical: page.canonical || "", indexable: page.indexable,
  };
}

/** MinHash estimate of the Jaccard similarity of the two pages' word shingles (0–1). */
export function similarity(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (!n) return null;
  let same = 0;
  for (let i = 0; i < n; i += 1) if (a[i] === b[i]) same += 1;
  return same / n;
}

export function compareObservations(before: Observation, after: Observation): Comparison {
  const changes: Change[] = [];
  const text = (field: string, label: string, a: string, b: string, major = false) => { if (a.trim() !== b.trim()) changes.push({ field, label, before: a || "(none)", after: b || "(none)", major }); };
  if (before.status !== after.status) changes.push({ field: "status", label: "HTTP status", before: String(before.status), after: String(after.status), major: true });
  text("title", "Title", before.title, after.title, true);
  text("description", "Meta description", before.description, after.description);
  text("h1", "H1", before.h1.join(" | "), after.h1.join(" | "), true);
  if (before.indexable !== after.indexable) changes.push({ field: "indexable", label: "Indexability", before: before.indexable ? "Indexable" : "Not indexable", after: after.indexable ? "Indexable" : "Not indexable", major: true });
  text("canonical", "Canonical", before.canonical, after.canonical, true);
  const added = after.headings.filter(h => !before.headings.includes(h)), removed = before.headings.filter(h => !after.headings.includes(h));
  if (added.length || removed.length) changes.push({ field: "headings", label: "Section headings", before: removed.length + " removed" + (removed.length ? ": " + removed.slice(0, 3).join("; ") : ""), after: added.length + " added" + (added.length ? ": " + added.slice(0, 3).join("; ") : ""), major: added.length + removed.length >= 3 });
  if (before.words && Math.abs(after.words - before.words) / before.words >= 0.15) changes.push({ field: "words", label: "Word count", before: String(before.words), after: String(after.words), major: Math.abs(after.words - before.words) / before.words >= 0.4 });
  if (Math.abs(after.internalLinks - before.internalLinks) >= Math.max(5, before.internalLinks * 0.25)) changes.push({ field: "internalLinks", label: "Internal links", before: String(before.internalLinks), after: String(after.internalLinks), major: false });
  const schemaAdded = after.schemaTypes.filter(t => !before.schemaTypes.includes(t)), schemaRemoved = before.schemaTypes.filter(t => !after.schemaTypes.includes(t));
  if (schemaAdded.length || schemaRemoved.length) changes.push({ field: "schema", label: "Structured data types", before: schemaRemoved.join(", ") || "—", after: schemaAdded.join(", ") || "—", major: false });
  const sim = before.textHash === after.textHash ? 1 : similarity(before.signature, after.signature);
  return { url: after.url, before: { at: before.observedAt, source: before.source, ...(before.crawl ? { crawl: before.crawl } : {}) }, after: { at: after.observedAt, source: after.source }, similarity: sim === null ? null : Math.round(sim * 100) / 100, unchanged: before.textHash === after.textHash && !changes.length, changes };
}
