# VisTa Intelligence Platform — SEO & GEO Studio, Intelligence Pulse and Executive Studio

This release adds a multi-stage website intelligence engine, an integrated SEO & GEO Studio, a strategic cockpit, Decision Room analytics, evidence-grounded VisTa BoT answers and an Executive Studio that generates PowerPoint, PDF and Excel deliverables. Everything below describes behaviour that has been demonstrated in automated tests and browser journeys; dependencies that need credentials or subscriptions are listed separately.

## Workflow

Create client → brief → discover pages → process evidence → SEO findings → GEO visibility → competitor benchmark → investigate → prioritise interventions → executive report → export → re-run to track improvement.

- **Studio** (`#studio`, first item in the navigation). Tabs: Brief, Cockpit, Technical SEO, Content, Authority & trust, Competitors, GEO & AI search, Search & analytics, Findings, Decision Room, Executive Studio, Portfolio. Routes are shareable (`#studio/technical`).
- **Assessment types.** *Prospect intelligence* uses public data only. *Connected client intelligence* additionally retrieves authorised Search Console and GA4 data through the existing owner-only provider integration.
- **Audit modes.** Quick Scan (12 pages, 40 link checks, 1 PageSpeed page, 2 competitor pages each), Deep Intelligence (50, 150, 3, 5), Enterprise Investigation (150, 400, 6, 10). Page, link, PageSpeed and AI prompt budgets are configurable in the brief.
- **Command Centre** shows the integrated cockpit for the active client. **Engine pages** (`#engines/1…9`) show engine-specific dashboards from the latest investigation.

## Processing architecture (Intelligence Pulse)

Investigations are orchestrated in the browser and persisted to IndexedDB after every unit of work, so they survive reloads, cancellation and failures and resume where they stopped. Each server request is bounded for serverless limits.

| Stage | Work | Progress unit |
|---|---|---|
| 01 Connectivity | `POST /api/intel/discover` fetches the home page | indeterminate → 1 |
| 02 Architecture | robots.txt (RFC 9309) and XML sitemaps / indexes | sitemaps |
| 03 Crawl | breadth-first batches via `POST /api/intel/pages` (robots enforced server-side) | pages of the budget |
| 04 Technical | link destinations (`/api/intel/links`) and PageSpeed Insights (`/api/intel/performance`) | links + tests |
| 05–06 Content, authority | computed from crawled evidence | pages |
| 07 Competitors | discovery + equal page samples | competitor pages |
| 08 AI visibility | `POST /api/intel/ai-sample` (authorised owners only) | prompts |
| 09 Commercial | Search Console + GA4 for connected clients | sources |
| 10–12 Recommendations, dashboards, report content | computed | 1 each |

Percentages are derived only from completed units; stages whose totals are unknown show an indeterminate stream. Rate-limit responses pause and resume automatically. Source failures are explained in plain language and marked retryable where appropriate. Cancel, resume and retry-from-failed-stage are supported. The Executive Studio uses the same Pulse for file generation (charts rendered, pages composed).

The existing Supabase job queue (`database/jobs.sql`) remains for single-page scheduled audits; it is not configured in production (`/api/cloud/jobs` reports `configured:false`), so multi-stage investigations persist on the user's device rather than in the queue.

## Technical intelligence modules

- **Architecture:** sitemap discovery and validation, robots inspection, internal link graph, click depth, hierarchy, orphan detection (only when the crawl covers enough of the sitemap inventory), broken internal and external links, redirect chains and loops, status classes, parameter URLs.
- **Indexability:** canonical conflicts (to errors, redirects, noindex or other sites), meta robots / X-Robots-Tag, sitemap conflicts, near-duplicate content (MinHash over five-word shingles), hreflang validity and reciprocity. Technical indexability is reported separately from confirmed indexing (Search Console only).
- **On-page:** titles, descriptions, H1 and heading hierarchy, target keyword focus and cannibalisation risk, images and alt text, structured data types and parse errors, Open Graph, page type and search intent.
- **Performance:** HTML indicators (render-blocking scripts, third-party hosts, HTML weight) and PageSpeed Insights with **Lighthouse lab** and **CrUX field** data kept separate (URL-level or origin-level scope stated).
- **Trust and accessibility:** HTTPS, HSTS, CSP, mixed content, contact/about/privacy/terms, telephone/address, authorship, Organization entity and sameAs, unlabelled fields, unnamed buttons, empty/vague links, language, skip links.

Each finding has an evidence identifier (`EV-<project>-<hash>`), severity, confidence, evidence class, affected locations, business implication, recommendation, effort, impact, success metric, source, collection time, methodology and limitations, plus a ten-question diagnostic dossier.

## Scoring and integrity

- **VisTa Intelligence Index:** nine dimensions (technical, search, AI, content, authority, reputation, impact, competitive, performance) with configurable weights. Each dimension declares evidence class, coverage, basis, measurement date and assumptions. The overall index is calculated only when weighted coverage ≥ 60% and is shown with a range that widens as coverage falls; otherwise it is reported as *Not calculated*.
- **Evidence classes:** directly observed, connected first-party measurement, third-party estimate, model-generated interpretation, forecast scenario, evidence unavailable.
- **GEO metrics:** mention, citation, recommendation and competitive-share rates, category coverage, source diversity and reviewed accuracy, each with numerator, sample size and Wilson 95% intervals. API observations are labelled separately from manual captures of consumer AI products.
- **Upside modelling:** produced only with Search Console data, as conservative/expected/ambitious ranges with stated assumptions; never without first-party demand data.
- **Interventions:** priority = impact × urgency × confidence ÷ effort; effort bands convert to day ranges and cost ranges using a configurable day rate; phases 30/60/90 respect dependencies (access and indexability before content and AI visibility). Decisions (approve/defer/reject) and owners are recorded.

## Visual intelligence

ECharts (SVG renderer, lazy-loaded) powers radar, Sankey, sunburst, treemap, network graphs, heatmaps, severity matrices, funnels, bullet charts, bubble and quadrant matrices, scatter plots, grouped and stacked bars, waterfall (change between investigations), calendar heatmaps and time series with interval bands. Every chart states the business question it answers, supports hover, interactive legends, drill-down (to page profiles), full-screen, an accessible data table and SVG / high-resolution PNG export. Charts are drawn only when the underlying evidence exists. A geographic map is not provided because no regional dataset is collected.

## Executive Studio

Report products: Executive Intelligence Brief, Board Strategy Presentation (18 slides plus optional appendices), SEO and GEO Diagnostic, Competitive Intelligence, Technical Remediation, Monthly Performance Review, Prospect Opportunity Assessment, Quarterly Strategic Review. Configurable audience, depth (summary omits evidence-gap slides), included engines, client branding (logo, colours), authorised white-label agency branding and photography. Outputs, generated in the browser:

- Editable **PowerPoint** with native charts where supported (bar, radar, line) and high-resolution images otherwise.
- **16:9 presentation PDF** and **A4 analytical PDF** with vector charts (svg2pdf), consistent pagination and evidence tables.
- **Excel evidence workbook** (12 sheets, written without formulas), **CSV** (formula-injection protected), **JSON**, and a **chart pack** (SVG + PNG).

## VisTa BoT

The BoT loads the latest investigation for the active client and answers strategic questions (board findings, funding priorities, competitor positioning, AI absence, visibility decline, commercial pages) from evidence with identifiers and in-app actions. Signed-in authorised users receive AI answers grounded in a compact evidence summary. Raw crawled text, page titles and AI responses are excluded from the assistant context, and the evidence block is marked as data, not instructions.

## Security controls

Public intelligence endpoints require same-origin requests, bounded JSON bodies and per-IP rate limits (durable when Upstash is configured). The crawler validates every hop: public hostnames only, default ports, no credentials, DNS answers checked against private/reserved ranges and pinned, size and time limits, redirect limits and loop detection. robots.txt is honoured (5xx robots.txt pauses crawling). AI sampling requires an authenticated organisation owner of the authorised organisation. `VISTA_TEST_CRAWL_ORIGINS` exists only for local fixture testing and is ignored on Vercel.

## Engine availability

| Engine | Status | Demonstrated | Dependency |
|---|---|---|---|
| 1 Search Visibility | Partial | Keyword focus, gaps, cannibalisation risk; GSC analysis when connected or imported | Authorised Search Console |
| 2 Impact Intelligence | Connection required | Upside scenarios and channel outcomes when data is connected | GA4, CRM or advertising data |
| 3 Site Intelligence | Live | Multi-page crawl and technical diagnostics | JavaScript rendering not executed |
| 4 Content Studio | Live | Inventory, clusters, intent, GEO readiness, gaps, briefs, calendar | GA4 for engagement |
| 5 Authority Graph | Partial | Entity, sameAs, authors, citation network, trust | Licensed backlink provider |
| 6 Reputation Intelligence | Connection required | Self-declared ratings only | Media/review monitoring provider |
| 7 Agency Operations | Live | Portfolio, owners, decisions, white-label reports | Cloud checkpoint for shared team workspaces |
| 8 Analytics Intelligence | Partial | CSV imports; connected GSC/GA4 for authorised owners | Live connector verification |
| 9 AI Exposure / GEO | Partial | Prompt banks, manual evidence, metrics, opportunity map; OpenAI API sampling for authorised owners | Consumer AI products have no public API |

## External dependencies not yet active

- Google Search Console and GA4 live retrieval require a successful authorised owner test in production (credentials are configured; live access is not verified by this release).
- OpenAI API sampling requires an authorised owner session and a funded API key; consumer ChatGPT, Google AI Overviews / AI Mode, Gemini, Perplexity, Claude and Copilot are captured manually.
- PageSpeed Insights works without a key at Google's shared quota; set `PAGESPEED_API_KEY` for reliable volume.
- Keyword volumes, rankings for non-owned sites, backlinks, Google Ads, Bing Webmaster Tools, Merchant Center, CRM beyond HubSpot samples and media monitoring need provider subscriptions and credentials.

## Verification

- Unit and integration tests: robots and sitemap parsing, SSRF validation, redirect chains/loops, size and type limits, robots enforcement, page and site analysis, findings, index coverage gating, GEO metrics and intervals, interventions, roadmap and scenarios, resumable runner (cancel/resume without re-fetching, 429 recovery), connected-client and failed-provider paths, BoT evidence safety.
- `scripts/intel-fixtures.mjs` serves ecommerce, professional services, corporate training, complex multi-page, robots-restricted and competitor fixture sites; `scripts/intel-acceptance.mjs` drives the full UI journey, exports every file format and runs the scenarios in both themes at desktop, tablet and mobile widths.
