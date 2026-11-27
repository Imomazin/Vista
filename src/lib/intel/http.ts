/**
 * Bounded public-web fetcher for VisTa website intelligence.
 *
 * Every hop is validated before connecting: public hostnames only, default ports only,
 * no credentials, DNS answers pinned to a vetted public IPv4 address, response size and
 * total time capped. Redirect chains are recorded hop by hop so redirect findings are
 * evidence rather than inference.
 */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { blockedAddress } from "../safe-fetch";

export const crawlerUserAgent = "VistaSiteIntelligence/0.2 (+https://vista.ambidexters.com)";

export type Hop = { url: string; status: number; location?: string };
export type FailureKind =
  | "invalid-url" | "dns" | "blocked-address" | "timeout" | "connection" | "too-large"
  | "redirect-loop" | "too-many-redirects" | "unsupported-type";

export class FetchFailure extends Error {
  constructor(public kind: FailureKind, message: string, public chain: Hop[] = []) { super(message); }
}

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
};

export type FetchOptions = {
  accept?: string;
  /** Content types whose body is read. Other successful responses fail as unsupported-type. */
  bodyTypes?: RegExp;
  maxBytes?: number;
  timeoutMs?: number;
  method?: "GET" | "HEAD";
  maxRedirects?: number;
  /** When false the body is discarded; useful for link status checks. */
  readBody?: boolean;
  /** Keep the first maxBytes of an oversized body (marked truncated) instead of failing. */
  allowTruncate?: boolean;
};

const headerAllowList = [
  "content-type", "content-length", "last-modified", "x-robots-tag", "strict-transport-security",
  "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy",
  "permissions-policy", "cache-control", "server", "link", "content-language", "location",
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

async function resolvePublic(url: URL, remaining: number): Promise<string | null> {
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

type RawResponse = { status: number; headers: Record<string, string>; body: string; bytes: number; truncated?: boolean };

function request(url: URL, ip: string | null, options: Required<Pick<FetchOptions, "accept" | "maxBytes" | "method" | "readBody" | "allowTruncate">> & { bodyTypes: RegExp }, deadline: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "http:" ? http : https;
    const req = client.request(url, {
      method: options.method,
      headers: { "User-Agent": crawlerUserAgent, Accept: options.accept, "Accept-Encoding": "identity", "Accept-Language": "en-GB,en;q=0.8" },
      lookup: ip ? (_host, lookupOptions, callback) => {
        const deliver = callback as unknown as (...args: unknown[]) => void;
        if (typeof lookupOptions === "object" && lookupOptions.all) deliver(null, [{ address: ip, family: 4 }]);
        else deliver(null, ip, 4);
      } : undefined,
      timeout: Math.max(1000, Math.min(12000, deadline - Date.now())),
      maxHeaderSize: 32768,
    }, res => {
      const status = res.statusCode || 0;
      const headers: Record<string, string> = {};
      for (const name of headerAllowList) {
        const value = res.headers[name];
        if (typeof value === "string") headers[name] = value.slice(0, 2000);
        else if (Array.isArray(value)) headers[name] = value.join(", ").slice(0, 2000);
      }
      const wantsBody = options.readBody && options.method === "GET" && status >= 200 && status < 300 && options.bodyTypes.test(headers["content-type"] || "");
      if (!wantsBody) {
        // Status and headers are the evidence; drain (or drop) the body without storing it.
        resolve({ status, headers, body: "", bytes: 0 });
        res.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > options.maxBytes) {
          if (options.allowTruncate) { chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (bytes - options.maxBytes)))); resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), bytes: options.maxBytes, truncated: true }); req.destroy(); return; }
          req.destroy(new FetchFailure("too-large", "The response exceeds the " + Math.round(options.maxBytes / 1024) + " KB inspection limit.")); return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), bytes }));
      res.on("error", reject);
    });
    const total = setTimeout(() => req.destroy(new FetchFailure("timeout", "The website did not respond within the time limit.")), Math.max(1, deadline - Date.now()));
    req.on("close", () => clearTimeout(total));
    req.on("timeout", () => req.destroy(new FetchFailure("timeout", "The website did not respond within the time limit.")));
    req.on("error", error => reject(error instanceof FetchFailure ? error : new FetchFailure("connection", "The connection to the website failed (" + (error as NodeJS.ErrnoException).code + ").")));
    req.end();
  });
}

/** Fetch a public URL, following and recording up to `maxRedirects` validated redirects. */
export async function fetchPublic(input: string, options: FetchOptions = {}): Promise<FetchOutcome> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 12000;
  const deadline = started + timeoutMs;
  const settings = {
    accept: options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    bodyTypes: options.bodyTypes ?? /text\/html|application\/xhtml\+xml/i,
    maxBytes: options.maxBytes ?? 5_000_000,
    method: options.method ?? "GET",
    readBody: options.readBody ?? true,
    allowTruncate: options.allowTruncate ?? false,
  };
  const maxRedirects = options.maxRedirects ?? 5;
  let url = validatePublicUrl(input);
  const requestedUrl = url.href;
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
    return { requestedUrl, finalUrl: url.href, status: response.status, chain, headers: response.headers, contentType, body: response.body, bytes: response.bytes, durationMs: Date.now() - started, ...(response.truncated ? { truncated: true } : {}) };
  }
  throw new FetchFailure("too-many-redirects", "The URL redirects more than " + maxRedirects + " times.", chain);
}

export { explainFailure } from "./explain";
