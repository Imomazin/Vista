/**
 * VisTa Graph: authority and relationships from observed evidence only.
 *
 * Nodes are pages and domains VisTa has crawled (client, competitors, pages cited in sampled AI
 * answers) and the link targets seen on them; edges are observed links (dated by the crawl) and
 * observed AI citations. Indicators are PageRank estimates scaled within this bounded graph, with a
 * coverage statement: observed links only, not a global backlink index.
 * Methodology: docs/proprietary-intelligence.md#4-vista-graph-authority-and-relationships
 */
import type { PageRecord } from "./page";
import { siteKey } from "./page";
import { pageKey } from "./observations";

const host = (url: string) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } };
const domainOf = (url: string) => { const h = host(url); return h ? siteKey(h) : ""; };
/** Social and community platforms: linked from almost every site, shown separately from sector authorities. */
export const socialPlatform = /(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|reddit|quora|threads|bsky|mastodon|weibo|xiaohongshu|douyin|vk|whatsapp|wa|t|telegram|snapchat|medium|substack|discord|vimeo|flickr|tumblr)\.[a-z.]+$/i;
const utility = /(^|\.)(google|googleapis|gstatic|googletagmanager|doubleclick|bing|apple|microsoft|cloudflare|jsdelivr|unpkg|wordpress|wix|squarespace|shopify|gravatar|w3|schema|creativecommons|adobe|calendly|zoom|mailchimp|hubspot|typeform|paypal|stripe)\.[a-z.]+$/i;

export type GraphInput = {
  website: string;
  pages: PageRecord[];
  competitorPages: Record<string, PageRecord[]>;
  competitors: { name: string; website: string }[];
  /** Pages cited in sampled AI answers that VisTa fetched (robots.txt respected). */
  sourcePages: PageRecord[];
  citations: { url: string; at: string }[];
  priority: string[];
  at?: string;
};
export type DomainKind = "client" | "competitor" | "source" | "linked";
export type VistaGraph = {
  version: 1; computedAt: string; method: string;
  coverage: { pages: number; clientPages: number; competitorPages: number; sourcePages: number; domains: number; links: number; citations: number; observedFrom: string; observedTo: string; statement: string };
  internal: { url: string; title: string; authority: number; inlinks: number; outlinks: number; sampled: boolean; priority: boolean }[];
  weakPriority: string[];
  domains: { domain: string; kind: DomainKind; authority: number; referringDomains: string[]; linkingPages: number; platform: boolean }[];
  referringToClient: { domain: string; kind: DomainKind; pages: string[] }[];
  coCitation: { domain: string; linkedBy: string[]; citations: number }[];
  entities: { organisations: { name: string; site: string; sameAs: string[] }[]; authors: string[]; profiles: string[] };
};

export const graphMethod = "VisTa Graph v1. Internal link authority: weighted PageRank (damping 0.85, at most 50 iterations) over the client's crawled pages and their internal link targets, with navigation and footer links on 70% or more of pages weighted 0.15, scaled 0–100 within this graph. Observed-graph authority: PageRank over domains, with an edge for each crawled page linking to another domain, scaled 0–100 within this graph. Domains are ranked by the number of observed websites linking to them. Co-citation: domains linked from two or more of the client and its competitors, cited in two or more sampled AI answers, or both linked and cited.";

/** Weighted PageRank with uniform redistribution of dangling mass; deterministic for a given node order. */
export function pagerank(nodes: string[], edges: [string, string, number?][], damping = 0.85, iterations = 50): Map<string, number> {
  const n = nodes.length;
  const out = new Map<string, Map<string, number>>(nodes.map(id => [id, new Map()]));
  for (const [a, b, w = 1] of edges) if (a !== b && out.has(a) && out.has(b) && !out.get(a)!.has(b)) out.get(a)!.set(b, w);
  let rank = new Map(nodes.map(id => [id, 1 / Math.max(1, n)]));
  for (let i = 0; i < iterations && n; i += 1) {
    const next = new Map(nodes.map(id => [id, (1 - damping) / n]));
    let dangling = 0;
    for (const id of nodes) {
      const targets = out.get(id)!, r = rank.get(id)!;
      const total = [...targets.values()].reduce((s, w) => s + w, 0);
      if (!total) dangling += r;
      else for (const [t, w] of targets) next.set(t, next.get(t)! + damping * r * w / total);
    }
    for (const id of nodes) next.set(id, next.get(id)! + damping * dangling / n);
    const delta = nodes.reduce((s, id) => s + Math.abs(next.get(id)! - rank.get(id)!), 0);
    rank = next;
    if (delta < 1e-9) break;
  }
  return rank;
}
const scale = (rank: Map<string, number>) => { const max = Math.max(0, ...rank.values()); return (id: string) => max ? Math.round((rank.get(id) || 0) / max * 100) : 0; };

export function buildGraph(input: GraphInput): VistaGraph {
  const client = domainOf(input.website);
  const competitorDomains = new Map(input.competitors.map(c => [domainOf(c.website), c.name] as [string, string]).filter(([d]) => d && d !== client));
  // Only the recommended or selected competitors' pages: rejected candidates (universities, publishers) are not the sector.
  const chosen = new Set(input.competitors.map(c => domainOf(c.website)));
  const competitorPages = Object.entries(input.competitorPages).filter(([site]) => chosen.has(domainOf(site))).flatMap(([, pages]) => pages);
  const all: { page: PageRecord; kind: DomainKind }[] = [
    ...input.pages.map(page => ({ page, kind: "client" as const })),
    ...competitorPages.map(page => ({ page, kind: "competitor" as const })),
    ...input.sourcePages.map(page => ({ page, kind: "source" as const })),
  ].filter(x => x.page.status >= 200 && x.page.status < 300);

  // Internal link authority over the client's pages and their link targets.
  const clientPages = all.filter(x => x.kind === "client").map(x => x.page);
  const titles = new Map(clientPages.map(p => [pageKey(p.finalUrl), p.title || p.finalUrl]));
  const urls = new Map(clientPages.map(p => [pageKey(p.finalUrl), p.finalUrl]));
  const internalEdges: [string, string, number][] = [];
  const inlinks = new Map<string, Set<string>>(), outlinks = new Map<string, number>();
  for (const p of clientPages) {
    const from = pageKey(p.finalUrl);
    const targets = new Set(p.links.internal.filter(l => domainOf(l.url) === client).map(l => pageKey(l.url.split("#")[0])).filter(t => t && t !== from));
    outlinks.set(from, targets.size);
    for (const t of targets) { internalEdges.push([from, t, 1]); if (!urls.has(t)) urls.set(t, p.links.internal.find(l => pageKey(l.url.split("#")[0]) === t)!.url.split("#")[0]); (inlinks.get(t) || inlinks.set(t, new Set()).get(t)!).add(from); }
  }
  // Template links (navigation and footer, on 70% or more of the sampled pages) count for less than contextual links.
  if (clientPages.length >= 4) for (const e of internalEdges) if ((inlinks.get(e[1])?.size || 0) >= 0.7 * clientPages.length) e[2] = 0.15;
  const internalNodes = [...urls.keys()].sort();
  const internalScore = scale(pagerank(internalNodes, internalEdges));
  const priority = new Set(input.priority.map(pageKey));
  const sampled = new Set(clientPages.map(p => pageKey(p.finalUrl)));
  const internal = internalNodes.map(k => ({ url: urls.get(k)!, title: titles.get(k) || urls.get(k)!, authority: internalScore(k), inlinks: inlinks.get(k)?.size || 0, outlinks: outlinks.get(k) || 0, sampled: sampled.has(k), priority: priority.has(k) }))
    .filter(p => !/\/cdn-cgi\/|\/wp-json\/|\/feed\/?$|\/xmlrpc|\/wp-login/.test(p.url))
    .sort((a, b) => b.authority - a.authority || a.url.localeCompare(b.url));
  const home = pageKey(input.website);
  const weakPriority = internal.filter(p => p.priority && pageKeyOf(p.url) !== home && p.inlinks === 0).map(p => p.url);

  // Domain graph from observed external links.
  const kindOf = (d: string): DomainKind => d === client ? "client" : competitorDomains.has(d) ? "competitor" : all.some(x => x.kind === "source" && domainOf(x.page.finalUrl) === d) ? "source" : "linked";
  const linkPages = new Map<string, Map<string, Set<string>>>(); // target → source domain → pages
  for (const { page } of all) {
    const from = domainOf(page.finalUrl);
    for (const l of page.links.external) {
      const to = domainOf(l.url);
      if (!to || to === from || utility.test(host(l.url)) || /(^|\.)share\.google$/.test(host(l.url))) continue;
      const bySource = linkPages.get(to) || linkPages.set(to, new Map()).get(to)!;
      (bySource.get(from) || bySource.set(from, new Set()).get(from)!).add(page.finalUrl);
    }
  }
  const domainNodes = [...new Set([client, ...competitorDomains.keys(), ...all.map(x => domainOf(x.page.finalUrl)), ...linkPages.keys()])].filter(Boolean).sort();
  const domainEdges: [string, string][] = [];
  for (const [to, sources] of linkPages) for (const from of sources.keys()) domainEdges.push([from, to]);
  const domainScore = scale(pagerank(domainNodes, domainEdges));
  // Ranked by how many observed websites link to the domain, then by observed-graph authority.
  const domains = domainNodes.map(d => ({ domain: d, kind: kindOf(d), authority: domainScore(d), referringDomains: [...(linkPages.get(d)?.keys() || [])].sort(), linkingPages: [...(linkPages.get(d)?.values() || [])].reduce((n, s) => n + s.size, 0), platform: socialPlatform.test(d) }))
    .sort((a, b) => b.referringDomains.length - a.referringDomains.length || b.authority - a.authority || a.domain.localeCompare(b.domain));
  const referringToClient = [...(linkPages.get(client)?.entries() || [])].map(([domain, pages]) => ({ domain, kind: kindOf(domain), pages: [...pages].sort() })).sort((a, b) => b.pages.length - a.pages.length || a.domain.localeCompare(b.domain));

  // Co-citation: domains linked from (or cited alongside) two or more of the client and its competitors.
  const citedBy = new Map<string, number>();
  // Search engines, maps and share links are how answers link out, not sector sources.
  for (const c of input.citations) { const h = host(c.url), d = domainOf(c.url); if (d && !utility.test(h) && !socialPlatform.test(h) && !/(^|\.)share\.google$/.test(h)) citedBy.set(d, (citedBy.get(d) || 0) + 1); }
  const actors = new Set([client, ...competitorDomains.keys()]);
  const coCitation = domainNodes.filter(d => !actors.has(d) && !socialPlatform.test(d)).map(d => {
    const linkedBy = [...(linkPages.get(d)?.keys() || [])].filter(s => actors.has(s)).map(s => s === client ? "client" : competitorDomains.get(s)!);
    return { domain: d, linkedBy: linkedBy.sort(), citations: citedBy.get(d) || 0 };
  }).filter(x => x.linkedBy.length >= 2 || x.citations >= 2 || (x.linkedBy.length >= 1 && x.citations >= 1)).sort((a, b) => b.linkedBy.length + b.citations - (a.linkedBy.length + a.citations) || a.domain.localeCompare(b.domain)).slice(0, 20);

  // Entities from structured data.
  const orgs = new Map<string, { name: string; site: string; sameAs: string[] }>();
  for (const { page, kind } of all) { const o = page.schema.organisation; if (o?.name && kind !== "source" && !orgs.has(o.name.toLowerCase())) orgs.set(o.name.toLowerCase(), { name: o.name, site: domainOf(page.finalUrl), sameAs: o.sameAs.slice(0, 8) }); }
  const authors = [...new Set(clientPages.flatMap(p => p.schema.authors))].slice(0, 20);
  const profiles = [...new Set(clientPages.flatMap(p => [...(p.schema.organisation?.sameAs || []), ...p.links.external.map(l => l.url).filter(u => socialPlatform.test(host(u)))]))].slice(0, 12);

  const dates = all.map(x => x.page.fetchedAt).filter(Boolean).sort();
  const links = [...linkPages.values()].reduce((n, m) => n + [...m.values()].reduce((s, p) => s + p.size, 0), 0) + internalEdges.length;
  const crawledDomains = new Set(all.map(x => domainOf(x.page.finalUrl))).size;
  return {
    version: 1, computedAt: input.at || new Date().toISOString(), method: graphMethod,
    coverage: {
      pages: all.length, clientPages: clientPages.length, competitorPages: all.filter(x => x.kind === "competitor").length, sourcePages: all.filter(x => x.kind === "source").length,
      domains: domainNodes.length, links, citations: input.citations.length, observedFrom: dates[0] || "", observedTo: dates[dates.length - 1] || "",
      statement: "Observed links only: " + all.length + " pages crawled by VisTa on " + crawledDomains + " website" + (crawledDomains === 1 ? "" : "s") + (input.citations.length ? ", plus " + input.citations.length + " citations in sampled AI answers" : "") + ". This is not a global backlink index: links on pages VisTa has not crawled are not included, and authority scores are relative to this graph only.",
    },
    internal, weakPriority, domains, referringToClient, coCitation,
    entities: { organisations: [...orgs.values()].slice(0, 12), authors, profiles },
  };
}
const pageKeyOf = pageKey;
