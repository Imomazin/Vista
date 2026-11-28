import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
/** True when an IPv4 address is private, reserved or otherwise not a public destination. */
export function blockedAddress(address: string): boolean { return isIP(address) !== 4 || blocked.check(address, "ipv4"); }
for (const [range, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4]
] as [string, number][]) {
  blocked.addSubnet(range, prefix, "ipv4");
}

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

/**
 * Legacy single-page retrieval used by the public audit, the Deep Investigation page and the job
 * worker. It applies the shared VisTa resource policy (streaming, compression, decoded and retained
 * limits, HTML reduction and bounded retries) while keeping the stricter HTTPS-only rule.
 */
export async function fetchPublicHtml(rawInput: string): Promise<{ url: string; html: string; robots: string; truncated: boolean; decodedBytes: number }> {
  let url: URL;
  try {
    url = validateUrl(rawInput.trim());
  } catch {
    throw new Error("Use a valid public HTTPS address such as https://example.com.");
  }
  const { fetchPublic, FetchFailure } = await import("./intel/http");
  try {
    const response = await fetchPublic(url.href, { reduce: true, maxRedirects: 4 });
    if (response.chain.some(hop => !hop.url.startsWith("https:")) || !response.finalUrl.startsWith("https:")) throw new Error("The website redirected to a non-HTTPS address.");
    if (response.status < 200 || response.status >= 300) throw new Error("The target returned HTTP " + response.status + ".");
    return { url: response.finalUrl, html: response.body, robots: response.headers["x-robots-tag"] || "", truncated: response.retrieval.truncated, decodedBytes: response.retrieval.decodedBytes };
  } catch (error) {
    if (error instanceof FetchFailure) throw new Error(error.message);
    throw error;
  }
}
