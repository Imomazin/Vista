/** Plain-language explanations for source failures (shared by server and browser code). */
import type { FailureKind } from "./http";

/** Human explanation used by the processing view when a source fails. */
export function explainFailure(kind: FailureKind | "http-error" | "robots" | "budget", status?: number): string {
  switch (kind) {
    case "invalid-url": return "The address is not a public website URL, so it was not contacted.";
    case "dns": return "The domain name could not be resolved. It may be misspelt, expired or temporarily unavailable.";
    case "blocked-address": return "The domain resolves to a private or reserved network address. VisTa does not contact internal networks.";
    case "timeout": return "The server did not respond in time. Retrying later or reducing crawl depth may help.";
    case "connection": return "The connection failed before a response was received (refused, reset or TLS error).";
    case "too-large": return "The document exceeds the inspection size limit and was not analysed.";
    case "redirect-loop": return "The URL redirects in a loop, so no final page could be reached.";
    case "too-many-redirects": return "The redirect chain is too long to follow.";
    case "unsupported-type": return "The URL does not return an HTML document.";
    case "robots": return "robots.txt disallows this URL for VisTa, so it was respected and not fetched.";
    case "budget": return "The configured crawl budget was reached before this URL could be processed.";
    case "http-error": return status === 403 || status === 401 ? "The server refused access (HTTP " + status + "). It may block automated requests." : status === 429 ? "The server rate-limited the request (HTTP 429). Retry with a smaller crawl." : status && status >= 500 ? "The server returned an error (HTTP " + status + ")." : "The URL returned HTTP " + status + ".";
  }
}
