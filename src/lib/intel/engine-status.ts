/**
 * Engine availability reflects demonstrated functionality and verified data connections.
 * "live" means the end-to-end workflow runs on public or user-supplied evidence today;
 * "partial" means part of the engine runs and the rest depends on a named connection;
 * "connection" means no evidence can be shown until a source is connected.
 */
export type EngineAvailability = { status: "live" | "partial" | "connection"; label: string; operational: string; dependency: string };
export const engineStatus: Record<number, EngineAvailability> = {
  1: { status: "partial", label: "ON-PAGE LIVE · GSC FOR RANKINGS", operational: "Keyword relevance, title/H1 focus, cannibalisation risk and keyword gaps from the crawl; imported Search Console analysis in Measurements.", dependency: "Rankings, impressions and clicks require an authorised Search Console connection." },
  2: { status: "connection", label: "REQUIRES GA4 OR CRM", operational: "Upside scenarios and channel outcomes run when Search Console or GA4 data is connected.", dependency: "Conversions, leads, revenue, CAC and ROAS require GA4, CRM or advertising data." },
  3: { status: "live", label: "CRAWL INTELLIGENCE LIVE", operational: "Robots-respecting multi-page crawl, architecture, indexability, redirects, broken links, sitemaps, performance (PageSpeed) and accessibility basics.", dependency: "JavaScript-dependent pages are detected and flagged; executing them requires a configured rendering service (VISTA_RENDER_ENDPOINT)." },
  4: { status: "live", label: "CONTENT INTELLIGENCE LIVE", operational: "Content inventory, topic clusters, intent mapping, duplication, GEO readiness, gaps, briefs and editorial calendar.", dependency: "Engagement metrics require GA4." },
  5: { status: "partial", label: "ENTITY LIVE · BACKLINKS NEED PROVIDER", operational: "Organisation entity, sameAs profiles, authors, citation network and trust signals from the crawl.", dependency: "Backlinks and referring domains require a licensed provider." },
  6: { status: "connection", label: "SOURCE NOT CONNECTED", operational: "Self-declared review ratings and manual evidence only.", dependency: "Media coverage, mentions, sentiment and reviews require a monitoring provider." },
  7: { status: "live", label: "PORTFOLIO AND REPORTING LIVE", operational: "Multi-client portfolio, owners, interventions, decision history and white-label executive reports.", dependency: "Shared team workspaces require the organisation cloud checkpoint." },
  8: { status: "partial", label: "IMPORTS LIVE · CONNECTORS PENDING", operational: "Imported GSC/GA4 reports with comparisons; connected Search Console and GA4 retrieval for authorised owners.", dependency: "Live connectors must pass an authorised test before data is shown." },
  9: { status: "partial", label: "MANUAL + AUTHORISED API", operational: "Prompt banks, verified manual observations, transparent metrics with intervals and the GEO Opportunity Map; OpenAI API sampling for authorised owners.", dependency: "Consumer AI products have no public API and are captured manually." },
};
