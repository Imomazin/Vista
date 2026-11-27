import { load } from "cheerio";

export type SitemapEntry = { loc: string; lastmod?: string };
export type SitemapDocument = { kind: "urlset" | "index" | "invalid"; entries: SitemapEntry[]; truncated: boolean; error?: string };

/** Parse an XML sitemap or sitemap index. Entries are bounded to protect memory. */
export function parseSitemap(xml: string, limit = 5000): SitemapDocument {
  if (!/<(urlset|sitemapindex)[\s>]/i.test(xml)) return { kind: "invalid", entries: [], truncated: false, error: "The document is not a sitemap (no urlset or sitemapindex element)." };
  const $ = load(xml, { xml: true });
  const isIndex = $("sitemapindex").length > 0;
  const nodes = isIndex ? $("sitemapindex > sitemap") : $("urlset > url");
  const entries: SitemapEntry[] = [];
  nodes.each((_, node) => {
    if (entries.length >= limit) return false;
    const loc = $(node).children("loc").first().text().trim();
    const lastmod = $(node).children("lastmod").first().text().trim();
    if (!loc) return;
    try {
      const url = new URL(loc);
      if (!["http:", "https:"].includes(url.protocol)) return;
      entries.push({ loc: url.href, ...(lastmod ? { lastmod } : {}) });
    } catch { /* Invalid locations are skipped and counted by the caller. */ }
  });
  return { kind: isIndex ? "index" : "urlset", entries, truncated: nodes.length > entries.length };
}
