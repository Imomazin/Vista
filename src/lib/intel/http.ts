/**
 * Bounded public-web fetcher for VisTa website intelligence.
 *
 * Every hop is validated before connecting: public hostnames only, default ports only, no
 * credentials, DNS answers pinned to a vetted public IPv4 address, redirect count and loops
 * bounded. Bodies are streamed under a configurable resource policy with separate limits for
 * transferred (compressed) bytes, decoded bytes and retained HTML, plus a compression-ratio
 * guard against decompression bombs. HTML is reduced while streaming so pages heavy with
 * inline scripts, styles and data URIs remain analysable without retaining those payloads.
 */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { isIP } from "node:net";
import { blockedAddress } from "../safe-fetch";
import { HtmlReducer, type ReductionStats } from "./reducer";

export const crawlerUserAgent = "VistaSiteIntelligence/0.3 (+https://vista.ambidexters.com)";

export type Hop = { url: string; status: number; location?: string };
export type FailureKind =
  | "invalid-url" | "dns" | "blocked-address" | "timeout" | "connection" | "too-large"
  | "decompression-limit" | "decode" | "redirect-loop" | "too-many-redirects" | "unsupported-type";

export class FetchFailure extends Error {
  constructor(public kind: FailureKind, message: string, public chain: Hop[] = []) { super(message); }
}

export type Retrieval = { transferBytes: number; decodedBytes: number; retainedBytes: number; encoding: string; truncated: boolean; attempts: number; reduction: ReductionStats | null };

export type FetchOutcome = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: Hop[];
  headers: Record<string, string>;
  contentType: string;
  body: string;
  bytes: number;
  durationMs: number;
  truncated?: boolean;
  retrieval: Retrieval;
};

/** Resource policy. Defaults can be tuned per deployment through environment variables. */
export type ResourcePolicy = { maxTransferBytes: number; maxDecodedBytes: number; maxHtmlBytes: number; maxCompressionRatio: number; timeoutMs: number; retries: number };
const MB = 1024 * 1024;
const clampNumber = (value: string | undefined, fallback: number, min: number, max: number) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback; };
export function resourcePolicy(env: Record<string, string | undefined> = process.env): ResourcePolicy {
  return {
    maxTransferBytes: Math.round(clampNumber(env.VISTA_CRAWL_MAX_TRANSFER_MB, 15, 1, 50) * MB),
    maxDecodedBytes: Math.round(clampNumber(env.VISTA_CRAWL_MAX_DECODED_MB, 60, 2, 200) * MB),
    maxHtmlBytes: Math.round(clampNumber(env.VISTA_CRAWL_MAX_HTML_MB, 10, 1, 25) * MB),
    maxCompressionRatio: clampNumber(env.VISTA_CRAWL_MAX_COMPRESSION_RATIO, 120, 20, 500),
    timeoutMs: Math.round(clampNumber(env.VISTA_CRAWL_TIMEOUT_MS, 15000, 3000, 45000)),
    retries: Math.round(clampNumber(env.VISTA_CRAWL_RETRIES, 1, 0, 3)),
  };
}

export type FetchOptions = {
  accept?: string;
  /** Content types whose body is read. Other successful responses fail as unsupported-type. */
  bodyTypes?: RegExp;
  /** Maximum retained characters (reduced HTML or raw text). Defaults to the policy HTML limit. */
  maxBytes?: number;
  timeoutMs?: number;
  method?: "GET" | "HEAD";
  maxRedirects?: number;
  /** When false the body is discarded; useful for link status checks. */
  readBody?: boolean;
  /** Keep the first maxBytes of an oversized body (marked truncated) instead of failing. */
  allowTruncate?: boolean;
  /** Reduce HTML while streaming (scripts, styles, SVG and data URIs removed; JSON-LD kept). */
  reduce?: boolean;
  /** Retries for transient failures (timeouts, connection resets, 429/5xx). Defaults to the policy. */
  retries?: number;
  policy?: ResourcePolicy;
};

const headerAllowList = [
  "content-type", "content-length", "content-encoding", "last-modified", "x-robots-tag", "strict-transport-security",
  "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy",
  "permissions-policy", "cache-control", "server", "link", "content-language", "location", "retry-after",
];

/**
 * Test origins (for example http://127.0.0.1:4810) may be allowed for local end-to-end
 * fixtures. The allowance is ignored on Vercel and must be set explicitly.
 */
export function testOrigins(env: Record<string, string | undefined> = process.env): Set<string> {
  if (env.VERCEL === "1" || !env.VISTA_TEST_CRAWL_ORIGINS) return new Set();
  return new Set(env.VISTA_TEST_CRAWL_ORIGINS.split(",").map(v => v.trim()).filter(Boolean).map(v => new URL(v).origin));
}

export function validatePublicUrl(input: string, env: Record<string, string | undefined> = process.env): URL {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new FetchFailure("invalid-url", "The address is not a valid URL."); }
  url.hash = "";
  if (testOrigins(env).has(url.origin)) return url;
  if (!["https:", "http:"].includes(url.protocol)) throw new FetchFailure("invalid-url", "Only HTTP and HTTPS website addresses are supported.");
  if (url.username || url.password) throw new FetchFailure("invalid-url", "Addresses with embedded credentials are not inspected.");
  if (url.port) throw new FetchFailure("invalid-url", "Custom ports are not inspected; use the public website address.");
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) !== 0 || /\.(local|internal|localhost|lan|home|corp)$/.test(host) || host === "localhost") {
    throw new FetchFailure("invalid-url", "Only public website hostnames are inspected.");
  }
  return url;
}

export async function resolvePublic(url: URL, remaining: number): Promise<string | null> {
  if (testOrigins().has(url.origin)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      dns.lookup(url.hostname, { family: 4, all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new FetchFailure("dns", "The hostname lookup timed out.")), Math.min(4000, remaining)); }),
    ]);
    if (!addresses.length) throw new FetchFailure("dns", "The hostname did not resolve.");
    if (addresses.some(a => blockedAddress(a.address))) throw new FetchFailure("blocked-address", "The hostname resolves to a private or reserved address and was not contacted.");
    return addresses[0].address;
  } catch (error) {
    if (error instanceof FetchFailure) throw error;
    throw new FetchFailure("dns", "The hostname could not be resolved. Check the domain name.");
  } finally { clearTimeout(timer); }
}

type RawResponse = { status: number; headers: Record<string, string>; body: string; retrieval: Omit<Retrieval, "attempts"> };
type RequestSettings = { accept: string; bodyTypes: RegExp; maxBytes: number; method: "GET" | "HEAD"; readBody: boolean; allowTruncate: boolean; reduce: boolean; policy: ResourcePolicy; timeoutMs: number };

function decoderFor(encoding: string): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null | "unsupported" {
  if (!encoding || encoding === "identity") return null;
  if (encoding === "gzip" || encoding === "x-gzip") return zlib.createGunzip();
  if (encoding === "deflate") return zlib.createInflate();
  if (encoding === "br") return zlib.createBrotliDecompress();
  return "unsupported";
}

function textDecoder(contentType: string): TextDecoder {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() || "utf-8";
  try { return new TextDecoder(charset); } catch { return new TextDecoder("utf-8"); }
}

function request(url: URL, ip: string | null, o: RequestSettings, deadline: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const client = url.protocol === "http:" ? http : https;
    const wantsAnyBody = o.readBody && o.method === "GET";
    const req = client.request(url, {
      method: o.method,
      headers: { "User-Agent": crawlerUserAgent, Accept: o.accept, "Accept-Encoding": wantsAnyBody ? "gzip, deflate, br" : "identity", "Accept-Language": "en-GB,en;q=0.8" },
      lookup: ip ? (_host, lookupOptions, callback) => {
        const deliver = callback as unknown as (...args: unknown[]) => void;
        if (typeof lookupOptions === "object" && lookupOptions.all) deliver(null, [{ address: ip, family: 4 }]);
        else deliver(null, ip, 4);
      } : undefined,
      timeout: Math.max(1000, Math.min(o.timeoutMs, deadline - Date.now())),
      maxHeaderSize: 32768,
    }, res => {
      const status = res.statusCode || 0;
      const headers: Record<string, string> = {};
      for (const name of headerAllowList) {
        const value = res.headers[name];
        if (typeof value === "string") headers[name] = value.slice(0, 2000);
        else if (Array.isArray(value)) headers[name] = value.join(", ").slice(0, 2000);
      }
      const encoding = (headers["content-encoding"] || "identity").toLowerCase().trim();
      const empty = { transferBytes: 0, decodedBytes: 0, retainedBytes: 0, encoding, truncated: false, reduction: null };
      const wantsBody = wantsAnyBody && status >= 200 && status < 300 && o.bodyTypes.test(headers["content-type"] || "");
      if (!wantsBody) { settle(() => resolve({ status, headers, body: "", retrieval: empty })); res.destroy(); return; }
      const decoder = decoderFor(encoding);
      if (decoder === "unsupported") { settle(() => reject(new FetchFailure("decode", "The response uses an unsupported content encoding (" + encoding + ")."))); res.destroy(); return; }
      const declared = Number(headers["content-length"]);
      if (Number.isFinite(declared) && declared > o.policy.maxTransferBytes) { settle(() => reject(new FetchFailure("too-large", "The response declares " + Math.round(declared / MB) + " MB, above the " + Math.round(o.policy.maxTransferBytes / MB) + " MB transfer limit."))); res.destroy(); return; }
      const text = textDecoder(headers["content-type"] || "");
      const reducer = o.reduce ? new HtmlReducer(o.maxBytes) : null;
      const parts: string[] = [];
      let transfer = 0, decoded = 0, kept = 0, truncated = false;
      const stop = () => { res.destroy(); if (decoder) decoder.destroy(); req.destroy(); };
      const abort = (failure: FetchFailure) => { settle(() => reject(failure)); stop(); };
      const finish = () => {
        if (reducer) {
          reducer.feed(text.decode());
          const result = reducer.finish();
          settle(() => resolve({ status, headers, body: result.html, retrieval: { transferBytes: transfer, decodedBytes: decoded, retainedBytes: result.html.length, encoding, truncated: result.stats.truncated, reduction: result.stats } }));
        } else {
          const tail = text.decode();
          if (tail && kept + tail.length <= o.maxBytes) parts.push(tail);
          const body = parts.join("");
          settle(() => resolve({ status, headers, body, retrieval: { transferBytes: transfer, decodedBytes: decoded, retainedBytes: body.length, encoding, truncated, reduction: null } }));
        }
      };
      const onDecoded = (chunk: Buffer) => {
        if (settled) return;
        decoded += chunk.length;
        if (decoded > o.policy.maxDecodedBytes) return abort(new FetchFailure("decompression-limit", "The decoded response exceeds the " + Math.round(o.policy.maxDecodedBytes / MB) + " MB processing limit."));
        if (decoder && decoded > 8 * MB && decoded > transfer * o.policy.maxCompressionRatio) return abort(new FetchFailure("decompression-limit", "The response expands more than " + o.policy.maxCompressionRatio + "× when decompressed and was stopped as a possible decompression bomb."));
        const piece = text.decode(chunk, { stream: true });
        if (reducer) {
          reducer.feed(piece);
          if (reducer.stats.truncated) { finish(); stop(); }
          return;
        }
        if (kept + piece.length > o.maxBytes) {
          if (o.allowTruncate) { parts.push(piece.slice(0, o.maxBytes - kept)); kept = o.maxBytes; truncated = true; finish(); stop(); return; }
          return abort(new FetchFailure("too-large", "The response exceeds the " + Math.round(o.maxBytes / 1024) + " KB inspection limit."));
        }
        parts.push(piece);
        kept += piece.length;
      };
      res.on("data", (chunk: Buffer) => { transfer += chunk.length; if (transfer > o.policy.maxTransferBytes) abort(new FetchFailure("too-large", "The response exceeds the " + Math.round(o.policy.maxTransferBytes / MB) + " MB transfer limit.")); });
      res.on("error", () => abort(new FetchFailure("connection", "The connection was interrupted while reading the response.")));
      if (decoder) {
        res.pipe(decoder);
        decoder.on("data", onDecoded);
        decoder.on("end", () => { if (!settled) finish(); });
        decoder.on("error", () => abort(new FetchFailure("decode", "The compressed response could not be decoded.")));
      } else {
        res.on("data", onDecoded);
        res.on("end", () => { if (!settled) finish(); });
      }
    });
    const total = setTimeout(() => req.destroy(new FetchFailure("timeout", "The website did not respond within the time limit.")), Math.max(1, Math.min(o.timeoutMs, deadline - Date.now())));
    req.on("close", () => clearTimeout(total));
    req.on("timeout", () => req.destroy(new FetchFailure("timeout", "The website did not respond within the time limit.")));
    req.on("error", error => settle(() => reject(error instanceof FetchFailure ? error : new FetchFailure("connection", "The connection to the website failed (" + (error as NodeJS.ErrnoException).code + ")."))));
    req.end();
  });
}

const transient = (kind: FailureKind) => kind === "timeout" || kind === "connection";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Fetch a public URL, following and recording up to `maxRedirects` validated redirects, with bounded retries. */
export async function fetchPublic(input: string, options: FetchOptions = {}): Promise<FetchOutcome> {
  const policy = options.policy ?? resourcePolicy();
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? policy.timeoutMs;
  const retries = options.retries ?? (options.method === "HEAD" ? 0 : policy.retries);
  const deadline = started + timeoutMs * (retries + 1) + 1500 * retries;
  const settings: RequestSettings = {
    accept: options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    bodyTypes: options.bodyTypes ?? /text\/html|application\/xhtml\+xml/i,
    maxBytes: options.maxBytes ?? policy.maxHtmlBytes,
    method: options.method ?? "GET",
    readBody: options.readBody ?? true,
    allowTruncate: options.allowTruncate ?? false,
    reduce: options.reduce ?? false,
    policy,
    timeoutMs,
  };
  const maxRedirects = options.maxRedirects ?? 5;
  const requested = validatePublicUrl(input);
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const outcome = await followRedirects(requested, settings, maxRedirects, Math.min(deadline, Date.now() + timeoutMs));
      const retryable = (outcome.status === 429 || (outcome.status >= 500 && outcome.status <= 504)) && attempt <= retries && Number(outcome.headers["retry-after"] || 0) <= 5 && deadline - Date.now() > 3000;
      if (!retryable) return { ...outcome, durationMs: Date.now() - started, retrieval: { ...outcome.retrieval, attempts: attempt } };
    } catch (error) {
      if (!(error instanceof FetchFailure) || !transient(error.kind) || attempt > retries || deadline - Date.now() < 3000) throw error;
    }
    await sleep(600 * attempt);
  }
}

async function followRedirects(start: URL, settings: RequestSettings, maxRedirects: number, deadline: number): Promise<Omit<FetchOutcome, "durationMs">> {
  let url = start;
  const chain: Hop[] = [];
  const visited = new Set<string>();
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (visited.has(url.href)) throw new FetchFailure("redirect-loop", "The URL redirects in a loop.", chain);
    visited.add(url.href);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new FetchFailure("timeout", "The website did not respond within the time limit.", chain);
    const ip = await resolvePublic(url, remaining);
    let response: RawResponse;
    try { response = await request(url, ip, settings, deadline); }
    catch (error) { if (error instanceof FetchFailure) { error.chain = chain; throw error; } throw new FetchFailure("connection", "The connection to the website failed.", chain); }
    const location = response.headers.location;
    chain.push({ url: url.href, status: response.status, ...(location ? { location } : {}) });
    if (response.status >= 300 && response.status < 400 && location) {
      try { url = validatePublicUrl(new URL(location, url).href); }
      catch (error) { if (error instanceof FetchFailure) { error.chain = chain; throw error; } throw error; }
      continue;
    }
    const contentType = response.headers["content-type"] || "";
    if (settings.readBody && settings.method === "GET" && response.status >= 200 && response.status < 300 && !settings.bodyTypes.test(contentType)) {
      throw new FetchFailure("unsupported-type", "The response is " + (contentType.split(";")[0] || "an unknown type") + ", not a supported document.", chain);
    }
    return { requestedUrl: start.href, finalUrl: url.href, status: response.status, chain, headers: response.headers, contentType, body: response.body, bytes: response.retrieval.decodedBytes, ...(response.retrieval.truncated ? { truncated: true } : {}), retrieval: { ...response.retrieval, attempts: 1 } };
  }
  throw new FetchFailure("too-many-redirects", "The URL redirects more than " + maxRedirects + " times.", chain);
}

export { explainFailure } from "./explain";
