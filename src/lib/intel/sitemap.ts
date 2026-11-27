export type SitemapEntry = { loc: string; lastmod?: string };
export type SitemapDocument = { kind: "urlset" | "index" | "invalid"; entries: SitemapEntry[]; truncated: boolean; error?: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

/**
 * Parse an XML sitemap or sitemap index by scanning <url>/<sitemap> entries. Streaming-style
 * extraction keeps very large (or deliberately truncated) sitemaps within memory and time limits.
 */
export function parseSitemap(xml: string, limit = 5000, documentTruncated = false): SitemapDocument {
  const root = /<(?:[\w-]+:)?(urlset|sitemapindex)[\s>]/i.exec(xml);
  if (!root) return { kind: "invalid", entries: [], truncated: false, error: "The document is not a sitemap (no urlset or sitemapindex element)." };
  const isIndex = root[1].toLowerCase() === "sitemapindex";
  const tag = isIndex ? "sitemap" : "url";
  const block = new RegExp("<(?:[\\w-]+:)?" + tag + "[\\s>]([\\s\\S]*?)</(?:[\\w-]+:)?" + tag + ">", "gi");
  const entries: SitemapEntry[] = [];
  let total = 0, match: RegExpExecArray | null;
  while ((match = block.exec(xml))) {
    total += 1;
    if (entries.length >= limit) continue;
    const loc = /<(?:[\w-]+:)?loc>([\s\S]*?)<\/(?:[\w-]+:)?loc>/i.exec(match[1]);
    const lastmod = /<(?:[\w-]+:)?lastmod>([\s\S]*?)<\/(?:[\w-]+:)?lastmod>/i.exec(match[1]);
    if (!loc) continue;
    try {
      const url = new URL(decode(loc[1]));
      if (!["http:", "https:"].includes(url.protocol)) continue;
      entries.push({ loc: url.href, ...(lastmod ? { lastmod: decode(lastmod[1]) } : {}) });
    } catch { /* Invalid locations are skipped. */ }
  }
  return { kind: isIndex ? "index" : "urlset", entries, truncated: documentTruncated || total > entries.length };
}
