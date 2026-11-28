# VisTa Intelligence Platform — SEO & GEO Studio, Intelligence Pulse and Executive Studio

This release adds a multi-stage website intelligence engine, an integrated SEO & GEO Studio, a strategic cockpit, Decision Room analytics, evidence-grounded VisTa BoT answers and an Executive Studio that generates PowerPoint, PDF and Excel deliverables. Everything below describes behaviour that has been demonstrated in automated tests and browser journeys; dependencies that need credentials or subscriptions are listed separately.

## Workflow

Enter a website → Intelligent Discovery recommends the complete scope → review, edit and approve → launch → process evidence → findings → decisions → executive report → re-run to track improvement. The manual brief remains available as *Custom Investigation (advanced)*.

## Intelligent Discovery

The Brief tab opens on **Intelligent Discovery (recommended)**. The website address is the only required input; a client record is created automatically and named after the discovered brand. Eight Intelligence Pulse stages run as bounded, checkpointed requests (progress counts completed units; cancel and resume keep finished stages):

| Stage | Work | Evidence |
|---|---|---|
| 1 Identifying the business | Home page, robots.txt, sitemaps, then a representative sample of up to 16 pages (navigation, calls to action, trust pages and one or two URLs per sitemap section) | Observed |
| 2 Mapping products and services | Structured data entities (Product, Service, Course…), H1s of offering pages, navigation and sitemap slugs; then one optional AI interpretation of the sampled pages | Observed; AI interpretation kept only when it cites fetched pages and its wording appears there |
| 3 Understanding target audiences | Audience nouns in context ("international students", "small businesses"), markets from structured-data addresses and areaServed, dialling codes, currencies, place names and the domain | Inferences with page evidence |
| 4 Discovering market competitors | AI web search candidates (commercial), search-provider results (organic), then every website is fetched and compared with the client's offering vocabulary, markets and audiences | Measured overlap (matched terms / total); unreachable or non-overlapping sites are never recommended |
| 5 Building keyword intelligence | Offerings, entities, headings, navigation, question headings, competitor gaps, AI industry vocabulary, Search Console (connected owners) and provider metrics | Volumes, difficulty, CPC and rankings only from Search Console or a provider |
| 6 Generating GEO search prompts | 30–50 prompts in 11 categories, prioritised by commercial relevance; a configurable sample (0–8) of real AI answers | Sampled answers are stored as API observations and carried into the investigation |
| 7 Identifying priority pages | Navigation, sitemap, page types, internal links, call-to-action targets, structured data; Search Console page traffic when connected | Measured |
| 8 Recommending investigation scope | Tier, page budget, crawl depth, link checks, competitor pages, PageSpeed templates, AI prompt budget, JavaScript rendering, data sources, resources and cost | Transparent rules shown as rationale |

Every recommendation shows its basis (*Stated*, *Inference*, *AI interpretation*, *Measured*, *First-party*, *Provider data* or *Added by you*), a confidence level and links to its evidence, and can be accepted, edited, excluded or replaced. *Accept all recommendations*, *Regenerate* (from any stage), *Edit in custom form* and *Launch investigation* are available once the scope is ready. Accepted recommendations flow into the existing pipeline: brand, aliases, industry, markets, audiences, offerings, objectives, up to ten competitors, the top 25 keywords, the approved prompt bank (which then drives AI sampling), priority pages as crawl seeds, the recommended depth and budgets. Eight discovery visuals are drawn from the same evidence: competitive positioning matrix, competitor relationship network, products and services treemap, commercial opportunity profile, keyword cluster map, search intent distribution, AI prompt category heatmap and website architecture.

**VisTa BoT** recognises requests such as "Investigate example.com" and starts Intelligent Discovery for that website; "launch the investigation" launches the recommended scope.

**Safeguards.** AI-assisted discovery is controlled by `VISTA_DISCOVERY_AI` (`public`, `members` or `off`), a per-connection daily allowance (10 profile and competitor calls, 48 answer samples; higher for signed-in members) and a deployment-wide daily budget (`VISTA_DISCOVERY_DAILY_AI_CALLS`, default 400). Sampled AI questions are rendered on the server from fixed templates with validated plain-text slots, so the endpoint cannot be used as a general AI proxy. Model output uses a strict JSON schema with bounded tokens and is sanitised. Competitor websites are fetched through the same SSRF-protected crawler. Without AI assistance or a search provider, discovery still profiles the business, builds keywords, prompts, priority pages and scope from website evidence, and states that competitors must be added manually.

**Search data providers.** `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` add search volume, CPC, competition, keyword difficulty, live Google rankings and organic competitors; `BRAVE_SEARCH_API_KEY` adds live results only. With neither configured, these fields read *Not measured*.

## Investigation pipeline

Create client → brief → discover pages → process evidence → SEO findings → GEO visibility → competitor benchmark → investigate → prioritise interventions → executive report → export → re-run to track improvement.

- **Studio** (`#studio`, first item in the navigation). Tabs: Brief, Cockpit, Technical SEO, Content, Authority & trust, Competitors, GEO & AI search, Search & analytics, Findings, Decision Room, Executive Studio, Portfolio. Routes are shareable (`#studio/technical`).
- **Assessment types.** *Prospect intelligence* uses public data only. *Connected client intelligence* additionally retrieves authorised Search Console and GA4 data through the existing owner-only provider integration.
- **Audit modes.** Quick Scan (25 pages, 60 link checks, 3 competitor pages each), Deep Intelligence (250 pages, 400 links, 6 competitor pages), Enterprise Investigation (5,000 pages, 2,000 links, 12 competitor pages; signed-in members only — anonymous visitors are capped at the Deep limit). Page, link, PageSpeed and AI prompt budgets are configurable in the brief, and the tier ceilings can be changed with `NEXT_PUBLIC_VISTA_MAX_PAGES_QUICK`, `NEXT_PUBLIC_VISTA_MAX_PAGES_DEEP` and `NEXT_PUBLIC_VISTA_MAX_PAGES_ENTERPRISE`.
- **Priority page URLs** (optional, same site) seed the crawl alongside the home page, sitemaps and navigation; they are used when the home page itself cannot be retrieved.
- **Command Centre** shows the integrated cockpit for the active client. **Engine pages** (`#engines/1…9`) show engine-specific dashboards from the latest investigation.

## Processing architecture (Intelligence Pulse)

Investigations are orchestrated in the browser and persisted to IndexedDB after every unit of work, so they survive reloads, cancellation and failures and resume where they stopped. Each server request is bounded for serverless limits.

| Stage | Work | Progress unit |
|---|---|---|
| 01 Connectivity | `POST /api/intel/discover` fetches the home page, robots.txt and declared sitemaps | indeterminate → 1 |
| 02 Architecture | robots.txt (RFC 9309), XML sitemaps / sitemap indexes, priority URLs and (connected clients) the Search Console page inventory | sitemaps |
| 03 Crawl | breadth-first batches of up to six URLs via `POST /api/intel/pages` (robots and Crawl-delay enforced server-side, three concurrent fetches, 45-second request deadline) | pages of the budget |
| 04 Technical | link destinations (`/api/intel/links`) and PageSpeed Insights (`/api/intel/performance`) | links + tests |
| 05–06 Content, authority | computed from crawled evidence | pages |
| 07 Competitors | discovery + equal page samples | competitor pages |
| 08 AI visibility | `POST /api/intel/ai-sample` (authorised owners only) | prompts |
| 09 Commercial | Search Console + GA4 for connected clients | sources |
| 10–12 Recommendations, dashboards, report content | computed | 1 each |

The Pulse reports discovered, queued, processed, successful, failed and robots-restricted page counts alongside the stage and elapsed time. Percentages are derived only from completed units; stages whose totals are unknown show an indeterminate stream. Rate-limit responses pause and resume automatically. Source failures are explained in plain language and marked retryable where appropriate. Cancel, resume and retry-from-failed-stage are supported. The Executive Studio uses the same Pulse for file generation (charts rendered, pages composed).

### Resilience and partial investigations

- **A failed home page does not end the investigation.** If the home page is oversized, times out or errors, Connectivity is marked *partial* with the exact reason and the crawl continues from robots.txt sitemap declarations, `/sitemap.xml`, sitemap indexes, priority URLs and the Search Console page inventory. The investigation fails only when no alternative entry point exists or robots.txt refuses access.
- **Frontier.** URLs are normalised and de-duplicated in a keyed queue (cap 20,000), canonical targets are enqueued, depth is tracked, and each request is a bounded unit, so an Enterprise crawl is many small checkpointed requests, never one long serverless call.
- **Retries.** Timeouts, connection resets, HTTP 429 and 5xx are retried once inside the request (honouring `Retry-After` up to five seconds) and re-queued once by the runner. Permanent failures (robots exclusions, invalid or private addresses, unsupported types, resource-policy limits, 4xx) are recorded with their category and not retried.
- **Partial status.** When any evidence is missing — home page not analysed, failed pages, robots exclusions, discovered URLs left unvisited by the page budget, truncated documents or unavailable sources such as PageSpeed — the job ends as **Partially complete**, counts the gaps in the Pulse, lists them in a Cockpit banner (other Studio tabs carry a *Partially complete* notice), and states the limitation on report covers and summaries and in the Excel workbook summary. A partial investigation is never presented as a complete audit. **Retry N failed pages** re-queues only the retryable failures and recomputes the dependent stages.
- **Storage.** IndexedDB v2 keeps investigation summaries and pages in separate stores and writes pages incrementally, so large crawls checkpoint without rewriting the whole record. Investigations stored by earlier versions remain readable.

### Crawler resource policy

Every fetch is streamed with separate limits for bytes on the wire and bytes after decompression, so large pages are processed instead of rejected and compressed payloads cannot expand without bound.

| Setting | Default | Variable |
|---|---|---|
| Retained HTML per page | 10 MB | `VISTA_CRAWL_MAX_HTML_MB` |
| Transfer (compressed) limit | 15 MB | `VISTA_CRAWL_MAX_TRANSFER_MB` |
| Decompressed limit | 60 MB | `VISTA_CRAWL_MAX_DECODED_MB` |
| Decompression ratio guard (above 8 MB decoded) | 120× | `VISTA_CRAWL_MAX_COMPRESSION_RATIO` |
| Request timeout | 15 s | `VISTA_CRAWL_TIMEOUT_MS` |
| Transient retries | 1 | `VISTA_CRAWL_RETRIES` |

- gzip, deflate and Brotli are decoded in a stream; unsupported encodings (for example zstd) are reported as a decode failure. Declared `Content-Length` above the transfer limit is refused before download.
- **Selective extraction:** while streaming, inline script, style, SVG and template bodies, comments and long `data:` URIs are discarded; JSON-LD structured data (up to 1 MB per block), headings, links, metadata and visible text are kept. Documents larger than the retained limit are analysed from their first 10 MB and marked *truncated*. The original decoded size and inline-script weight are still measured, and pages over 1 MB of HTML raise an *HTML weight* finding.
- **JavaScript-dependent pages** (thin text with an empty application root, heavy script payloads or a "enable JavaScript" fallback) are flagged. When `VISTA_RENDER_ENDPOINT` (and optionally `VISTA_RENDER_TOKEN`) point at a Browserless-compatible `/content` service, up to two such pages per request and twenty per investigation can be rendered; the option appears in the brief only when the service is configured (`GET /api/intel/capabilities`).
- The single-page audit (`/api/audit`) uses the same policy, so the former 1 MB limit no longer applies there either.

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

Public intelligence endpoints require same-origin requests, bounded JSON bodies and per-IP rate limits (durable when Upstash is configured). The crawler validates every hop: public hostnames only, default ports, no credentials, DNS answers checked against private/reserved ranges and pinned, transfer, decompressed and ratio limits, time limits, redirect limits and loop detection. robots.txt and Crawl-delay are honoured (5xx robots.txt pauses crawling). Signed-in members receive a higher page-request allowance (3,000 per ten minutes, versus 600 anonymously); the rendering service, when configured, is only given URLs that have passed the same validation. AI sampling requires an authenticated organisation owner of the authorised organisation. `VISTA_TEST_CRAWL_ORIGINS` exists only for local fixture testing and is ignored on Vercel.

## Engine availability

| Engine | Status | Demonstrated | Dependency |
|---|---|---|---|
| 1 Search Visibility | Partial | Keyword focus, gaps, cannibalisation risk; GSC analysis when connected or imported | Authorised Search Console |
| 2 Impact Intelligence | Connection required | Upside scenarios and channel outcomes when data is connected | GA4, CRM or advertising data |
| 3 Site Intelligence | Live | Multi-page crawl to 5,000 pages, large-page resource policy, discovery fallback, technical diagnostics | JavaScript execution needs a configured rendering service |
| 4 Content Studio | Live | Inventory, clusters, intent, GEO readiness, gaps, briefs, calendar | GA4 for engagement |
| 5 Authority Graph | Partial | Entity, sameAs, authors, citation network, trust | Licensed backlink provider |
| 6 Reputation Intelligence | Connection required | Self-declared ratings only | Media/review monitoring provider |
| 7 Agency Operations | Live | Portfolio, owners, decisions, white-label reports | Cloud checkpoint for shared team workspaces |
| 8 Analytics Intelligence | Partial | CSV imports; connected GSC/GA4 for authorised owners | Live connector verification |
| 9 AI Exposure / GEO | Partial | Prompt banks, manual evidence, metrics, opportunity map; OpenAI API sampling for authorised owners | Consumer AI products have no public API |

## External dependencies not yet active

- Google Search Console and GA4 live retrieval require a successful authorised owner test in production (credentials are configured; live access is not verified by this release).
- OpenAI API sampling requires an authorised owner session and a funded API key; consumer ChatGPT, Google AI Overviews / AI Mode, Gemini, Perplexity, Claude and Copilot are captured manually.
- Search volume, keyword difficulty, CPC, rankings and organic competitors require a search data provider (DataForSEO, or Brave Search for live results only); none is configured.
- PageSpeed Insights works without a key at Google's shared quota, which is regularly exhausted in production; set `PAGESPEED_API_KEY` for reliable volume (without it, investigations end as *partially complete* with the performance gap stated).
- JavaScript rendering requires a Browserless-compatible service (`VISTA_RENDER_ENDPOINT`, `VISTA_RENDER_TOKEN`); none is configured, so JavaScript-dependent pages are detected and flagged but not executed.
- Keyword volumes, rankings for non-owned sites, backlinks, Google Ads, Bing Webmaster Tools, Merchant Center, CRM beyond HubSpot samples and media monitoring need provider subscriptions and credentials.

## Verification

- Unit and integration tests: robots and sitemap parsing, SSRF validation, redirect chains/loops, resource policy (1, 5 and 12 MB pages; gzip, deflate and Brotli; truncation above 10 MB; decompression bombs; declared oversize; corrupt and unsupported encodings; slow, flaky, reset and 503 servers), selective extraction, home-page failure with sitemap fallback, transient retry and targeted retry of failed pages, type limits, robots enforcement, page and site analysis, findings, index coverage gating, GEO metrics and intervals, interventions, roadmap and scenarios, resumable runner (cancel/resume without re-fetching, 429 recovery), connected-client and failed-provider paths, BoT evidence safety.
- `scripts/discovery-acceptance.mjs` runs Intelligent Discovery from a website address only (laboratory training, ecommerce, professional services and JavaScript application fixtures), edits, accepts, regenerates and launches into the investigation, checks the BoT entry and both themes at three widths, against a simulated OpenAI endpoint that deliberately returns an ungrounded offering (which must be rejected). `scripts/intel-fixtures.mjs` serves ecommerce, professional services, corporate training, complex multi-page, robots-restricted and competitor fixture sites, plus a LabMedExpert-style site (6 MB compressed home page with inline state and base64 assets, a 12 MB brochure, malformed HTML, a 40-second page and a gzip bomb), a WordPress-style blog (80 MB home page and a 3,000-post sitemap index) and a JavaScript-only application shell; `scripts/intel-acceptance.mjs` drives the full UI journey, exports every file format and runs the scenarios in both themes at desktop, tablet and mobile widths.
