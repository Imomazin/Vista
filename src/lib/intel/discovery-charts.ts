/**
 * Discovery visuals. Each chart is drawn only from collected evidence or clearly labelled
 * inference held in the DiscoveryRun, answers one question and carries an accessible table.
 */
import { alpha, axis, base, type ChartSpec } from "./charts";
import { promptCategories } from "./geo";
import { tokens } from "./discovery-profile";

import { keywordGroupLabel, type DiscoveryRun, type KeywordGroup } from "./discovery-model";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function positioningMatrix(run: DiscoveryRun): ChartSpec | null {
  const verified = run.competitors.filter(c => c.verified && c.overlap.offerings);
  if (verified.length < 2 || !run.profile) return null;
  const samples = run.samples.length;
  const yLabel = samples ? "Presence in sampled AI answers (%)" : "Shared audience terms";
  const clientY = samples ? pct(run.samples.filter(s => s.brandMentioned).length, samples) : run.profile.segments.filter(s => s.selected).length;
  const points = verified.map(c => ({ name: c.name, x: pct(c.overlap.offerings!.matched.length, c.overlap.offerings!.total), y: samples ? pct(c.overlap.geo?.mentions || 0, samples) : c.overlap.audiences?.shared.length || 0, size: 10 + c.evidence.length * 3, confidence: c.confidence, selected: c.selected }));
  return {
    id: "discovery-positioning", kind: "Competitive positioning matrix", title: "Competitive positioning", question: samples ? "Which competitors overlap most with the client's offer, and which already win AI recommendations?" : "Which competitors overlap most with the client's offer and audiences?",
    option: p => ({ ...base(p), grid: { left: 56, right: 24, top: 30, bottom: 50 }, tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number[] } }) => x.data.name + "<br/>Offering overlap " + x.data.value[0] + "%<br/>" + yLabel + ": " + x.data.value[1] },
      xAxis: { ...axis(p), name: "Offering terms matched (%)", nameLocation: "middle", nameGap: 30, min: 0, max: 100 }, yAxis: { ...axis(p), name: yLabel, nameLocation: "middle", nameGap: 40, min: 0, ...(samples ? { max: 100 } : {}) },
      series: [{ type: "scatter", data: [{ name: run.profile!.brand.value + " (client)", value: [100, clientY], symbolSize: 22, itemStyle: { color: p.violet, borderColor: p.text, borderWidth: 1 } }, ...points.map(pt => ({ name: pt.name, value: [pt.x, pt.y], symbolSize: pt.size, itemStyle: { color: pt.confidence === "high" ? p.emerald : pt.confidence === "medium" ? p.blue : p.sub, opacity: pt.selected ? 0.95 : 0.45 } }))], label: { show: true, position: "right", color: p.sub, fontSize: 10, formatter: (x: { name: string }) => x.name.slice(0, 22) } }],
    }),
    table: { columns: ["Organisation", "Offering overlap %", yLabel, "Confidence", "Recommended"], rows: [[run.profile.brand.value + " (client)", 100, clientY, "—", "—"], ...points.map(pt => [pt.name, pt.x, pt.y, pt.confidence, pt.selected ? "Yes" : "No"])] },
  };
}

export function competitorNetwork(run: DiscoveryRun): ChartSpec | null {
  const verified = run.competitors.filter(c => c.verified && (c.overlap.offerings?.matched.length || 0) > 0);
  if (!verified.length || !run.profile) return null;
  const brand = run.profile.brand.value;
  const cats = ["Client", "Commercial competitor", "Organic search competitor", "GEO competitor", "Shared offering term"];
  const terms = new Map<string, number>();
  for (const c of verified) for (const t of c.overlap.offerings!.matched.slice(0, 6)) terms.set(t, (terms.get(t) || 0) + 1);
  const nodes = [{ name: brand, category: 0, value: 10 }, ...verified.map(c => ({ name: c.name, category: c.kinds.includes("commercial") ? 1 : c.kinds.includes("organic") ? 2 : 3, value: c.overlap.offerings!.matched.length })), ...[...terms.entries()].map(([t, n]) => ({ name: t, category: 4, value: n }))];
  const unique = [...new Map(nodes.map(n => [n.name, n])).values()];
  const links = [...verified.map(c => ({ source: brand, target: c.name, value: c.overlap.offerings!.matched.length })), ...verified.flatMap(c => c.overlap.offerings!.matched.slice(0, 6).map(t => ({ source: c.name, target: t, value: 1 })))];
  return {
    id: "discovery-network", kind: "Network graph", title: "Competitor relationship network", question: "Which competitors share which parts of the client's offer?",
    option: p => ({ ...base(p), legend: { data: cats, textStyle: { color: p.sub }, bottom: 0 }, series: [{ type: "graph", layout: "force", roam: true, force: { repulsion: 220, edgeLength: [60, 120], layoutAnimation: false }, categories: cats.map((c, i) => ({ name: c, itemStyle: { color: [p.violet, p.emerald, p.blue, p.amber, p.sub][i] } })), data: unique.map(n => ({ ...n, symbolSize: n.category === 0 ? 34 : n.category === 4 ? 8 + n.value * 3 : 14 + n.value * 2, label: { show: true, color: p.sub, fontSize: n.category === 4 ? 9 : 10 } })), links: links.map(l => ({ ...l, lineStyle: { color: p.line, width: Math.min(4, 0.6 + l.value * 0.4), opacity: 0.8 } })), emphasis: { focus: "adjacency" } }] }),
    table: { columns: ["Competitor", "Classification", "Shared offering terms"], rows: verified.map(c => [c.name, c.kinds.join(", "), c.overlap.offerings!.matched.join(", ")]) },
  };
}

export function keywordClusterMap(run: DiscoveryRun): ChartSpec | null {
  if (run.keywords.length < 5) return null;
  const clusters = new Map<string, typeof run.keywords>();
  for (const k of run.keywords) clusters.set(k.cluster, [...(clusters.get(k.cluster) || []), k]);
  const top = [...clusters.entries()].sort((a, b) => b[1].reduce((s, k) => s + k.priority, 0) - a[1].reduce((s, k) => s + k.priority, 0)).slice(0, 14);
  const intents = ["transactional", "commercial", "informational", "navigational"];
  return {
    id: "discovery-keyword-clusters", kind: "Treemap", title: "Keyword cluster map", question: "Which topics carry the most commercially relevant search vocabulary?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number; intent?: string } }) => x.data.name + "<br/>" + (x.data.intent ? "Intent: " + x.data.intent + " · priority " + x.data.value : "Cluster priority " + x.data.value) },
      series: [{ type: "treemap", top: 6, bottom: 6, roam: false, breadcrumb: { show: false }, leafDepth: 2, label: { show: true, fontSize: 10, color: p.dark ? "#071712" : "#fff" }, upperLabel: { show: true, height: 20, color: p.text }, itemStyle: { borderColor: p.surface, borderWidth: 1, gapWidth: 1 }, levels: [{ itemStyle: { borderWidth: 3, borderColor: p.surface, gapWidth: 3 } }, {}],
        data: top.map(([name, list]) => ({ name, value: list.reduce((s, k) => s + k.priority, 0), children: list.slice(0, 14).map(k => ({ name: k.keyword, value: k.priority, intent: k.intent, itemStyle: { color: [p.emerald, p.violet, p.blue, p.amber][intents.indexOf(k.intent)] } })) })) }] }),
    table: { columns: ["Cluster", "Keyword", "Intent", "Priority", "Groups"], rows: top.flatMap(([c, list]) => list.map(k => [c, k.keyword, k.intent, k.priority, k.groups.join(", ")])) },
  };
}

export function intentDistribution(run: DiscoveryRun): ChartSpec | null {
  if (run.keywords.length < 5) return null;
  const groups = Object.keys(keywordGroupLabel) as KeywordGroup[];
  const all = groups.map(g => run.keywords.filter(k => k.groups.includes(g)).length);
  const chosen = groups.map(g => run.keywords.filter(k => k.selected && k.groups.includes(g)).length);
  return {
    id: "discovery-intent", kind: "Bar chart", title: "Search intent distribution", question: "How is the keyword universe split across intent and keyword types?",
    option: p => ({ ...base(p), legend: { textStyle: { color: p.sub }, top: 0 }, grid: { left: 150, right: 24, top: 30, bottom: 24 }, xAxis: { ...axis(p), type: "value" }, yAxis: { ...axis(p), type: "category", data: groups.map(g => keywordGroupLabel[g]).reverse() },
      series: [{ name: "Recommended", type: "bar", data: chosen.slice().reverse(), itemStyle: { color: p.emerald, borderRadius: 3 } }, { name: "All discovered", type: "bar", data: all.slice().reverse(), itemStyle: { color: alpha(p.violet, 0.55), borderRadius: 3 } }] }),
    table: { columns: ["Group", "All discovered", "Recommended"], rows: groups.map((g, i) => [keywordGroupLabel[g], all[i], chosen[i]]) },
    native: { type: "bar", labels: groups.map(g => keywordGroupLabel[g]), series: [{ name: "All discovered", values: all }, { name: "Recommended", values: chosen }] },
  };
}

export function offeringTreemap(run: DiscoveryRun): ChartSpec | null {
  const offerings = run.profile?.offerings || [];
  if (offerings.length < 2) return null;
  return {
    id: "discovery-offerings", kind: "Treemap", title: "Products and services", question: "Which offerings does the website evidence most strongly?",
    option: p => ({ ...base(p), tooltip: { ...base(p).tooltip, formatter: (x: { data: { name: string; value: number; basis: string } }) => x.data.name + "<br/>" + x.data.value + " evidence source" + (x.data.value === 1 ? "" : "s") + " · " + x.data.basis },
      series: [{ type: "treemap", top: 6, bottom: 6, roam: false, breadcrumb: { show: false }, label: { show: true, fontSize: 11, color: p.dark ? "#071712" : "#fff" }, itemStyle: { borderColor: p.surface, borderWidth: 2, gapWidth: 2 },
        data: offerings.map(o => ({ name: o.value, value: Math.max(1, o.evidence.length), basis: o.basis === "model" ? "AI interpretation of cited pages" : "stated on the website", itemStyle: { color: o.basis === "model" ? p.violet : o.selected ? p.emerald : p.sub } })) }] }),
    table: { columns: ["Offering", "Evidence sources", "Basis", "Confidence", "Selected"], rows: offerings.map(o => [o.value, o.evidence.length, o.basis, o.confidence, o.selected ? "Yes" : "No"]) },
  };
}

export function promptHeatmap(run: DiscoveryRun): ChartSpec | null {
  if (run.prompts.length < 5) return null;
  const cats = promptCategories.filter(c => run.prompts.some(p => p.category === c.id));
  const cols = ["Prompts", "Approved", "Sampled", "Brand mentioned", "Competitor mentioned"];
  const data: [number, number, number][] = [];
  cats.forEach((c, y) => {
    const list = run.prompts.filter(p => p.category === c.id);
    const values = [list.length, list.filter(p => p.selected).length, list.filter(p => p.sample).length, list.filter(p => p.sample?.brandMentioned).length, list.filter(p => p.sample?.competitors.length).length];
    values.forEach((v, x) => data.push([x, y, v]));
  });
  const max = Math.max(1, ...data.map(d => d[2]));
  return {
    id: "discovery-prompts", kind: "Heatmap", title: "AI prompt category heatmap", question: "Where does the prompt bank concentrate, and where did sampled AI answers mention the brand or competitors?",
    option: p => ({ ...base(p), grid: { left: 170, right: 20, top: 40, bottom: 30 }, xAxis: { ...axis(p), type: "category", data: cols, position: "top", axisLabel: { color: p.sub, fontSize: 10, interval: 0 } }, yAxis: { ...axis(p), type: "category", data: cats.map(c => c.label), inverse: true },
      visualMap: { show: false, min: 0, max, inRange: { color: [alpha(p.emerald, 0.06), p.emerald] } }, series: [{ type: "heatmap", data, label: { show: true, color: p.text, fontSize: 11 }, itemStyle: { borderColor: p.surface, borderWidth: 2 } }] }),
    table: { columns: ["Category", ...cols], rows: cats.map((c, y) => [c.label, ...cols.map((_, x) => data.find(d => d[0] === x && d[1] === y)![2])]) },
  };
}

export function architectureDiagram(run: DiscoveryRun): ChartSpec | null {
  const urls = [...new Set([...(run.site?.sitemapUrls.map(s => s.loc) || []), ...run.pages.map(p => p.finalUrl)])];
  if (urls.length < 4) return null;
  type Node = { name: string; value: number; children: Map<string, Node> };
  const root: Node = { name: "/", value: 0, children: new Map() };
  for (const u of urls) {
    let segs: string[];
    try { segs = new URL(u).pathname.split("/").filter(Boolean).slice(0, 2); } catch { continue; }
    let node = root;
    node.value += 1;
    for (const s of segs) { const key = decodeURIComponent(s).slice(0, 30); if (!node.children.has(key)) node.children.set(key, { name: key, value: 0, children: new Map() }); node = node.children.get(key)!; node.value += 1; }
  }
  const toData = (n: Node, depth: number): Record<string, unknown> => ({ name: n.name, value: n.value, ...(n.children.size && depth < 2 ? { children: [...n.children.values()].sort((a, b) => b.value - a.value).slice(0, depth ? 8 : 14).map(c => toData(c, depth + 1)) } : {}) });
  const top = [...root.children.values()].sort((a, b) => b.value - a.value).slice(0, 14);
  return {
    id: "discovery-architecture", kind: "Sunburst", title: "Website architecture", question: "How is the website's content organised, and which sections hold the most pages?",
    option: p => ({ ...base(p), series: [{ type: "sunburst", radius: ["14%", "92%"], data: top.map(n => toData(n, 1)), sort: undefined, label: { color: p.dark ? "#071712" : "#fff", fontSize: 10, minAngle: 8 }, itemStyle: { borderColor: p.surface, borderWidth: 1 }, levels: [{}, { itemStyle: { color: p.emerald } }, { itemStyle: { color: alpha(p.violet, 0.85) } }] }] }),
    table: { columns: ["Section", "URLs"], rows: top.map(n => ["/" + n.name, n.value]) },
  };
}

export function opportunityProfile(run: DiscoveryRun): ChartSpec | null {
  const offerings = (run.profile?.offerings || []).filter(o => o.selected).slice(0, 8);
  if (offerings.length < 2) return null;
  const homes = run.competitors.filter(c => c.verified && c.selected).map(c => run.competitorHomes[c.website]).filter(Boolean);
  const covers = (text: string, offering: string) => { const t = tokens(offering).filter(x => x.length > 3); return t.length > 0 && t.filter(x => text.includes(x)).length / t.length >= 0.5; };
  const homeText = homes.map(h => [h.title, ...h.h1, ...h.headings.map(x => x.text), h.content.excerpt, ...(h.business?.nav.map(n => n.text) || [])].join(" ").toLowerCase());
  const rows = offerings.map(o => ({ name: o.value, evidence: o.evidence.length, competitors: homeText.filter(t => covers(t, o.value)).length, ai: run.samples.filter(s => covers(s.response.toLowerCase(), o.value)).length }));
  return {
    id: "discovery-opportunity", kind: "Grouped bar chart", title: "Commercial opportunity profile", question: "Which offerings are contested by competitors and discussed in AI answers, relative to how well the client evidences them?",
    option: p => ({ ...base(p), legend: { textStyle: { color: p.sub }, top: 0 }, grid: { left: 40, right: 20, top: 34, bottom: 80 }, xAxis: { ...axis(p), type: "category", data: rows.map(r => r.name), axisLabel: { color: p.sub, rotate: 22, fontSize: 10, interval: 0, formatter: (v: string) => v.length > 22 ? v.slice(0, 21) + "…" : v } }, yAxis: { ...axis(p), type: "value", minInterval: 1 },
      series: [{ name: "Client evidence sources", type: "bar", data: rows.map(r => r.evidence), itemStyle: { color: p.emerald, borderRadius: 3 } }, { name: "Recommended competitors offering it", type: "bar", data: rows.map(r => r.competitors), itemStyle: { color: p.violet, borderRadius: 3 } }, ...(run.samples.length ? [{ name: "Sampled AI answers discussing it", type: "bar", data: rows.map(r => r.ai), itemStyle: { color: p.amber, borderRadius: 3 } }] : [])] }),
    table: { columns: ["Offering", "Client evidence sources", "Competitors offering it", "AI answers discussing it"], rows: rows.map(r => [r.name, r.evidence, r.competitors, run.samples.length ? r.ai : "Not sampled"]) },
    native: { type: "bar", labels: rows.map(r => r.name), series: [{ name: "Client evidence", values: rows.map(r => r.evidence) }, { name: "Competitors", values: rows.map(r => r.competitors) }] },
  };
}

export function discoveryCharts(run: DiscoveryRun): ChartSpec[] {
  return [positioningMatrix(run), competitorNetwork(run), offeringTreemap(run), opportunityProfile(run), keywordClusterMap(run), intentDistribution(run), promptHeatmap(run), architectureDiagram(run)].filter((s): s is ChartSpec => !!s);
}


