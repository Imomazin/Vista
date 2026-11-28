/**
 * Chart specifications for VisTa intelligence. Each builder answers one business question,
 * returns an ECharts option plus an accessible table, and returns null when the underlying
 * evidence does not exist (no chart is drawn from absent data).
 */
import type { Finding, Investigation } from "./model";
import type { SiteAnalysis, TreeNode } from "./site";
import { geoReadiness } from "./site";
import type { IndexResult } from "./scoring";
import { signalProfile } from "./scoring";
import type { Intervention } from "./strategy";
import { geoMetrics, opportunityMap } from "./geo";

export type Palette = { text: string; sub: string; line: string; emerald: string; violet: string; amber: string; red: string; blue: string; surface: string; series: string[]; dark: boolean };
/** rgba() rather than 8-digit hex: SVG/PDF renderers then receive explicit opacity attributes. */
export const alpha = (hex: string, a: number) => { const h = hex.replace("#", "").slice(0, 6); return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; };
export const palettes: Record<"dark" | "light", Palette> = {
  dark: { text: "#F2F5F4", sub: "#A1B3B0", line: "rgba(197,216,219,0.15)", emerald: "#68E1B4", violet: "#A88BFF", amber: "#F3C879", red: "#FF979A", blue: "#9BCAE8", surface: "#172027", series: ["#68E1B4", "#A88BFF", "#9BCAE8", "#F3C879", "#FF979A", "#5FB3A1", "#C9B8FF", "#7FA7C9"], dark: true },
  light: { text: "#19332D", sub: "#526F64", line: "rgba(65,104,86,0.15)", emerald: "#136C50", violet: "#5E3FB0", amber: "#87571C", red: "#B23A45", blue: "#276A8D", surface: "#FFFFFF", series: ["#136C50", "#5E3FB0", "#276A8D", "#87571C", "#B23A45", "#3E8C77", "#8A6FD0", "#4F7FA8"], dark: false },
};

export type ChartSpec = {
  id: string;
  title: string;
  question: string;
  kind: string;
  option: (p: Palette) => Record<string, unknown>;
  table: { columns: string[]; rows: (string | number)[][] };
  /** Native PowerPoint chart equivalent where supported. */
  native?: { type: "bar" | "radar" | "line" | "doughnut" | "scatter"; labels: string[]; series: { name: string; values: number[] }[] };
  drill?: (name: string) => string | null;
};

const base = (p: Palette) => ({
  backgroundColor: "transparent",
  textStyle: { color: p.text, fontFamily: "inherit" },
  aria: { enabled: true, decal: { show: false } },
  tooltip: { backgroundColor: p.dark ? "rgba(14,22,27,0.95)" : "rgba(255,255,255,0.97)", borderColor: p.line, textStyle: { color: p.text }, confine: true },
  animationDuration: 900,
  animationEasing: "cubicOut",
});
const axis = (p: Palette) => ({ axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.sub }, splitLine: { lineStyle: { color: p.line } }, nameTextStyle: { color: p.sub } });
const pct = (v: number) => Math.round(v * 100) + "%";

export function capabilityRadar(index: IndexResult): ChartSpec | null {
  const scored = index.dimensions.filter(d => d.score !== null);
  if (scored.length < 3) return null;
  return {
    id: "capability-radar", kind: "Radar", title: "Marketing capability profile", question: "Where is the organisation strong or weak across the evidence-backed dimensions?",
    option: p => ({ ...base(p), legend: { show: false }, radar: { indicator: scored.map(d => ({ name: d.label.replace(" and ", " & "), max: 100 })), splitArea: { areaStyle: { color: ["transparent"] } }, axisName: { color: p.sub, fontSize: 11 }, splitLine: { lineStyle: { color: p.line } }, axisLine: { lineStyle: { color: p.line } } }, series: [{ type: "radar", data: [{ name: "Score", value: scored.map(d => d.score), areaStyle: { color: alpha(p.emerald, 0.25) }, lineStyle: { color: p.emerald, width: 2 }, itemStyle: { color: p.violet } }] }] }),
    table: { columns: ["Dimension", "Score", "Coverage", "Evidence"], rows: index.dimensions.map(d => [d.label, d.score ?? "Not scored", pct(d.coverage), d.evidenceClass]) },
    native: { type: "radar", labels: scored.map(d => d.label), series: [{ name: "Score", values: scored.map(d => d.score as number) }] },
  };
}

export function crawlFunnel(inv: Investigation, site: SiteAnalysis): ChartSpec | null {
  if (!inv.pages.length) return null;
  const discovered = new Set([...inv.pages.map(p => p.url), ...inv.failures.map(f => f.url), ...inv.job.frontier.map(f => f.url), ...(inv.discovery?.sitemapUrls.map(s => s.loc) || [])]).size;
  const stages = [["URLs discovered", discovered], ["Fetched", inv.pages.length + inv.failures.filter(f => f.kind !== "robots").length], ["Returned 200 HTML", inv.pages.length], ["Technically indexable", site.indexability.indexable], ["Indexable and in sitemap", inv.pages.filter(p => p.indexable && (inv.discovery?.sitemapUrls || []).some(s => s.loc.replace(/\/$/, "") === p.finalUrl.replace(/\/$/, ""))).length]] as [string, number][];
  return {
    id: "crawl-funnel", kind: "Funnel", title: "From discovered URLs to indexable pages", question: "How much of the discovered inventory is eligible to appear in search?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, trigger: "item", formatter: "{b}: {c}" }, series: [{ type: "funnel", sort: "none", left: "6%", width: "88%", gap: 4, label: { position: "inside", color: p.dark ? "#071712" : "#FFFFFF", fontWeight: 600, formatter: "{b}: {c}" }, itemStyle: { borderWidth: 0 }, data: stages.map(([name, value], i) => ({ name, value, itemStyle: { color: [p.blue, p.violet, p.emerald, alpha(p.emerald, 0.8), alpha(p.emerald, 0.6)][i] } })) }] }),
    table: { columns: ["Stage", "URLs"], rows: stages },
    native: { type: "bar", labels: stages.map(s => s[0]), series: [{ name: "URLs", values: stages.map(s => s[1]) }] },
  };
}

export function responseSankey(inv: Investigation): ChartSpec | null {
  if (!inv.pages.length) return null;
  const links = new Map<string, number>();
  const add = (a: string, b: string) => links.set(a + "→" + b, (links.get(a + "→" + b) || 0) + 1);
  for (const p of inv.pages) { const src = p.depth < 0 ? "Sitemap only" : p.depth === 0 ? "Home page" : "Internal links"; const resp = p.chain.length > 1 ? "Redirected to 200" : "200 OK"; add(src, resp); add(resp, p.indexable ? "Indexable" : "Not indexable"); }
  for (const f of inv.failures) { const src = f.depth < 0 ? "Sitemap only" : "Internal links"; const resp = f.kind === "robots" ? "Blocked by robots.txt" : f.status && f.status >= 500 ? "5xx server error" : f.status && f.status >= 400 ? "4xx client error" : "Fetch error"; add(src, resp); }
  const nodes = [...new Set([...links.keys()].flatMap(k => k.split("→")))];
  return {
    id: "response-sankey", kind: "Sankey", title: "How crawled URLs resolve", question: "Where do discovered URLs come from, how do they respond and how many end up indexable?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, trigger: "item" }, series: [{ type: "sankey", left: 8, right: 120, nodeGap: 12, emphasis: { focus: "adjacency" }, label: { color: p.text, fontSize: 11 }, lineStyle: { color: "gradient", opacity: 0.35 }, data: nodes.map((name, i) => ({ name, itemStyle: { color: /error|Blocked|Not indexable/.test(name) ? p.red : /Indexable|200/.test(name) ? p.emerald : p.series[i % p.series.length] } })), links: [...links.entries()].map(([k, value]) => { const [source, target] = k.split("→"); return { source, target, value }; }) }] }),
    table: { columns: ["From", "To", "URLs"], rows: [...links.entries()].map(([k, v]) => [...k.split("→"), v]) },
  };
}

function toTree(node: TreeNode, depth = 0): Record<string, unknown> {
  return { name: node.name, value: node.pages, issues: node.issues, path: node.path, children: depth < 3 ? node.children.sort((a, b) => b.pages - a.pages).slice(0, 14).map(c => toTree(c, depth + 1)) : undefined };
}

export function architectureSunburst(site: SiteAnalysis): ChartSpec | null {
  if (site.crawled < 3 || !site.hierarchy.children.length) return null;
  const root = toTree(site.hierarchy);
  return {
    id: "architecture-sunburst", kind: "Sunburst", title: "Website architecture", question: "How is the site organised and where do issues concentrate?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number; issues: number } }) => x.data.name + "<br/>" + x.data.value + " pages · " + x.data.issues + " issue signals" }, series: [{ type: "sunburst", radius: ["12%", "92%"], sort: undefined, nodeClick: "rootToNode", data: (root.children as unknown[]) || [], label: { color: p.dark ? "#071712" : "#fff", fontSize: 10, minAngle: 8 }, itemStyle: { borderColor: p.surface, borderWidth: 1.5 }, levels: [{}, { itemStyle: { color: p.emerald } }, { itemStyle: { color: p.violet } }, { itemStyle: { color: p.blue } }] }] }),
    table: { columns: ["Section", "Pages", "Issue signals"], rows: site.hierarchy.children.map(c => ["/" + c.name, c.pages, c.issues]) },
    drill: name => "/" + name,
  };
}

export function linkNetwork(site: SiteAnalysis): ChartSpec | null {
  if (site.graph.nodes.length < 3 || !site.graph.edges.length) return null;
  const types = [...new Set(site.graph.nodes.map(n => n.type))];
  const label = (id: string) => { try { return new URL(id).pathname || "/"; } catch { return id; } };
  return {
    id: "link-network", kind: "Network graph", title: "Internal link network", question: "Which pages receive internal authority and which are weakly connected?",
    option: p => ({ ...base(p), legend: { data: types, textStyle: { color: p.sub }, bottom: 0 }, tooltip: { ...base(p).tooltip, formatter: (x: { dataType: string; data: { name: string; value: number } }) => x.dataType === "node" ? label(x.data.name) + "<br/>" + x.data.value + " internal inlinks" : "" }, series: [{ type: "graph", layout: "force", roam: true, draggable: true, force: { repulsion: 260, edgeLength: [60, 170], gravity: 0.05 }, categories: types.map((t, i) => ({ name: t, itemStyle: { color: p.series[i % p.series.length] } })), data: site.graph.nodes.map(n => ({ name: n.id, value: n.inlinks, category: types.indexOf(n.type), symbolSize: 6 + Math.sqrt(n.inlinks) * 4, label: { show: n.inlinks >= Math.max(3, site.crawled / 6), formatter: label(n.id).slice(0, 24), color: p.sub, fontSize: 9 } })), edges: site.graph.edges.map(([source, target]) => ({ source, target })), lineStyle: { color: p.line, opacity: 0.5, curveness: 0.1 }, emphasis: { focus: "adjacency", lineStyle: { width: 2 } } }] }),
    table: { columns: ["Page", "Inlinks", "Outlinks", "Depth", "Type"], rows: [...site.graph.nodes].sort((a, b) => b.inlinks - a.inlinks).map(n => [n.id, n.inlinks, n.outlinks, n.depth < 0 ? "sitemap" : n.depth, n.type]) },
    drill: name => name,
  };
}

const issueColumns: [string, (p: Investigation["pages"][number]) => boolean][] = [
  ["Title", p => !p.title || p.title.length < 30 || p.title.length > 65],
  ["Description", p => !p.description],
  ["H1", p => p.h1.length !== 1],
  ["Alt text", p => p.images.missingAlt > 0],
  ["Schema", p => !p.schema.types.length],
  ["Indexability", p => !p.indexable],
  ["Thin content", p => p.content.words < 250],
  ["Accessibility", p => p.accessibility.unlabelledInputs + p.accessibility.unnamedButtons > 0 || !p.accessibility.langDeclared],
];

export function issueHeatmap(inv: Investigation): ChartSpec | null {
  if (inv.pages.length < 3) return null;
  const section = (url: string) => { const s = new URL(url).pathname.split("/").filter(Boolean)[0]; return s ? "/" + s : "/ (root)"; };
  const sections = [...new Set(inv.pages.map(p => section(p.finalUrl)))].slice(0, 14);
  const data: [number, number, number][] = [];
  const rows: (string | number)[][] = [];
  sections.forEach((s, y) => { const pages = inv.pages.filter(p => section(p.finalUrl) === s); const row: (string | number)[] = [s + " (" + pages.length + ")"]; issueColumns.forEach(([, test], x) => { const share = Math.round(pages.filter(test).length / pages.length * 100); data.push([x, y, share]); row.push(share + "%"); }); rows.push(row); });
  return {
    id: "issue-heatmap", kind: "Heatmap", title: "Issue concentration by site section", question: "Which templates or sections carry the most optimisation debt?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { value: [number, number, number] }) => sections[x.value[1]] + " · " + issueColumns[x.value[0]][0] + ": " + x.value[2] + "% of pages" }, grid: { left: 120, right: 70, top: 10, bottom: 60 }, xAxis: { type: "category", data: issueColumns.map(c => c[0]), ...axis(p), axisLabel: { color: p.sub, rotate: 30 }, splitArea: { show: false } }, yAxis: { type: "category", data: sections, ...axis(p) }, visualMap: { min: 0, max: 100, orient: "vertical", right: 0, top: "middle", itemHeight: 120, text: ["100%", "0%"], textStyle: { color: p.sub }, inRange: { color: [p.dark ? "#16302A" : "#E8F3EE", p.amber, p.red] } }, series: [{ type: "heatmap", data, label: { show: true, color: p.text, fontSize: 10, formatter: (x: { value: number[] }) => x.value[2] + "%" }, itemStyle: { borderColor: p.surface, borderWidth: 2 } }] }),
    table: { columns: ["Section", ...issueColumns.map(c => c[0])], rows },
    drill: name => name,
  };
}

export function severityMatrix(findings: Finding[]): ChartSpec | null {
  if (!findings.length) return null;
  const modules = [...new Set(findings.map(f => f.module))];
  const severities = ["critical", "high", "medium", "low"] as const;
  const data = modules.flatMap((m, y) => severities.map((s, x) => [x, y, findings.filter(f => f.module === m && f.severity === s).length]));
  return {
    id: "severity-matrix", kind: "Severity matrix", title: "Issue severity by discipline", question: "Which disciplines hold the most severe problems?",
    option: p => ({ ...base(p), grid: { left: 110, right: 20, top: 10, bottom: 40 }, xAxis: { type: "category", data: severities.map(s => s[0].toUpperCase() + s.slice(1)), ...axis(p) }, yAxis: { type: "category", data: modules, ...axis(p) }, visualMap: { show: false, min: 0, max: Math.max(1, ...data.map(d => d[2])), inRange: { color: [p.dark ? "#1B262C" : "#F1F4F1", p.violet] } }, series: [{ type: "heatmap", data, label: { show: true, color: p.text }, itemStyle: { borderColor: p.surface, borderWidth: 2 } }] }),
    table: { columns: ["Discipline", ...severities], rows: modules.map(m => [m, ...severities.map(s => findings.filter(f => f.module === m && f.severity === s).length)]) },
  };
}

export function depthBars(site: SiteAnalysis): ChartSpec | null {
  const linked = site.depth.filter(d => d.depth >= 0);
  if (!linked.length) return null;
  return {
    id: "depth", kind: "Bar", title: "Click depth from the home page", question: "How many clicks does it take to reach content?",
    option: p => ({ ...base(p), grid: { left: 40, right: 16, top: 16, bottom: 30 }, xAxis: { type: "category", data: linked.map(d => d.depth === 0 ? "Home" : d.depth + " click" + (d.depth > 1 ? "s" : "")), ...axis(p) }, yAxis: { type: "value", ...axis(p) }, series: [{ type: "bar", barWidth: "55%", data: linked.map(d => ({ value: d.count, itemStyle: { color: d.depth > 3 ? p.amber : p.emerald, borderRadius: [6, 6, 0, 0] } })) }] }),
    table: { columns: ["Depth", "Pages"], rows: linked.map(d => [d.depth, d.count]) },
    native: { type: "bar", labels: linked.map(d => "Depth " + d.depth), series: [{ name: "Pages", values: linked.map(d => d.count) }] },
  };
}

export function opportunityBubbles(items: Intervention[], findings: Finding[]): ChartSpec | null {
  if (!items.length) return null;
  const modules = [...new Set(items.map(i => i.module))];
  return {
    id: "opportunity-bubbles", kind: "Bubble", title: "Opportunity prioritisation", question: "Which interventions create the most value for the least effort?",
    option: p => ({ ...base(p), legend: { data: modules, textStyle: { color: p.sub }, top: 0, type: "scroll" }, grid: { left: 50, right: 20, top: 44, bottom: 44 }, tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number[] } }) => x.data.name + "<br/>Effort " + x.data.value[0] + " days · value " + x.data.value[1] + " · " + x.data.value[2] + " affected" }, xAxis: { name: "Estimated effort (days)", nameLocation: "middle", nameGap: 26, type: "value", ...axis(p) }, yAxis: { name: "Impact × urgency", type: "value", max: 25, ...axis(p) }, series: modules.map((m, i) => ({ name: m, type: "scatter", itemStyle: { color: p.series[i % p.series.length], opacity: 0.85 }, symbolSize: (v: number[]) => 10 + Math.sqrt(v[2]) * 5, data: items.filter(x => x.module === m).map(x => ({ name: x.finding, id: x.findingId, value: [(x.effortDays[0] + x.effortDays[1]) / 2, x.impact * x.urgency, findings.find(f => f.id === x.findingId)?.affectedCount || 1] })) })) }),
    table: { columns: ["Intervention", "Effort (days)", "Impact × urgency", "Priority"], rows: items.map(i => [i.finding, i.effortDays.join("–"), i.impact * i.urgency, i.priority]) },
  };
}

export function quadrant(items: Intervention[], kind: "impact-effort" | "urgency-importance" | "risk-opportunity"): ChartSpec | null {
  if (!items.length) return null;
  const config = {
    "impact-effort": { title: "Impact versus effort", question: "Which actions are quick wins, major projects or distractions?", x: (i: Intervention) => ({ low: 1, medium: 3, high: 5 }[i.effort]), y: (i: Intervention) => i.impact, xName: "Effort", yName: "Impact", labels: ["Quick wins", "Major projects", "Fill-ins", "Reconsider"] },
    "urgency-importance": { title: "Urgency versus importance", question: "What must be done now, scheduled, delegated or dropped?", x: (i: Intervention) => i.urgency, y: (i: Intervention) => i.importance, xName: "Urgency", yName: "Importance", labels: ["Schedule", "Do now", "Drop", "Delegate"] },
    "risk-opportunity": { title: "Risk versus opportunity", question: "Which items protect the business and which create upside?", x: (i: Intervention) => i.risk, y: (i: Intervention) => i.opportunity, xName: "Risk if ignored", yName: "Opportunity", labels: ["Grow", "Protect and grow", "Monitor", "Protect"] },
  }[kind];
  const jitter = (s: string) => ((s.length * 7919) % 100) / 250 - 0.2;
  return {
    id: kind, kind: "Quadrant matrix", title: config.title, question: config.question,
    option: p => ({ ...base(p), grid: { left: 50, right: 20, top: 30, bottom: 44 }, tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string } }) => x.data.name }, xAxis: { name: config.xName, nameLocation: "middle", nameGap: 26, min: 0, max: 6, interval: 1, ...axis(p) }, yAxis: { name: config.yName, nameLocation: "middle", nameGap: 30, min: 0, max: 6, interval: 1, ...axis(p) }, series: [{ type: "scatter", symbolSize: 14, itemStyle: { color: p.violet, borderColor: p.emerald, borderWidth: 1.5 }, data: items.map(i => ({ name: i.finding, id: i.findingId, value: [config.x(i) + jitter(i.id), config.y(i) + jitter(i.finding)] })), markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.sub, type: "dashed" }, data: [{ xAxis: 3 }, { yAxis: 3 }] }, markArea: { silent: true, itemStyle: { color: "transparent" }, label: { color: p.sub, fontSize: 11, position: "inside" }, data: [[{ name: config.labels[0], coord: [0, 3] }, { coord: [3, 6] }], [{ name: config.labels[1], coord: [3, 3] }, { coord: [6, 6] }], [{ name: config.labels[2], coord: [0, 0] }, { coord: [3, 3] }], [{ name: config.labels[3], coord: [3, 0] }, { coord: [6, 3] }]] } }] }),
    table: { columns: ["Intervention", config.xName, config.yName], rows: items.map(i => [i.finding, config.x(i), config.y(i)]) },
  };
}

export function competitorRadar(inv: Investigation): ChartSpec | null {
  const others = inv.competitors.filter(c => c.pages.length);
  if (!others.length || !inv.pages.length) return null;
  const keys: [keyof ReturnType<typeof signalProfile>, string, number][] = [["words", "Content depth (median words)", 0], ["schema", "Schema coverage %", 100], ["readiness", "GEO readiness", 100], ["trust", "Trust signals", 100], ["titles", "Optimised titles %", 100], ["alt", "Alt text coverage %", 100]];
  const profiles = [{ name: inv.brief.brand || "Client", profile: signalProfile(inv.pages) }, ...others.map(c => ({ name: c.name, profile: signalProfile(c.pages) }))];
  const maxWords = Math.max(800, ...profiles.map(x => x.profile.words));
  return {
    id: "competitor-radar", kind: "Radar", title: "Competitive signal profile", question: "Where do competitors out-invest the client on observable signals?",
    option: p => ({ ...base(p), legend: { data: profiles.map(x => x.name), textStyle: { color: p.sub }, bottom: 0 }, radar: { indicator: keys.map(([, name, max]) => ({ name, max: max || maxWords })), axisName: { color: p.sub, fontSize: 10 }, splitLine: { lineStyle: { color: p.line } }, splitArea: { areaStyle: { color: ["transparent"] } }, axisLine: { lineStyle: { color: p.line } } }, series: [{ type: "radar", data: profiles.map((x, i) => ({ name: x.name, value: keys.map(([k]) => Math.round(x.profile[k])), lineStyle: { color: p.series[i % p.series.length], width: i === 0 ? 3 : 1.5 }, itemStyle: { color: p.series[i % p.series.length] }, areaStyle: i === 0 ? { color: alpha(p.series[0], 0.2) } : undefined })) }] }),
    table: { columns: ["Website", ...keys.map(k => k[1])], rows: profiles.map(x => [x.name, ...keys.map(([k]) => Math.round(x.profile[k]))]) },
    native: { type: "radar", labels: keys.map(k => k[1]), series: profiles.map(x => ({ name: x.name, values: keys.map(([k]) => Math.round(k === "words" ? x.profile[k] / maxWords * 100 : x.profile[k])) })) },
  };
}

export function contentTreemap(site: SiteAnalysis): ChartSpec | null {
  if (site.clusters.length < 2) return null;
  return {
    id: "content-treemap", kind: "Treemap", title: "Content portfolio by topic", question: "Which topics does the website invest in, and how deeply?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number; pages: number; terms: string } }) => x.data.name + "<br/>" + x.data.pages + " pages · " + x.data.value.toLocaleString() + " words<br/>" + x.data.terms }, series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, label: { color: p.dark ? "#071712" : "#fff", fontSize: 12 }, itemStyle: { borderColor: p.surface, borderWidth: 2, gapWidth: 2 }, data: site.clusters.map((c, i) => ({ name: c.label, value: Math.max(1, c.words), pages: c.urls.length, terms: c.terms.join(", "), itemStyle: { color: p.series[i % p.series.length] } })) }] }),
    table: { columns: ["Topic", "Pages", "Words", "Top terms"], rows: site.clusters.map(c => [c.label, c.urls.length, c.words, c.terms.join(", ")]) },
    native: { type: "bar", labels: site.clusters.slice(0, 10).map(c => c.label), series: [{ name: "Pages", values: site.clusters.slice(0, 10).map(c => c.urls.length) }] },
  };
}

export function readinessScatter(inv: Investigation, site: SiteAnalysis): ChartSpec | null {
  const pages = inv.pages.filter(p => p.indexable);
  if (pages.length < 4) return null;
  const types = [...new Set(pages.map(p => p.pageType))];
  return {
    id: "readiness-scatter", kind: "Scatter", title: "Content depth, internal links and GEO readiness", question: "Do the best-linked pages also have the depth and structure AI answers need?",
    option: p => ({ ...base(p), legend: { data: types, textStyle: { color: p.sub }, top: 0, type: "scroll" }, grid: { left: 54, right: 20, top: 44, bottom: 44 }, tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number[] } }) => x.data.name + "<br/>" + x.data.value[0] + " words · " + x.data.value[1] + " inlinks · readiness " + x.data.value[2] }, xAxis: { name: "Words", type: "log", nameLocation: "middle", nameGap: 26, ...axis(p) }, yAxis: { name: "Internal inlinks", type: "value", ...axis(p) }, series: types.map((t, i) => ({ name: t, type: "scatter", itemStyle: { color: p.series[i % p.series.length], opacity: 0.8 }, symbolSize: (v: number[]) => 6 + v[2] / 8, data: pages.filter(x => x.pageType === t).map(x => ({ name: new URL(x.finalUrl).pathname, id: x.finalUrl, value: [Math.max(1, x.content.words), site.inlinks[x.finalUrl.replace(/\/$/, "")] || 0, geoReadiness(x).score] })) })) }),
    table: { columns: ["Page", "Words", "Inlinks", "GEO readiness"], rows: pages.map(x => [x.finalUrl, x.content.words, site.inlinks[x.finalUrl.replace(/\/$/, "")] || 0, geoReadiness(x).score]) },
    drill: name => name,
  };
}

/** Page health treemap: sections sized by pages, each page coloured by its health score. */
export function pageHealthTreemap(inv: Investigation): ChartSpec | null {
  if (inv.pages.length < 4) return null;
  const health = (p: Investigation["pages"][number]) => Math.max(0, 100 - 10 * (p.headingIssues.length + (p.indexable ? 0 : 3) + (p.title ? 0 : 2) + (p.description ? 0 : 1) + (p.images.missingAlt ? 1 : 0) + (p.schema.types.length ? 0 : 1) + (p.content.words < 250 ? 1 : 0) + (p.jsDependent ? 2 : 0) + ((p.retrieval?.decodedBytes ?? 0) > 1048576 ? 2 : 0)));
  const sections = new Map<string, Investigation["pages"]>();
  for (const p of inv.pages) { const s = "/" + (new URL(p.finalUrl).pathname.split("/").filter(Boolean)[0] || ""); sections.set(s, [...(sections.get(s) || []), p]); }
  const data = [...sections.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([name, pages]) => ({ name, value: pages.length, children: pages.slice(0, 200).map(p => ({ name: new URL(p.finalUrl).pathname || "/", id: p.finalUrl, value: 1, health: health(p) })) }));
  return {
    id: "page-health", kind: "Treemap", title: "Page health across the website", question: "Which sections and pages carry the weakest technical health?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; health?: number; value: number } }) => x.data.name + (x.data.health !== undefined ? "<br/>Health " + x.data.health + "/100" : "<br/>" + x.data.value + " pages") }, visualMap: { show: true, orient: "horizontal", left: "center", bottom: 0, min: 0, max: 100, dimension: 1, text: ["Healthy", "Weak"], textStyle: { color: p.sub }, inRange: { color: [p.red, p.amber, p.emerald] }, seriesIndex: 0 }, series: [{ type: "treemap", top: 10, bottom: 50, roam: false, breadcrumb: { show: false }, leafDepth: 2, visualDimension: 1, label: { show: true, fontSize: 10, color: p.dark ? "#071712" : "#fff" }, upperLabel: { show: true, height: 20, color: p.text }, itemStyle: { borderColor: p.surface, borderWidth: 1, gapWidth: 1 }, levels: [{ itemStyle: { borderWidth: 3, borderColor: p.surface, gapWidth: 3 } }, { colorSaturation: [0.35, 0.6] }], data: data.map(d => ({ ...d, children: d.children.map(c => ({ ...c, value: [1, c.health] })) })) }] }),
    table: { columns: ["Page", "Section", "Health"], rows: [...sections.entries()].flatMap(([s, pages]) => pages.map(p => [p.finalUrl, s, health(p)] as (string | number)[])).sort((a, b) => (a[2] as number) - (b[2] as number)) },
    drill: name => name.startsWith("http") ? name : null,
  };
}

export function kpiBullets(inv: Investigation, site: SiteAnalysis, targets: Record<string, number> = {}): ChartSpec | null {
  const pages = inv.pages;
  if (!pages.length) return null;
  const imgs = pages.reduce((s, p) => s + p.images.count, 0);
  const geo = geoMetrics(inv.observations, inv.brief);
  const rows: [string, number, number][] = [
    ["Indexable pages", Math.round(site.indexability.indexable / pages.length * 100), targets.indexable ?? 95],
    ["Unique titles in range", Math.round(pages.filter(p => p.title && p.title.length >= 30 && p.title.length <= 65).length / pages.length * 100), targets.titles ?? 90],
    ["Meta description coverage", Math.round(pages.filter(p => p.description).length / pages.length * 100), targets.descriptions ?? 100],
    ["Image alt coverage", imgs ? Math.round((1 - pages.reduce((s, p) => s + p.images.missingAlt, 0) / imgs) * 100) : 100, targets.alt ?? 95],
    ["Structured data coverage", Math.round(pages.filter(p => p.schema.types.length).length / pages.length * 100), targets.schema ?? 80],
    ["Average GEO readiness", Math.round(pages.reduce((s, p) => s + geoReadiness(p).score, 0) / pages.length), targets.readiness ?? 70],
    ...(geo.n ? [["AI brand mention rate", Math.round(geo.mentionRate.value * 100), targets.mention ?? 40] as [string, number, number]] : []),
  ];
  return {
    id: "kpi-bullets", kind: "Bullet chart", title: "Performance against objectives", question: "How close is the website to its agreed technical and visibility targets?",
    option: p => ({ ...base(p), grid: { left: 170, right: 40, top: 10, bottom: 24 }, tooltip: { ...base(p).tooltip, trigger: "axis", axisPointer: { type: "none" } }, xAxis: { type: "value", max: 100, ...axis(p), axisLabel: { color: p.sub, formatter: "{value}%" } }, yAxis: { type: "category", data: rows.map(r => r[0]), inverse: true, ...axis(p) }, series: [
      { name: "Range", type: "bar", barWidth: 18, silent: true, barGap: "-100%", data: rows.map(() => 100), itemStyle: { color: p.dark ? "rgba(255,255,255,0.05)" : "rgba(25,51,45,0.06)", borderRadius: 4 } },
      { name: "Actual", type: "bar", barWidth: 8, data: rows.map(r => ({ value: r[1], itemStyle: { color: r[1] >= r[2] ? p.emerald : r[1] >= r[2] * 0.7 ? p.amber : p.red, borderRadius: 4 } })), label: { show: true, position: "right", color: p.text, formatter: "{c}%" } },
      { name: "Target", type: "scatter", symbol: "rect", symbolSize: [3, 22], itemStyle: { color: p.text }, data: rows.map(r => r[2]) },
    ] }),
    table: { columns: ["Objective", "Actual %", "Target %"], rows },
    native: { type: "bar", labels: rows.map(r => r[0]), series: [{ name: "Actual %", values: rows.map(r => r[1]) }, { name: "Target %", values: rows.map(r => r[2]) }] },
  };
}

export function performanceComparison(inv: Investigation): ChartSpec | null {
  if (!inv.performance.length) return null;
  const metrics = [["LCP (s)", (r: Investigation["performance"][number]) => r.lab.lcpMs !== null ? r.lab.lcpMs / 1000 : null, (r: Investigation["performance"][number]) => r.field.lcp ? r.field.lcp.percentile / 1000 : null, 2.5], ["CLS", (r: Investigation["performance"][number]) => r.lab.cls, (r: Investigation["performance"][number]) => r.field.cls?.percentile ?? null, 0.1], ["INP / TBT (s)", (r: Investigation["performance"][number]) => r.lab.tbtMs !== null ? r.lab.tbtMs / 1000 : null, (r: Investigation["performance"][number]) => r.field.inp ? r.field.inp.percentile / 1000 : null, 0.2]] as const;
  const runs = inv.performance.slice(0, 6);
  const labels = runs.map(r => new URL(r.url).pathname + " · " + r.strategy);
  return {
    id: "performance", kind: "Grouped bar", title: "Lab versus real-user performance", question: "Do real users experience the same speed the lab test predicts?",
    option: p => ({ ...base(p), legend: { textStyle: { color: p.sub }, bottom: 0 }, grid: { left: 50, right: 20, top: 30, bottom: 70 }, tooltip: { ...base(p).tooltip, trigger: "axis" }, xAxis: { type: "category", data: labels, ...axis(p), axisLabel: { color: p.sub, fontSize: 10, interval: 0, rotate: 15 } }, yAxis: { type: "value", name: "LCP seconds", ...axis(p) }, series: [{ name: "Lab LCP (Lighthouse)", type: "bar", data: runs.map(r => r.lab.lcpMs !== null ? +(r.lab.lcpMs / 1000).toFixed(2) : null), itemStyle: { color: p.violet } }, { name: "Field LCP p75 (CrUX)", type: "bar", data: runs.map(r => r.field.lcp ? +(r.field.lcp.percentile / 1000).toFixed(2) : null), itemStyle: { color: p.emerald } }, { name: "Good threshold", type: "line", symbol: "none", lineStyle: { type: "dashed", color: p.amber }, data: runs.map(() => 2.5) }] }),
    table: { columns: ["Test", ...metrics.flatMap(m => ["Lab " + m[0], "Field " + m[0]]), "Lab score", "Field scope"], rows: runs.map((r, i) => [labels[i], ...metrics.flatMap(m => [fmt(m[1](r)), fmt(m[2](r))]), r.lab.score ?? "n/a", r.field.scope]) },
  };
}
const fmt = (v: number | null) => (v === null ? "n/a" : Math.round(v * 100) / 100);

export function geoCategoryChart(inv: Investigation): ChartSpec | null {
  const m = geoMetrics(inv.observations, inv.brief);
  if (!m.n) return null;
  const cats = m.byCategory.filter(c => c.n);
  return {
    id: "geo-categories", kind: "Bar with intervals", title: "AI brand mention rate by prompt category", question: "In which kinds of AI questions does the brand appear, and how certain is that?",
    option: p => ({ ...base(p), grid: { left: 160, right: 50, top: 10, bottom: 30 }, tooltip: { ...base(p).tooltip, formatter: (x: { dataIndex: number }) => { const c = cats[x.dataIndex]; return c.label + "<br/>" + c.mention.numerator + " of " + c.n + " (" + pct(c.mention.value) + ")<br/>95% interval " + pct(c.mention.low) + "–" + pct(c.mention.high); } }, xAxis: { type: "value", max: 100, ...axis(p), axisLabel: { color: p.sub, formatter: "{value}%" } }, yAxis: { type: "category", data: cats.map(c => c.label + " (n=" + c.n + ")"), inverse: true, ...axis(p) }, series: [{ type: "bar", barWidth: 12, data: cats.map(c => Math.round(c.mention.value * 100)), itemStyle: { color: p.emerald, borderRadius: 6 } }, { type: "custom", renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; style: (s: Record<string, unknown>) => Record<string, unknown> }) => { const y = api.value(0); const lo = api.coord([api.value(1), y]); const hi = api.coord([api.value(2), y]); return { type: "line", shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: p.violet, lineWidth: 2 } }; }, encode: { x: [1, 2], y: 0 }, data: cats.map((c, i) => [i, Math.round(c.mention.low * 100), Math.round(c.mention.high * 100)]), z: 5 }] }),
    table: { columns: ["Category", "Samples", "Mentions", "Rate", "95% interval"], rows: cats.map(c => [c.label, c.n, c.mention.numerator, pct(c.mention.value), pct(c.mention.low) + "–" + pct(c.mention.high)]) },
    native: { type: "bar", labels: cats.map(c => c.label), series: [{ name: "Mention rate %", values: cats.map(c => Math.round(c.mention.value * 100)) }] },
  };
}

export function geoShareChart(inv: Investigation): ChartSpec | null {
  const m = geoMetrics(inv.observations, inv.brief);
  if (!m.n || !m.competitorShare.length) return null;
  const rows: [string, number][] = [[inv.brief.brand || "Client", m.mentionRate.numerator], ...m.competitorShare.map(c => [c.name, c.mentions] as [string, number])];
  return {
    id: "geo-share", kind: "Bar", title: "Share of AI mentions", question: "How often is the brand mentioned compared with competitors in the same answers?",
    option: p => ({ ...base(p), grid: { left: 120, right: 30, top: 10, bottom: 24 }, xAxis: { type: "value", minInterval: 1, ...axis(p) }, yAxis: { type: "category", data: rows.map(r => r[0]), inverse: true, ...axis(p) }, series: [{ type: "bar", barWidth: 14, data: rows.map((r, i) => ({ value: r[1], itemStyle: { color: i === 0 ? p.emerald : p.violet, borderRadius: 6 } })), label: { show: true, position: "right", color: p.text } }] }),
    table: { columns: ["Brand", "Answers mentioning"], rows },
    native: { type: "bar", labels: rows.map(r => r[0]), series: [{ name: "Answers mentioning", values: rows.map(r => r[1]) }] },
  };
}

export function geoOpportunityHeatmap(inv: Investigation): ChartSpec | null {
  const map = opportunityMap(inv.observations);
  if (!map.length) return null;
  const cats = [...new Set(map.map(o => o.category))];
  const comps = [...new Set(map.flatMap(o => o.competitors))];
  if (cats.length * comps.length < 2) return null;
  const data = cats.flatMap((c, y) => comps.map((k, x) => [x, y, map.filter(o => o.category === c && o.competitors.includes(k)).length]));
  return {
    id: "geo-opportunity", kind: "Heatmap", title: "GEO opportunity map", question: "Where do competitors appear in AI answers while the client does not?",
    option: p => ({ ...base(p), grid: { left: 130, right: 20, top: 10, bottom: 50 }, xAxis: { type: "category", data: comps, ...axis(p) }, yAxis: { type: "category", data: cats, ...axis(p) }, visualMap: { show: false, min: 0, max: Math.max(1, ...data.map(d => d[2])), inRange: { color: [p.dark ? "#1B262C" : "#F1F4F1", p.red] } }, series: [{ type: "heatmap", data, label: { show: true, color: p.text }, itemStyle: { borderColor: p.surface, borderWidth: 2 } }] }),
    table: { columns: ["Category", ...comps], rows: cats.map(c => [c, ...comps.map(k => map.filter(o => o.category === c && o.competitors.includes(k)).length)]) },
  };
}

export function geoTrend(inv: Investigation): ChartSpec | null {
  const m = geoMetrics(inv.observations, inv.brief);
  if (m.trend.length < 2) return null;
  return {
    id: "geo-trend", kind: "Time series with interval band", title: "AI mention rate over time", question: "Is AI visibility improving, and is the change larger than sampling noise?",
    option: p => ({ ...base(p), grid: { left: 46, right: 20, top: 20, bottom: 30 }, tooltip: { ...base(p).tooltip, trigger: "axis" }, xAxis: { type: "category", data: m.trend.map(t => t.week), ...axis(p) }, yAxis: { type: "value", max: 100, ...axis(p), axisLabel: { color: p.sub, formatter: "{value}%" } }, series: [{ name: "Lower", type: "line", stack: "band", symbol: "none", lineStyle: { opacity: 0 }, data: m.trend.map(t => Math.round(t.mention.low * 100)) }, { name: "95% interval", type: "line", stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: alpha(p.violet, 0.2) }, data: m.trend.map(t => Math.round((t.mention.high - t.mention.low) * 100)) }, { name: "Mention rate", type: "line", smooth: true, symbolSize: 7, lineStyle: { color: p.emerald, width: 3 }, itemStyle: { color: p.emerald }, data: m.trend.map(t => Math.round(t.mention.value * 100)) }] }),
    table: { columns: ["Week", "Samples", "Mention rate", "95% interval"], rows: m.trend.map(t => [t.week, t.n, pct(t.mention.value), pct(t.mention.low) + "–" + pct(t.mention.high)]) },
    native: { type: "line", labels: m.trend.map(t => t.week), series: [{ name: "Mention rate %", values: m.trend.map(t => Math.round(t.mention.value * 100)) }] },
  };
}

export function gscOpportunity(inv: Investigation): ChartSpec | null {
  const rows = inv.firstParty.gsc?.rows || [];
  if (rows.length < 3) return null;
  return {
    id: "gsc-scatter", kind: "Bubble", title: "Ranking position versus click-through rate", question: "Which queries are visible but under-clicked?",
    option: p => ({ ...base(p), grid: { left: 54, right: 20, top: 20, bottom: 40 }, tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number[] } }) => x.data.name + "<br/>Position " + x.data.value[0].toFixed(1) + " · CTR " + x.data.value[1].toFixed(1) + "% · " + x.data.value[2] + " impressions" }, xAxis: { name: "Average position", inverse: true, nameLocation: "middle", nameGap: 26, ...axis(p) }, yAxis: { name: "CTR %", ...axis(p) }, series: [{ type: "scatter", itemStyle: { color: p.emerald, opacity: 0.75 }, symbolSize: (v: number[]) => 6 + Math.sqrt(v[2]) / 3, data: rows.map(r => ({ name: r.query, value: [r.position, r.ctr * 100, r.impressions] })) }] }),
    table: { columns: ["Query", "Clicks", "Impressions", "CTR", "Position"], rows: rows.map(r => [r.query, r.clicks, r.impressions, (r.ctr * 100).toFixed(1) + "%", r.position.toFixed(1)]) },
  };
}

export function ga4Channels(inv: Investigation): ChartSpec | null {
  const rows = inv.firstParty.ga4?.rows || [];
  if (!rows.length) return null;
  return {
    id: "ga4-channels", kind: "Stacked bar", title: "Sessions and key events by channel", question: "Which channels bring visitors who complete key events?",
    option: p => ({ ...base(p), legend: { textStyle: { color: p.sub }, bottom: 0 }, grid: { left: 120, right: 30, top: 10, bottom: 40 }, tooltip: { ...base(p).tooltip, trigger: "axis" }, xAxis: { type: "value", ...axis(p) }, yAxis: { type: "category", data: rows.map(r => r.channel), inverse: true, ...axis(p) }, series: [{ name: "Sessions", type: "bar", data: rows.map(r => r.sessions), itemStyle: { color: p.violet } }, { name: "Key events", type: "bar", data: rows.map(r => r.keyEvents), itemStyle: { color: p.emerald } }] }),
    table: { columns: ["Channel", "Sessions", "Users", "Key events", "Key events per session"], rows: rows.map(r => [r.channel, r.sessions, r.users, r.keyEvents, r.sessions ? (r.keyEvents / r.sessions).toFixed(3) : "n/a"]) },
    native: { type: "bar", labels: rows.map(r => r.channel), series: [{ name: "Sessions", values: rows.map(r => r.sessions) }, { name: "Key events", values: rows.map(r => r.keyEvents) }] },
  };
}

/** Waterfall of dimension score changes between two investigations of the same project. */
export function changeWaterfall(previous: IndexResult, current: IndexResult): ChartSpec | null {
  const pairs = current.dimensions.map(d => ({ label: d.label, before: previous.dimensions.find(x => x.id === d.id)?.score ?? null, after: d.score })).filter(x => x.before !== null && x.after !== null) as { label: string; before: number; after: number }[];
  if (!pairs.length) return null;
  const start = Math.round(pairs.reduce((s, x) => s + x.before, 0) / pairs.length);
  const deltas = pairs.map(x => Math.round((x.after - x.before) / pairs.length * 10) / 10);
  let running = start;
  const bases: number[] = [], ups: number[] = [], downs: number[] = [];
  for (const d of deltas) { bases.push(d >= 0 ? running : running + d); ups.push(d > 0 ? d : 0); downs.push(d < 0 ? -d : 0); running += d; }
  const labels = ["Previous average", ...pairs.map(x => x.label), "Current average"];
  return {
    id: "change-waterfall", kind: "Waterfall", title: "What changed since the previous investigation", question: "Which dimensions drove the overall change?",
    option: p => ({ ...base(p), grid: { left: 40, right: 20, top: 20, bottom: 80 }, tooltip: { ...base(p).tooltip, trigger: "axis" }, xAxis: { type: "category", data: labels, ...axis(p), axisLabel: { color: p.sub, rotate: 30, fontSize: 10 } }, yAxis: { type: "value", ...axis(p) }, series: [{ type: "bar", stack: "w", itemStyle: { color: "transparent" }, data: [0, ...bases, 0] }, { name: "Increase", type: "bar", stack: "w", itemStyle: { color: p.emerald }, data: [start, ...ups, Math.round(running)] }, { name: "Decrease", type: "bar", stack: "w", itemStyle: { color: p.red }, data: [0, ...downs, 0] }] }),
    table: { columns: ["Dimension", "Before", "After", "Change"], rows: pairs.map(x => [x.label, x.before, x.after, x.after - x.before]) },
  };
}

/** Calendar heatmap of sampling activity; only when observations span at least two weeks. */
export function observationCalendar(inv: Investigation): ChartSpec | null {
  const days = new Map<string, { n: number; m: number }>();
  for (const o of inv.observations) { const d = o.collectedAt.slice(0, 10); const v = days.get(d) || { n: 0, m: 0 }; v.n += 1; v.m += o.brandMentioned ? 1 : 0; days.set(d, v); }
  const keys = [...days.keys()].sort();
  if (keys.length < 2 || Date.parse(keys.at(-1)!) - Date.parse(keys[0]) < 13 * 86400000) return null;
  return {
    id: "observation-calendar", kind: "Calendar heatmap", title: "AI mention pattern by day", question: "On which days was the brand mentioned in sampled AI answers?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { value: [string, number] }) => x.value[0] + ": " + x.value[1] + "% mention rate" }, visualMap: { show: false, min: 0, max: 100, inRange: { color: [p.dark ? "#1B262C" : "#F1F4F1", p.emerald] } }, calendar: { range: [keys[0], keys.at(-1)], cellSize: ["auto", 16], itemStyle: { borderColor: p.surface, color: "transparent" }, dayLabel: { color: p.sub }, monthLabel: { color: p.sub }, yearLabel: { show: false }, splitLine: { show: false } }, series: [{ type: "heatmap", coordinateSystem: "calendar", data: keys.map(k => [k, Math.round(days.get(k)!.m / days.get(k)!.n * 100)]) }] }),
    table: { columns: ["Date", "Samples", "Mentions"], rows: keys.map(k => [k, days.get(k)!.n, days.get(k)!.m]) },
  };
}

/** Entity relationships declared or observed on the website: brand, profiles, schema types and cited sources. */
export function entityNetwork(inv: Investigation): ChartSpec | null {
  const org = inv.pages.map(p => p.schema.organisation).find(Boolean);
  const cited = new Map<string, number>();
  for (const p of inv.pages) for (const l of p.links.external) { try { const h = new URL(l.url).hostname.replace(/^www\./, ""); cited.set(h, (cited.get(h) || 0) + 1); } catch { /* skip */ } }
  const top = [...cited.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  if (!org && top.length < 3) return null;
  const brand = org?.name || inv.brief.brand || "Brand";
  const types = [...new Set(inv.pages.flatMap(p => p.schema.types))].slice(0, 10);
  const authors = [...new Set(inv.pages.flatMap(p => p.schema.authors))].slice(0, 8);
  const nodes = [{ name: brand, category: 0, value: 10 }, ...(org?.sameAs || []).map(s => ({ name: s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40), category: 1, value: 4 })), ...types.map(t => ({ name: "schema:" + t, category: 2, value: 3 })), ...authors.map(a => ({ name: a, category: 3, value: 3 })), ...top.map(([h, n]) => ({ name: h, category: 4, value: n }))];
  const unique = [...new Map(nodes.map(n => [n.name, n])).values()];
  const cats = ["Brand", "Declared profiles (sameAs)", "Structured data types", "Authors", "Cited external sources"];
  return {
    id: "entity-network", kind: "Network graph", title: "Entity and citation network", question: "How clearly does the website connect its brand to verifiable profiles, authors and sources?",
    option: p => ({ ...base(p), legend: { data: cats, textStyle: { color: p.sub }, bottom: 0 }, series: [{ type: "graph", layout: "force", roam: true, force: { repulsion: 160, edgeLength: 90 }, categories: cats.map((c, i) => ({ name: c, itemStyle: { color: p.series[i] } })), data: unique.map(n => ({ ...n, symbolSize: 8 + Math.sqrt(n.value) * 5, label: { show: true, color: p.sub, fontSize: 9 } })), edges: unique.slice(1).map(n => ({ source: brand, target: n.name })), lineStyle: { color: p.line, opacity: 0.6 } }] }),
    table: { columns: ["Node", "Type", "Weight"], rows: unique.map(n => [n.name, cats[n.category], n.value]) },
  };
}

/** Multi-client portfolio: latest evidence-backed scores per client project. */
export function portfolioChart(rows: { name: string; index: number | null; coverage: number; findings: number; critical: number }[]): ChartSpec | null {
  if (rows.length < 2) return null;
  return {
    id: "portfolio", kind: "Grouped bar", title: "Client portfolio comparison", question: "Which clients need attention first?",
    option: p => ({ ...base(p), legend: { textStyle: { color: p.sub }, bottom: 0 }, grid: { left: 130, right: 30, top: 10, bottom: 40 }, tooltip: { ...base(p).tooltip, trigger: "axis" }, xAxis: { type: "value", ...axis(p) }, yAxis: { type: "category", data: rows.map(r => r.name), inverse: true, ...axis(p) }, series: [{ name: "Evidence coverage %", type: "bar", data: rows.map(r => Math.round(r.coverage * 100)), itemStyle: { color: p.violet } }, { name: "Critical and high findings", type: "bar", data: rows.map(r => r.critical), itemStyle: { color: p.red } }, { name: "Intelligence Index", type: "bar", data: rows.map(r => r.index), itemStyle: { color: p.emerald } }] }),
    table: { columns: ["Client", "Index", "Coverage", "Findings", "Critical/high"], rows: rows.map(r => [r.name, r.index ?? "Not calculated", pct(r.coverage), r.findings, r.critical]) },
  };
}
