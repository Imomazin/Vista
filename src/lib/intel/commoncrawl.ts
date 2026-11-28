/**
 * VisTa Index: selective, domain-level Common Crawl access (https://commoncrawl.org/terms-of-use).
 *
 * The public index server is not required: VisTa binary-searches each crawl's ZipNum `cluster.idx`
 * (sorted by SURT key, about 110 MB) with small HTTP range requests on data.commoncrawl.org, then
 * reads only the one to three compressed index blocks that hold the domain, and fetches individual
 * archived pages as single WARC records by byte range. Bounded: a few crawls, capped captures and
 * blocks per domain, capped record size. Only derived observations are kept, never raw headers.
 */
import { gunzipSync } from "node:zlib";

export const ccBase = "https://data.commoncrawl.org/";
export const ccTerms = "https://commoncrawl.org/terms-of-use";
export type CcCapture = { url: string; timestamp: string; status: number; mime: string; digest: string; length: number; offset: number; filename: string; crawl: string };
export type CcDomainResult = { crawl: string; captures: CcCapture[]; uniqueUrls: number; truncated: boolean; requests: number; first: string; last: string };
export type CcRecord = { html: string; capturedAt: string; targetUri: string; status: number; contentType: string };

const crawlPattern = /^CC-MAIN-\d{4}-\d{2}$/;
const warcPath = /^crawl-data\/CC-MAIN-\d{4}-\d{2}\/segments\/[0-9.]+\/(warc|crawldiagnostics)\/[A-Za-z0-9._-]+\.warc\.gz$/;
const cdxFile = /^cdx-\d{5}\.gz$/;

export class CcError extends Error {}

/** Registrable host in SURT form: "www.LabMedExpert.com" → "com,labmedexpert". */
export function surtDomain(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^\d+(\.\d+){3}$/.test(h)) throw new CcError("A public domain name is required.");
  return h.split(".").reverse().join(",");
}

/** "20251109014928" → "2025-11-09T01:49:28Z". */
export function ccDate(ts: string): string {
  return /^\d{14}$/.test(ts) ? ts.slice(0, 4) + "-" + ts.slice(4, 6) + "-" + ts.slice(6, 8) + "T" + ts.slice(8, 10) + ":" + ts.slice(10, 12) + ":" + ts.slice(12, 14) + "Z" : "";
}

type Fetcher = typeof fetch;
type Counter = { requests: number };
/** Back-off between retries; tests set these to zero. */
export const retryDelays = [1000, 3000];
async function range(fetcher: Fetcher, path: string, from: number, to: number, counter: Counter): Promise<{ buf: Buffer; total: number }> {
  counter.requests += 1;
  if (counter.requests > 80) throw new CcError("Common Crawl request budget for this lookup was reached.");
  let response: Response | null = null;
  // Common Crawl throttles bursts with 503 "slow down": back off politely and retry (1 s, then 3 s).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
    try { response = await fetcher(ccBase + path, { headers: { Range: "bytes=" + from + "-" + to }, cache: "no-store", signal: AbortSignal.timeout(15000) }); }
    catch { if (attempt === 2) throw new CcError("Common Crawl could not be reached."); continue; }
    if (response.status !== 503 && response.status !== 429) break;
  }
  if (!response) throw new CcError("Common Crawl could not be reached.");
  if (response.status === 503 || response.status === 429) throw new CcError("Common Crawl is throttling requests (HTTP " + response.status + "); try again in a few minutes.");
  if (response.status !== 206 && response.status !== 200) throw new CcError("Common Crawl returned HTTP " + response.status + ".");
  const buf = Buffer.from(await response.arrayBuffer());
  return { buf, total: Number((response.headers.get("content-range") || "").split("/")[1]) || buf.length };
}

let crawlCache: { at: number; ids: string[] } | null = null;
/** Crawl identifiers, newest first, from the public crawl listing (cached for 12 hours). */
export async function listCrawls(fetcher: Fetcher = fetch): Promise<string[]> {
  if (crawlCache && Date.now() - crawlCache.at < 12 * 3600_000) return crawlCache.ids;
  let text: string;
  try {
    const r = await fetcher(ccBase + "crawl-data/index.html", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error();
    text = (await r.text()).slice(0, 2_000_000);
  } catch { throw new CcError("The Common Crawl crawl listing could not be read."); }
  const ids = [...new Set(text.match(/CC-MAIN-\d{4}-\d{2}/g) || [])].sort().reverse();
  if (!ids.length) throw new CcError("The Common Crawl crawl listing contained no crawls.");
  crawlCache = { at: Date.now(), ids };
  return ids;
}

type IdxLine = { key: string; file: string; offset: number; length: number };
function parseIdx(line: string): IdxLine | null {
  const [head, file, offset, length] = line.split("\t");
  const key = head?.split(" ")[0];
  if (!key || !file || !cdxFile.test(file)) return null;
  return { key, file, offset: Number(offset), length: Number(length) };
}

/** Captures of a domain (and its subdomains) in one crawl. */
export async function domainCaptures(domain: string, crawl: string, opts: { fetcher?: Fetcher; maxBlocks?: number; maxCaptures?: number } = {}): Promise<CcDomainResult> {
  if (!crawlPattern.test(crawl)) throw new CcError("Unknown crawl.");
  const fetcher = opts.fetcher || fetch, maxBlocks = opts.maxBlocks ?? 3, maxCaptures = opts.maxCaptures ?? 500;
  const surt = surtDomain(domain);
  const start = surt + ")", sub = surt + ",", end = surt + "-"; // ")" and "," sort before "-": the domain's keys lie in [start, end).
  const counter: Counter = { requests: 0 };
  const idx = "cc-index/collections/" + crawl + "/indexes/cluster.idx";
  const window = 8192;
  const linesAt = async (pos: number, total: number) => {
    const { buf } = await range(fetcher, idx, pos, Math.min(total - 1, pos + window), counter);
    const s = buf.toString("latin1");
    const lines = s.slice(pos === 0 ? 0 : s.indexOf("\n") + 1).split("\n");
    if (pos + window < total - 1) lines.pop(); // the last line may be cut off
    return lines.map(parseIdx).filter((l): l is IdxLine => Boolean(l));
  };
  const total = (await range(fetcher, idx, 0, 0, counter)).total;
  // Binary search: the window whose first key is the last one before the domain.
  let lo = 0, hi = total;
  while (hi - lo > window) {
    const mid = Math.floor((lo + hi) / 2);
    const lines = await linesAt(mid, total);
    if (lines.length && lines[0].key < start) lo = mid; else hi = mid;
  }
  let lines = await linesAt(lo, total);
  let i = lines.findIndex(l => l.key >= start);
  if (i === -1) { const next = await linesAt(Math.min(total - 1, lo + window), total); lines = [...lines, ...next]; i = lines.findIndex(l => l.key >= start); }
  i = i <= 0 ? 0 : i - 1;
  const blocks: IdxLine[] = [];
  let truncated = false;
  for (let j = i; j < lines.length; j += 1) {
    if (j > i && lines[j].key >= end) break;
    if (blocks.length >= maxBlocks) { truncated = true; break; }
    blocks.push(lines[j]);
  }
  const byUrl = new Map<string, CcCapture>();
  for (const b of blocks) {
    if (!(b.length > 0 && b.length < 5_000_000)) continue;
    const { buf } = await range(fetcher, "cc-index/collections/" + crawl + "/indexes/" + b.file, b.offset, b.offset + b.length - 1, counter);
    let text: string;
    try { text = gunzipSync(buf).toString("utf8"); } catch { throw new CcError("A Common Crawl index block could not be decompressed."); }
    for (const line of text.split("\n")) {
      if (!line.startsWith(start) && !line.startsWith(sub)) continue;
      const space = line.indexOf(" "), brace = line.indexOf("{");
      const timestamp = line.slice(space + 1, brace - 1).trim();
      let j: Record<string, string>;
      try { j = JSON.parse(line.slice(brace)); } catch { continue; }
      if (!j.url || !j.filename || !warcPath.test(j.filename)) continue;
      const capture: CcCapture = { url: j.url, timestamp, status: Number(j.status) || 0, mime: j["mime-detected"] || j.mime || "", digest: j.digest || "", length: Number(j.length), offset: Number(j.offset), filename: j.filename, crawl };
      const existing = byUrl.get(capture.url);
      if (!existing || existing.timestamp < capture.timestamp) byUrl.set(capture.url, capture);
    }
  }
  const all = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
  const times = all.map(c => c.timestamp).sort();
  return { crawl, captures: all.slice(0, maxCaptures), uniqueUrls: all.length, truncated: truncated || all.length > maxCaptures, requests: counter.requests, first: ccDate(times[0] || ""), last: ccDate(times[times.length - 1] || "") };
}

/** One archived response (HTML only), fetched as a single WARC record by byte range. */
export async function fetchArchived(capture: Pick<CcCapture, "filename" | "offset" | "length">, opts: { fetcher?: Fetcher; maxBytes?: number } = {}): Promise<CcRecord> {
  const maxBytes = opts.maxBytes ?? 4_000_000;
  if (!warcPath.test(capture.filename)) throw new CcError("Invalid archive record path.");
  if (!Number.isSafeInteger(capture.offset) || capture.offset < 0 || !Number.isSafeInteger(capture.length) || capture.length <= 0) throw new CcError("Invalid archive record range.");
  if (capture.length > maxBytes) throw new CcError("The archived record is larger than VisTa's " + Math.round(maxBytes / 1_000_000) + " MB limit.");
  const { buf } = await range(opts.fetcher || fetch, capture.filename, capture.offset, capture.offset + capture.length - 1, { requests: 0 });
  let raw: Buffer;
  try { raw = gunzipSync(buf, { maxOutputLength: 20_000_000 }); } catch { throw new CcError("The archived record could not be decompressed."); }
  const text = raw.toString("latin1");
  const warcEnd = text.indexOf("\r\n\r\n");
  const httpEnd = text.indexOf("\r\n\r\n", warcEnd + 4);
  if (warcEnd < 0 || httpEnd < 0) throw new CcError("The archived record is not a WARC response.");
  const warc = text.slice(0, warcEnd), http = text.slice(warcEnd + 4, httpEnd);
  const header = (block: string, name: string) => block.split("\r\n").find(l => l.toLowerCase().startsWith(name.toLowerCase() + ":"))?.slice(name.length + 1).trim() || "";
  if (header(warc, "WARC-Type") !== "response") throw new CcError("The archived record is not a response.");
  const status = Number(http.split("\r\n")[0].split(" ")[1]) || 0;
  const contentType = header(http, "Content-Type");
  if (contentType && !/html/i.test(contentType)) throw new CcError("The archived record is not an HTML page.");
  return { html: raw.subarray(httpEnd + 4).toString("utf8"), capturedAt: header(warc, "WARC-Date"), targetUri: header(warc, "WARC-Target-URI"), status, contentType };
}
