/**
 * Single-page technical, content, trust and accessibility analysis from retrieved HTML.
 * Pure function: the same HTML always produces the same record, which keeps findings
 * reproducible and testable. Only bounded excerpts are stored, never full page HTML.
 */
import { load, type CheerioAPI } from "cheerio";
import type { Hop, Retrieval } from "./http";

export type PageType = "home" | "product" | "category" | "service" | "course" | "article" | "pricing" | "contact" | "about" | "legal" | "other";
export type Intent = "navigational" | "informational" | "commercial" | "transactional";
export type LinkRef = { url: string; text: string; nofollow: boolean };

export type PageRecord = {
  url: string;
  finalUrl: string;
  status: number;
  chain: Hop[];
  fetchedAt: string;
  durationMs: number;
  bytes: number;
  depth: number;
  title: string | null;
  description: string | null;
  h1: string[];
  headings: { level: number; text: string }[];
  headingIssues: string[];
  canonical: string | null;
  robotsMeta: string | null;
  xRobots: string | null;
  indexable: boolean;
  indexReasons: string[];
  lang: string | null;
  hreflang: { lang: string; href: string }[];
  og: { title?: string; description?: string; image?: string; type?: string };
  viewport: boolean;
  links: { internal: LinkRef[]; external: LinkRef[]; internalCount: number; externalCount: number };
  content: { words: number; textHash: string; signature: number[]; terms: [string, number][]; avgSentenceWords: number; questionHeadings: number; lists: number; tables: number; excerpt: string };
  images: { count: number; missingAlt: number; emptyAlt: number; noDimensions: number; lazy: number; legacyFormat: number };
  schema: { blocks: number; errors: number; types: string[]; organisation: { name?: string; url?: string; logo?: string; sameAs: string[] } | null; authors: string[]; breadcrumb: boolean; faq: boolean; offers: number; rating: { value: number; count: number } | null };
  performance: { htmlBytes: number; renderBlockingScripts: number; headStylesheets: number; scripts: number; thirdPartyHosts: string[]; inlineScriptBytes: number; preconnect: number; preload: number };
  trust: { https: boolean; hsts: boolean; csp: boolean; contentTypeOptions: boolean; mixedContent: string[]; contactLink: boolean; aboutLink: boolean; privacyLink: boolean; termsLink: boolean; telephone: boolean; address: boolean; email: boolean; authorSignal: boolean };
  accessibility: { langDeclared: boolean; unlabelledInputs: number; unnamedButtons: number; vagueLinks: number; emptyLinks: number; duplicateIds: number; iframesWithoutTitle: number; skipLink: boolean; mainLandmark: boolean };
  keywords: { keyword: string; inTitle: boolean; inH1: boolean; inDescription: boolean; inUrl: boolean; bodyCount: number }[];
  pageType: PageType;
  intent: Intent;
  dates: { modified?: string; published?: string; source: string } | null;
  /** How the document was retrieved: sizes before and after reduction, encoding and truncation. */
  retrieval: { transferBytes: number; decodedBytes: number; retainedBytes: number; encoding: string; truncated: boolean; inlineScriptBytes: number; attempts: number; rendered: boolean } | null;
  /** Little server-rendered content and an application shell: content likely depends on JavaScript. */
  jsDependent: boolean;
};

export type PageInput = {
  url: string;
  finalUrl: string;
  status: number;
  chain: Hop[];
  headers: Record<string, string>;
  html: string;
  fetchedAt: string;
  durationMs: number;
  depth: number;
  keywords?: string[];
  retrieval?: Retrieval;
  rendered?: boolean;
};

const stopwords = new Set("a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves also get got our us may can will one two new use using used via per within without across more most every page home menu skip content cookie cookies accept privacy policy terms read learn click".split(" "));

const clean = (value: string | undefined | null, max = 300) => (value || "").replace(/\s+/g, " ").trim().slice(0, max);

/** Normalise a URL for comparison: drop fragments, default index files and trailing slash differences are kept (they are distinct URLs). */
export function normaliseUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.href;
  } catch { return null; }
}

/** Registrable-domain approximation (last two labels, three for common second-level suffixes). */
export function siteKey(hostname: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return hostname.toLowerCase();
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  const secondLevel = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc"]);
  if (parts.length >= 3 && secondLevel.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function fnv(text: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}

/** 32-value MinHash signature over five-word shingles for near-duplicate detection. */
export function minhash(words: string[], size = 32): number[] {
  const signature = new Array<number>(size).fill(0xffffffff);
  if (words.length < 5) return signature;
  for (let i = 0; i + 5 <= Math.min(words.length, 4000); i += 1) {
    const shingle = words.slice(i, i + 5).join(" ");
    for (let s = 0; s < size; s += 1) {
      const h = fnv(shingle, 0x811c9dc5 ^ Math.imul(s + 1, 0x9e3779b1));
      if (h < signature[s]) signature[s] = h;
    }
  }
  return signature;
}

export function similarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || a[0] === 0xffffffff || b[0] === 0xffffffff) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) same += 1;
  return same / a.length;
}

function jsonLd($: CheerioAPI) {
  const nodes: Record<string, unknown>[] = [];
  let errors = 0;
  const blocks = $('script[type="application/ld+json"]');
  blocks.each((_, element) => {
    try {
      const value = JSON.parse($(element).text());
      const queue: unknown[] = Array.isArray(value) ? [...value] : [value];
      while (queue.length && nodes.length < 200) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        if (Array.isArray(record["@graph"])) queue.push(...(record["@graph"] as unknown[]));
        if (record["@type"]) nodes.push(record);
      }
    } catch { errors += 1; }
  });
  return { nodes, blocks: blocks.length, errors };
}

const typesOf = (node: Record<string, unknown>) => (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).map(String);
const text = (value: unknown) => typeof value === "string" ? clean(value, 200) : value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string" ? clean((value as Record<string, string>).name, 200) : undefined;

function classify(url: URL, types: string[], ogType: string | undefined, offers: number): PageType {
  const path = url.pathname.toLowerCase();
  if (path === "/" || path === "/index.html" || /^\/[a-z]{2}(-[a-z]{2})?\/?$/.test(path)) return "home";
  if (types.some(t => /^(Product|ProductGroup)$/.test(t)) || ogType === "product" || (offers > 0 && /\/(products?|p|item|shop)\//.test(path))) return "product";
  if (/\/(privacy|terms|cookies?|legal|gdpr|accessibility-statement|modern-slavery)/.test(path)) return "legal";
  if (/\/(contact|get-in-touch|enquir)/.test(path) || types.includes("ContactPage")) return "contact";
  if (/\/(pricing|plans|fees)(\/|$)/.test(path)) return "pricing";
  if (types.some(t => /^(Course|EducationEvent)$/.test(t)) || /\/(courses?|training|programmes?|programs?|workshops?|learning)(\/|$)/.test(path)) return "course";
  if (types.some(t => /^(Article|BlogPosting|NewsArticle|TechArticle)$/.test(t)) || /\/(blog|news|insights?|articles?|resources|guides?|stories)(\/|$)/.test(path)) return "article";
  if (/\/(collections?|categor(y|ies)|shop|c|department|range)(\/|$)/.test(path) || types.includes("CollectionPage")) return "category";
  if (types.includes("Service") || /\/(services?|solutions?|consult|what-we-do|expertise|practice-areas?|capabilities)(\/|$)/.test(path)) return "service";
  if (/\/(about|team|our-story|who-we-are|people|leadership|company)(\/|$)/.test(path) || types.includes("AboutPage")) return "about";
  return "other";
}

const intentFor: Record<PageType, Intent> = { home: "navigational", about: "navigational", legal: "navigational", contact: "transactional", pricing: "transactional", product: "transactional", category: "commercial", service: "commercial", course: "commercial", article: "informational", other: "informational" };

export function analysePage(input: PageInput): PageRecord {
  const $ = load(input.html);
  const base = new URL(input.finalUrl);
  const meta = (selector: string) => clean($(selector).first().attr("content"), 500) || null;
  const title = clean($("head title").first().text() || $("title").first().text(), 300) || null;
  const description = meta('meta[name="description" i]');
  const robotsMeta = meta('meta[name="robots" i]') || meta('meta[name="vistasiteintelligence" i]');
  const xRobots = input.headers["x-robots-tag"] || null;
  const canonicalRaw = $('link[rel="canonical" i]').first().attr("href");
  const canonical = canonicalRaw ? normaliseUrl(canonicalRaw, input.finalUrl) : null;
  const lang = clean($("html").attr("lang"), 20) || null;

  // Headings and hierarchy.
  const headings: { level: number; text: string }[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => { if (headings.length < 80) headings.push({ level: Number(el.tagName.slice(1)), text: clean($(el).text(), 160) }); });
  const h1 = headings.filter(h => h.level === 1).map(h => h.text);
  const headingIssues: string[] = [];
  if (!h1.length) headingIssues.push("No H1 heading.");
  if (h1.length > 1) headingIssues.push(h1.length + " H1 headings.");
  for (let i = 1; i < headings.length; i += 1) if (headings[i].level > headings[i - 1].level + 1) { headingIssues.push("Heading level skips from H" + headings[i - 1].level + " to H" + headings[i].level + " (\"" + headings[i].text.slice(0, 50) + "\")."); break; }
  if (headings.some(h => !h.text)) headingIssues.push("Empty heading element.");

  // Links.
  const internal: LinkRef[] = [];
  const external: LinkRef[] = [];
  let internalCount = 0, externalCount = 0, vagueLinks = 0, emptyLinks = 0;
  const seenInternal = new Set<string>(), seenExternal = new Set<string>();
  const host = siteKey(base.hostname);
  $("a[href]").each((_, el) => {
    const anchor = $(el);
    const href = anchor.attr("href") || "";
    const label = clean(anchor.text() || anchor.attr("aria-label") || anchor.find("img").attr("alt"), 120);
    if (!label) emptyLinks += 1;
    if (/^(click here|here|read more|more|learn more|find out more|this link)$/i.test(label)) vagueLinks += 1;
    if (/^(mailto|tel|javascript|data):/i.test(href) || href.startsWith("#")) return;
    const target = normaliseUrl(href, input.finalUrl);
    if (!target) return;
    const nofollow = /\bnofollow\b/i.test(anchor.attr("rel") || "");
    const isInternal = siteKey(new URL(target).hostname) === host;
    if (isInternal) { internalCount += 1; if (!seenInternal.has(target) && internal.length < 400) { seenInternal.add(target); internal.push({ url: target, text: label, nofollow }); } }
    else { externalCount += 1; if (!seenExternal.has(target) && external.length < 150) { seenExternal.add(target); external.push({ url: target, text: label, nofollow }); } }
  });

  // Structured data.
  const ld = jsonLd($);
  const types = [...new Set(ld.nodes.flatMap(typesOf))].slice(0, 40);
  const orgNode = ld.nodes.find(n => typesOf(n).some(t => /^(Organization|Corporation|LocalBusiness|EducationalOrganization|ProfessionalService|Store|OnlineStore|NGO)$/.test(t)));
  const sameAs = orgNode ? (Array.isArray(orgNode.sameAs) ? orgNode.sameAs : orgNode.sameAs ? [orgNode.sameAs] : []).filter((v): v is string => typeof v === "string").slice(0, 20) : [];
  const organisation = orgNode ? { name: text(orgNode.name), url: typeof orgNode.url === "string" ? orgNode.url : undefined, logo: typeof orgNode.logo === "string" ? orgNode.logo : text(orgNode.logo), sameAs } : null;
  const authors = [...new Set(ld.nodes.flatMap(n => { const a = n.author; const list = Array.isArray(a) ? a : a ? [a] : []; return list.map(text).filter((v): v is string => !!v); }))].slice(0, 10);
  const offers = ld.nodes.reduce((sum, n) => sum + (n.offers ? (Array.isArray(n.offers) ? n.offers.length : 1) : 0), 0);
  const ratingNode = ld.nodes.map(n => n.aggregateRating as Record<string, unknown> | undefined).find(r => r && typeof r === "object");
  const rating = ratingNode && Number.isFinite(Number(ratingNode.ratingValue)) ? { value: Number(ratingNode.ratingValue), count: Number(ratingNode.reviewCount ?? ratingNode.ratingCount ?? 0) || 0 } : null;
  const dated = ld.nodes.find(n => typeof n.dateModified === "string" || typeof n.datePublished === "string");
  const metaModified = meta('meta[property="article:modified_time"]');
  const metaPublished = meta('meta[property="article:published_time"]');
  const dates = dated ? { modified: dated.dateModified as string | undefined, published: dated.datePublished as string | undefined, source: "JSON-LD" }
    : metaModified || metaPublished ? { modified: metaModified || undefined, published: metaPublished || undefined, source: "Article meta tags" }
    : input.headers["last-modified"] ? { modified: input.headers["last-modified"], source: "Last-Modified header (server-reported, may reflect deployment rather than content)" } : null;

  // Content (scripts, styles and navigation chrome removed).
  const body = $("body").clone();
  body.find("script,style,noscript,svg,template,iframe").remove();
  const mainText = clean((body.find("main").length ? body.find("main") : body).text(), 200_000);
  const words = mainText.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const sentences = mainText.split(/[.!?]+\s/).filter(s => s.trim().split(/\s+/).length > 3);
  const termCounts = new Map<string, number>();
  const weighted = [...words, ...(title || "").toLowerCase().split(/\W+/), ...(title || "").toLowerCase().split(/\W+/), ...h1.join(" ").toLowerCase().split(/\W+/), ...h1.join(" ").toLowerCase().split(/\W+/), ...headings.map(h => h.text).join(" ").toLowerCase().split(/\W+/)];
  for (const w of weighted) if (w.length > 2 && !stopwords.has(w) && !/^\d+$/.test(w)) termCounts.set(w, (termCounts.get(w) || 0) + 1);
  const terms = [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  // Images.
  let missingAlt = 0, emptyAlt = 0, noDimensions = 0, lazy = 0, legacyFormat = 0;
  const imgs = $("img");
  imgs.each((_, el) => {
    const img = $(el);
    const alt = img.attr("alt");
    if (alt === undefined) missingAlt += 1; else if (!alt.trim()) emptyAlt += 1;
    if (!img.attr("width") || !img.attr("height")) noDimensions += 1;
    if ((img.attr("loading") || "").toLowerCase() === "lazy") lazy += 1;
    const src = img.attr("src") || img.attr("data-src") || "";
    if (/\.(jpe?g|png|gif|bmp)(\?|$)/i.test(src) && !$(el).closest("picture").find('source[type="image/webp"],source[type="image/avif"]').length) legacyFormat += 1;
  });

  // Performance indicators from the HTML (not timings).
  const head = $("head");
  const renderBlockingScripts = head.find("script[src]").filter((_, el) => { const s = $(el); return s.attr("async") === undefined && s.attr("defer") === undefined && (s.attr("type") || "").toLowerCase() !== "module"; }).length;
  const thirdParty = new Set<string>();
  $("script[src],link[rel~='stylesheet'][href],iframe[src]").each((_, el) => {
    const target = normaliseUrl($(el).attr("src") || $(el).attr("href") || "", input.finalUrl);
    if (target) { const h = new URL(target).hostname; if (siteKey(h) !== host) thirdParty.add(h); }
  });
  let inlineScriptBytes = input.retrieval?.reduction?.inlineScriptBytes ?? 0;
  $("script:not([src])").each((_, el) => { if ((el.attribs?.type || "").toLowerCase() !== "application/ld+json") inlineScriptBytes += $(el).text().length; });

  // Trust and security.
  const https = base.protocol === "https:";
  const mixedContent: string[] = [];
  if (https) $("img[src],script[src],link[rel~='stylesheet'][href],iframe[src],video[src],audio[src],source[src]").each((_, el) => {
    const value = $(el).attr("src") || $(el).attr("href") || "";
    if (/^http:\/\//i.test(value) && mixedContent.length < 10) mixedContent.push(value.slice(0, 200));
  });
  const anchors = $("a[href]").map((_, el) => ($(el).attr("href") || "") + " " + $(el).text()).get().join(" \n ").toLowerCase();
  const pageText = mainText.toLowerCase();
  const trust = {
    https,
    hsts: Boolean(input.headers["strict-transport-security"]),
    csp: Boolean(input.headers["content-security-policy"]),
    contentTypeOptions: /nosniff/i.test(input.headers["x-content-type-options"] || ""),
    mixedContent,
    contactLink: /contact|get in touch|enquir/.test(anchors),
    aboutLink: /\babout\b|our story|who we are|our team/.test(anchors),
    privacyLink: /privacy/.test(anchors),
    termsLink: /terms|conditions/.test(anchors),
    telephone: $('a[href^="tel:"]').length > 0 || ld.nodes.some(n => typeof n.telephone === "string"),
    address: $("address").length > 0 || ld.nodes.some(n => n.address && typeof n.address === "object"),
    email: $('a[href^="mailto:"]').length > 0,
    authorSignal: authors.length > 0 || $('meta[name="author" i]').length > 0 || $('a[rel~="author"]').length > 0 || /\bwritten by\b|\bauthor\b/.test(pageText.slice(0, 5000)),
  };

  // Accessibility basics.
  const ids = new Map<string, number>();
  $("[id]").each((_, el) => { const id = $(el).attr("id") || ""; ids.set(id, (ids.get(id) || 0) + 1); });
  const unlabelledInputs = $("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea").filter((_, el) => {
    const field = $(el); const id = field.attr("id");
    return !field.attr("aria-label") && !field.attr("aria-labelledby") && !field.attr("title") && !(id && $('label[for="' + id.replace(/"/g, "") + '"]').length) && !field.closest("label").length;
  }).length;
  const unnamedButtons = $("button").filter((_, el) => !clean($(el).text()) && !$(el).attr("aria-label") && !$(el).attr("aria-labelledby") && !$(el).attr("title")).length;

  // Keyword relevance against declared target keywords.
  const lowerUrl = decodeURIComponent(base.pathname).toLowerCase().replace(/[-_/]+/g, " ");
  const keywords = (input.keywords || []).slice(0, 25).map(raw => {
    const keyword = raw.toLowerCase().trim();
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { keyword, inTitle: (title || "").toLowerCase().includes(keyword), inH1: h1.join(" ").toLowerCase().includes(keyword), inDescription: (description || "").toLowerCase().includes(keyword), inUrl: lowerUrl.includes(keyword), bodyCount: keyword ? (pageText.match(new RegExp(escaped, "g")) || []).length : 0 };
  });

  const ogType = meta('meta[property="og:type"]') || undefined;
  const pageType = classify(base, types, ogType, offers);

  // Technical indexability (not confirmed indexing).
  const indexReasons: string[] = [];
  if (input.status !== 200) indexReasons.push("Returns HTTP " + input.status + ".");
  if (/\b(noindex|none)\b/i.test(robotsMeta || "")) indexReasons.push("Meta robots contains noindex.");
  if (/\b(noindex|none)\b/i.test(xRobots || "")) indexReasons.push("X-Robots-Tag header contains noindex.");
  if (canonical && canonical !== input.finalUrl && canonical.replace(/\/$/, "") !== input.finalUrl.replace(/\/$/, "")) indexReasons.push("Canonical points to another URL: " + canonical);
  if (input.chain.length > 1) indexReasons.push("Reached through " + (input.chain.length - 1) + " redirect(s); the requested URL itself is not the indexable address.");

  return {
    url: input.url,
    finalUrl: input.finalUrl,
    status: input.status,
    chain: input.chain,
    fetchedAt: input.fetchedAt,
    durationMs: input.durationMs,
    bytes: input.html.length,
    depth: input.depth,
    title, description, h1, headings: headings.slice(0, 40), headingIssues,
    canonical, robotsMeta, xRobots,
    indexable: indexReasons.length === 0,
    indexReasons,
    lang,
    hreflang: $('link[rel="alternate" i][hreflang]').map((_, el) => ({ lang: clean($(el).attr("hreflang"), 20), href: normaliseUrl($(el).attr("href") || "", input.finalUrl) || "" })).get().filter(h => h.lang && h.href).slice(0, 60),
    og: { title: meta('meta[property="og:title"]') || undefined, description: meta('meta[property="og:description"]') || undefined, image: meta('meta[property="og:image"]') || undefined, type: ogType },
    viewport: /width\s*=\s*device-width/i.test(meta('meta[name="viewport" i]') || ""),
    links: { internal, external, internalCount, externalCount },
    content: {
      words: words.length,
      textHash: fnv(words.join(" ")).toString(16),
      signature: minhash(words),
      terms,
      avgSentenceWords: sentences.length ? Math.round(words.length / sentences.length) : 0,
      questionHeadings: headings.filter(h => /\?$/.test(h.text) || /^(what|how|why|when|where|which|who|can|does|is|are|should)\b/i.test(h.text)).length,
      lists: $("main ul, main ol, article ul, article ol").length || $("ul,ol").length,
      tables: $("table").length,
      excerpt: mainText.slice(0, 400),
    },
    images: { count: imgs.length, missingAlt, emptyAlt, noDimensions, lazy, legacyFormat },
    schema: { blocks: ld.blocks, errors: ld.errors, types, organisation, authors, breadcrumb: types.includes("BreadcrumbList"), faq: types.includes("FAQPage"), offers, rating },
    performance: { htmlBytes: input.retrieval?.decodedBytes || input.html.length, renderBlockingScripts, headStylesheets: head.find("link[rel~='stylesheet']").length, scripts: $("script[src]").length, thirdPartyHosts: [...thirdParty].slice(0, 30), inlineScriptBytes, preconnect: $("link[rel~='preconnect']").length, preload: $("link[rel~='preload']").length },
    trust,
    accessibility: { langDeclared: Boolean(lang), unlabelledInputs, unnamedButtons, vagueLinks, emptyLinks, duplicateIds: [...ids.values()].filter(n => n > 1).length, iframesWithoutTitle: $("iframe:not([title])").length, skipLink: $('a[href^="#"]').filter((_, el) => /skip/i.test($(el).text())).length > 0, mainLandmark: $("main,[role=main]").length > 0 },
    keywords,
    pageType,
    intent: intentFor[pageType],
    dates,
    retrieval: input.retrieval ? { transferBytes: input.retrieval.transferBytes, decodedBytes: input.retrieval.decodedBytes, retainedBytes: input.retrieval.retainedBytes, encoding: input.retrieval.encoding, truncated: input.retrieval.truncated, inlineScriptBytes, attempts: input.retrieval.attempts, rendered: Boolean(input.rendered) } : null,
    jsDependent: !input.rendered && words.length < 120 && ($("script[src]").length >= 3 || inlineScriptBytes > 50_000 || $("#root,#app,#__next,#__nuxt,#svelte,[data-reactroot]").filter((_, el) => clean($(el).text()).length < 40).length > 0 || /enable javascript|requires javascript/i.test($("noscript").text())),
  };
}
