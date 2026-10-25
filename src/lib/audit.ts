import {inspectSite} from "./site-inspection";
import type {SiteInspection} from "./inspection-schema";
import { load } from "cheerio";

export type SignalStatus = "pass" | "warning" | "issue";

export type AuditSignal = {
  id: string;
  name: string;
  status: SignalStatus;
  detail: string;
  recommendation: string;
};

export type AuditReport = {
  inspection?: SiteInspection;
  url: string;
  inspectedAt: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  language: string | null;
  headingOneCount: number;
  headingTwoCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  structuredDataBlocks: number;
  technicalScore: number;
  signals: AuditSignal[];
  limitations: string[];
};

export function analyseHtml(url: string, html: string, xRobotsTag = ""): AuditReport {
  const $ = load(html);
  const meta = (name: string) => {
    const value = $('meta[name="' + name + '"]').first().attr("content");
    return value?.trim() || null;
  };
  const title = $("title").first().text().trim() || null;
  const description = meta("description");
  const canonical = $('link[rel="canonical"]').first().attr("href")?.trim() || null;
  const language = $("html").first().attr("lang")?.trim() || null;
  const robots = (meta("robots") || "") + " " + xRobotsTag;
  const noindex = /\b(noindex|none)\b/i.test(robots);
  const h1Count = $("h1").length;
  const h2Count = $("h2").length;
  const imageCount = $("img").length;
  const imagesMissingAlt = $("img").filter((_, element) => $(element).attr("alt") === undefined).length;
  const structuredDataBlocks = $('script[type="application/ld+json"]').length;
  const validStructured = $('script[type="application/ld+json"]').filter((_,element)=>{try{const value=JSON.parse($(element).text());const entries=Array.isArray(value)?value:[value];return entries.length>0&&entries.every(v=>v&&typeof v==='object'&&('@type' in v||'@graph' in v));}catch{return false;}}).length;
  let canonicalValid=false;let canonicalExternal=false;
  if(canonical){try{const target=new URL(canonical,url);canonicalValid=['https:','http:'].includes(target.protocol)&&!target.username&&!target.password;canonicalExternal=target.hostname!==new URL(url).hostname;}catch{/* Invalid canonical is reported for review. */}}
  const viewport = meta("viewport");
  const responsiveViewport = !!viewport && /width\s*=\s*device-width/i.test(viewport);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;

  const signals: AuditSignal[] = [
    { id: "index", name: "Indexing directives", status: noindex ? "issue" : "pass", detail: noindex ? "An indexing restriction (noindex or none) was detected." : "No noindex directive was detected in the page response.", recommendation: "Confirm whether this page should appear in search results." },
    { id: "title", name: "Page title", status: title ? (title.length >= 30 && title.length <= 65 ? "pass" : "warning") : "issue", detail: title ? "Title detected (" + title.length + " characters)." : "No HTML page title detected.", recommendation: "Write a descriptive, unique title matching the page's search intent." },
    { id: "description", name: "Meta description", status: description ? "pass" : "warning", detail: description ? "Meta description detected." : "Meta description is missing.", recommendation: "Write a useful description of the page and its value proposition." },
    { id: "headings", name: "Primary heading", status: h1Count === 1 ? "pass" : "warning", detail: h1Count + " H1 headings found.", recommendation: "Use one clear primary H1 heading describing the page." },
    { id: "canonical", name: "Canonical URL", status: canonicalValid && !canonicalExternal ? "pass" : "warning", detail: !canonical ? "Canonical link tag was not found." : !canonicalValid ? "Canonical is not a valid HTTP(S) URL." : canonicalExternal ? "Canonical points to another hostname. Confirm this is intentional." : "A valid same-host canonical URL was declared. Its destination is not verified.", recommendation: "Confirm that the preferred canonical URL is declared correctly." },
    { id: "structured", name: "Structured data", status: structuredDataBlocks > 0 && validStructured === structuredDataBlocks ? "pass" : "warning", detail: validStructured + " of " + structuredDataBlocks + " JSON-LD blocks contain parseable typed data. Schema validity is not verified.", recommendation: "Use accurate, relevant structured data where appropriate." },
    { id: "images", name: "Image alternative text", status: imagesMissingAlt === 0 ? "pass" : "warning", detail: imagesMissingAlt + " of " + imageCount + " images lack an alt attribute. Empty alt attributes are allowed for decorative images.", recommendation: "Write meaningful alt text for informative images and use empty alt for decorative images." },
    { id: "mobile", name: "Mobile viewport", status: responsiveViewport ? "pass" : "warning", detail: responsiveViewport ? "Responsive device-width viewport declared." : viewport ? "Viewport does not declare width=device-width." : "No viewport meta tag found.", recommendation: "Set an appropriate responsive viewport." },
    { id: "social", name: "Social sharing metadata", status: ogTitle ? "pass" : "warning", detail: ogTitle ? "Open Graph title detected." : "Open Graph title not found.", recommendation: "Configure appropriate Open Graph metadata for shared links." }
  ];
  // Limited technical snapshot; not an SEO, AI recommendation or revenue forecast.
  const weights: Record<SignalStatus, number> = { pass: 1, warning: 0.5, issue: 0 };
  const technicalScore = Math.round(signals.reduce((sum, signal) => sum + weights[signal.status], 0) / signals.length * 100);
  return {
    url,
    inspection:inspectSite(url,html),
    inspectedAt: new Date().toISOString(),
    title,
    description,
    canonical,
    language,
    headingOneCount: h1Count,
    headingTwoCount: h2Count,
    imageCount,
    imagesMissingAlt,
    structuredDataBlocks,
    technicalScore,
    signals,
    limitations: [
      "Only the retrieved HTML response is assessed; rendered JavaScript content may not be included.",
      "This assessment does not verify search indexing, rankings, page speed, backlinks or AI citations.",
      "Technical score reflects nine transparent page signals and does not predict search performance."
    ]
  };
}
