import dns from "node:dns/promises";
import https from "node:https";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [range, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4]
] as [string, number][]) {
  blocked.addSubnet(range, prefix, "ipv4");
}

const maxBytes = 1024 * 1024;

function validateUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.port || url.username || url.password) {
    throw new Error("Enter a public HTTPS website address without credentials or a custom port.");
  }
  if (!url.hostname.includes(".") || isIP(url.hostname) !== 0 || url.hostname.endsWith(".local")) {
    throw new Error("Only public website hostnames are supported.");
  }
  return url;
}

async function responseFor(url: URL): Promise<{ status: number; body: string; location?: string; robots: string }> {
  const addresses = await dns.lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(({ address }) => blocked.check(address, "ipv4"))) {
    throw new Error("The hostname did not resolve to a permitted public address.");
  }
  const ip = addresses[0].address;
  return await new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      headers: {
        "User-Agent": "VistaSiteIntelligence/0.1 (+https://ambidexters.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity"
      },
      lookup: (_hostname, _options, callback) => callback(null, ip, 4),
      timeout: 9000,
      maxHeaderSize: 16384
    }, (res) => {
      const status = res.statusCode || 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : undefined;
      const robots = typeof res.headers["x-robots-tag"] === "string" ? res.headers["x-robots-tag"] : "";
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, body: "", location, robots });
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error("The target returned HTTP " + status + "."));
        return;
      }
      const contentType = String(res.headers["content-type"] || "");
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        res.resume();
        reject(new Error("The target is not an HTML page."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          req.destroy(new Error("The page exceeds the 1 MB audit limit."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8"), robots }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("The website request timed out.")));
    req.end();
  });
}

export async function fetchPublicHtml(rawInput: string): Promise<{ url: string; html: string; robots: string }> {
  let url: URL;
  try {
    url = validateUrl(rawInput.trim());
  } catch {
    throw new Error("Use a valid public HTTPS address such as https://example.com.");
  }
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await responseFor(url);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = validateUrl(new URL(response.location, url).href);
      continue;
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error("The website returned an unsupported redirect.");
    }
    return { url: url.href, html: response.body, robots: response.robots };
  }
  throw new Error("The page redirects too many times.");
}
