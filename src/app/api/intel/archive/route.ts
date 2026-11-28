import { CloudError } from "@/lib/cloud";
import { CcError, ccTerms, domainCaptures, fetchArchived, listCrawls } from "@/lib/intel/commoncrawl";
import { analysePage } from "@/lib/intel/page";
import { intelligenceRoute } from "@/lib/intel/route-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const method = "Common Crawl ZipNum index read by byte range on data.commoncrawl.org (no index server), then single WARC records; bounded per domain and per request.";

/**
 * VisTa Index: Common Crawl (selective, domain-level).
 * { domain, crawls? } → captures per crawl (latest, about six months and about a year earlier).
 * { capture } → one archived HTML page analysed like a live page, dated by its capture.
 */
export async function POST(request: Request) {
  return intelligenceRoute(request, "intel-archive", 40, 4096, async body => {
    try {
      if (body.capture && typeof body.capture === "object") {
        const c = body.capture as Record<string, unknown>;
        const capture = { filename: String(c.filename || ""), offset: Number(c.offset), length: Number(c.length) };
        const record = await fetchArchived(capture);
        const target = record.targetUri && /^https?:\/\//.test(record.targetUri) ? record.targetUri : String(c.url || "");
        if (!/^https?:\/\//.test(target)) throw new CloudError("The archived record has no target address.");
        const page = analysePage({ url: target, finalUrl: target, status: record.status, chain: [{ url: target, status: record.status }], headers: {}, html: record.html.slice(0, 6_000_000), fetchedAt: record.capturedAt, durationMs: 0, depth: 0 });
        return { page, capturedAt: record.capturedAt, crawl: typeof c.crawl === "string" ? c.crawl.slice(0, 20) : "", source: "Common Crawl", terms: ccTerms, method };
      }
      const domain = typeof body.domain === "string" ? body.domain.trim().slice(0, 253) : "";
      if (!domain) throw new CloudError("A domain is required.");
      const ids = await listCrawls();
      const count = Math.max(1, Math.min(3, Number(body.crawls) || 3));
      // Latest crawl, then roughly six and twelve months earlier (crawls run about every month).
      const chosen = [ids[0], ids[6], ids[12]].filter(Boolean).slice(0, count);
      const crawls = [];
      for (const crawl of chosen) {
        try { crawls.push(await domainCaptures(domain, crawl, { maxCaptures: crawl === chosen[0] ? 400 : 150 })); }
        catch (e) { crawls.push({ crawl, error: (e as Error).message, captures: [], uniqueUrls: 0, truncated: false, requests: 0, first: "", last: "" }); }
      }
      return { domain, crawls, collectedAt: new Date().toISOString(), source: "Common Crawl", terms: ccTerms, method, limitation: "Common Crawl is a sample of the public web: a page missing from the archive is not evidence that it is missing from search engines." };
    } catch (e) {
      if (e instanceof CcError) throw new CloudError(e.message, 502);
      throw e;
    }
  }, 120);
}
