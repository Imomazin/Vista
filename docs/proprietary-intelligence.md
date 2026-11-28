# VisTa proprietary intelligence infrastructure

**Direction (owner, 28 November 2026).** VisTa develops and owns its core intelligence infrastructure. Paid third-party intelligence subscriptions (DataForSEO, Ahrefs, Semrush, Browserless and similar) are **not purchased** and are never prerequisites for platform functionality. Their existing adapters remain optional. Activation (R1–R5) continues in parallel through official platform APIs and free developer environments. No paid service, infrastructure or advertising spend is initiated without explicit approval.

The status of each component is tracked in the [capability register](capability-register.md). This document describes the architecture, the methodology behind each indicator, and the order of delivery.

## Analytical integrity

Every value VisTa shows carries its **source**, **observation date**, **coverage** and **method**, and belongs to exactly one class:

| Class | Meaning | Examples |
|---|---|---|
| Measured | Reported by an authorised first-party or official source | Search Console clicks, impressions and positions; GA4 conversions; Google Ads Keyword Planner volumes (when authorised); PageSpeed lab results |
| Observed | Seen directly by VisTa's crawler on a stated date | A page title, a link from one page to another, a schema type, a robots.txt rule |
| Historical | Observed in an archive or an earlier VisTa crawl, with its capture date | A Common Crawl capture from CC-MAIN-2026-43; last month's VisTa crawl |
| Estimate | Calculated by a documented VisTa algorithm from observed or measured inputs | Lexicon opportunity score, Graph authority indicator, Pulse anomaly score |
| AI interpretation | Produced by a language model and checked against fetched evidence | Offering names, buyer segments, competitor research notes |
| Unavailable | Not measured, with the reason and what would provide it | Search volume without Search Console or Keyword Planner; global backlinks |

VisTa never presents an estimate as a Google search volume, a ranking, a backlink count or a commercial outcome. Opportunity scores are labelled *VisTa opportunity score (estimate)*. Authority is labelled *Observed-graph authority*, with the number of pages and domains it was computed from.

## Components

### 1. VisTa Spider (crawling)

**Exists today:** a streaming, SSRF-protected crawler with robots.txt compliance (RFC 9309), sitemap discovery, resource budgets, compression limits, retries, redirect handling, browser-side checkpointing and per-page evidence.

**Adds:**
- Controlled JavaScript rendering with open-source Playwright and an open-source Chromium build inside the existing Vercel functions. Every browser subrequest passes the same public-address and SSRF checks. Rendering is used only when the static HTML is a JavaScript shell. It respects robots.txt and has per-investigation and daily budgets.
- Content fingerprints and near-duplicate detection (SimHash over normalised text).
- Change detection against earlier observations (VisTa's own or archived).
- Persistent queues, scheduled recrawling and distributed workers. These use a Postgres queue (`database/spider.sql`, leased jobs with `FOR UPDATE SKIP LOCKED`) and a cron-invoked worker. Each worker processes bounded batches, and several invocations can run concurrently without double work. They are activated only after the owner applies the migration and sets `CRON_SECRET` and `VISTA_SUPABASE_SERVICE_ROLE_KEY`.
- Intelligent prioritisation: page value from role (offering, pricing, conversion, trust), internal-link authority (Graph), sitemap priority and change frequency, and last-changed date.

### 2. VisTa Index (observations)

A store of structured observations of websites, pages, content, entities, links, metadata, crawl dates and changes:

- **Browser index (now):** IndexedDB on the user's device, so repeat runs can be compared and history kept without a server.
- **Server index (after migration):** `database/index.sql`. Public-web observations go into a shared, deduplicated index keyed by URL and content hash. Tenant-private data (Search Console, GA4, CRM, notes) stays in organisation-scoped tables under row-level security.
- **What is stored:** derived observations only, never full copies of third-party pages. That covers status, title, meta description, headings, word count, links, schema types, a content fingerprint and short excerpts used as evidence. Personal data is not collected beyond business contact details that a site publishes. Retention: observations expire after 13 months unless a tenant pins an investigation.

**Common Crawl (selective).** VisTa supplements its own index with [Common Crawl](https://commoncrawl.org/), an open web archive, under its [Terms of Use](https://commoncrawl.org/terms-of-use):

- **Domain lookup.** VisTa binary-searches each crawl's ZipNum `cluster.idx` (about 110 MB, sorted by SURT key) with small HTTP range requests on `data.commoncrawl.org`. It then fetches the one or two compressed index blocks that hold the domain. This avoids depending on the public index server.
- **Archived pages.** Individual archived pages are fetched as single WARC records by byte range and parsed with the same page analyser as live pages.
- **Bounds.** Domain-level and sector-level only: at most three recent crawls, 500 captures per domain per crawl, and 20 archived page fetches per investigation. VisTa never bulk-ingests the corpus.
- **What it provides.** Historical comparison (capture date against live), page inventory beyond sitemaps, first-seen dates, and outbound links from archived pages for the Graph.
- **Limits.** Common Crawl does not provide a reverse link index, so VisTa cannot list global backlinks from it. The Graph discloses this.

### 3. VisTa Lexicon (keyword intelligence)

**Inputs:** website content and headings, structured-data entities, the offering taxonomy, competitor pages, Search Console queries (when connected), Google Ads Keyword Planner (when authorised), and earlier observations.

- **Intent classification:** transactional, commercial, informational, navigational and local, using documented lexical rules plus the business model.
- **Semantic clusters:** keywords are grouped by shared core terms (modifiers such as *best*, *near me*, market and cost words are removed; light stemming is applied). Each cluster is named by its most frequent core phrase.
- **Topic relationships:** clusters are linked when they share core terms or co-occur on the same client or competitor pages, and the reason is shown.
- **Page mapping:** each keyword is matched to the client page that targets it best (title, H1, H2, URL slug and body coverage), or marked as a content gap.
- **Long-tail opportunities:** specific phrases (three or more words, or qualified by market, place or intent) that are relevant to the offering but not yet targeted. Sources include competitor question headings and, when connected, Search Console queries with impressions outside the top ten.
- **History:** each discovery stores its lexicon, so new, lost and re-scored keywords are shown between runs.

**VisTa opportunity score (estimate, 0–100).** The score is deterministic: the same inputs give the same score. It is shown with its factor breakdown:

| Factor | Points | Basis |
|---|---|---|
| Relevance to the client's offer | up to 30 | Observed: strength and number of independent sources on the client's own site |
| Commercial intent | up to 20 | Estimate: intent class weighted by the business model |
| Competitor use | up to 15 | Observed: share of verified competitors whose sampled pages use the phrase |
| Coverage gap | up to 20 | Observed: no page targets it (full), mentioned only in body text (half), already targeted (none); scaled by relevance |
| Specificity | up to 15 | Estimate: long-tail and qualified phrases are easier to win |
| Search Console demand | up to +15 | Measured (only when connected): impressions, plus positions 4–20 ("striking distance") |

Search volumes, CPC and rankings appear only when measured by Search Console, an authorised Keyword Planner connection, or an optional provider adapter. Otherwise they read *Unavailable*, with the reason.

### 4. VisTa Graph (authority and relationships)

**Nodes:** pages, domains, organisations, authors, topics. **Edges:** observed links (internal and external) with the source page and observation date, citations in sampled AI answers, `sameAs` and organisation relationships from structured data, and accreditation or partner links.

**Indicators (estimates, with documented methodology):**
- **Internal link authority:** PageRank (damping 0.85, 50 iterations or convergence) over the client's crawled pages. It identifies orphaned and weakly linked priority pages.
- **Observed referring domains:** domains in VisTa's observed set (competitor pages, cited sources, archived captures) that link to the client.
- **Observed-graph authority:** PageRank over the bounded domain graph assembled for the investigation, normalised to 0–100 within that graph.
- **Co-citation:** organisations cited or linked alongside the client and its competitors (sector authorities, accreditation bodies).

**Coverage disclosure.** Every Graph view states the pages and domains observed and the date range. It also states: *"Observed links only. This is not a global backlink index."*

### 5. VisTa Pulse (monitoring)

Baselines and anomaly detection over observation histories:
- **Changes:** website and competitor changes (titles, headings, content fingerprints, status, canonical, robots), technical deterioration, and content decay (word count, freshness, internal links).
- **Measured signals:** Search Console clicks, impressions and positions; GA4 conversions; AI citation and mention rates across repeated samples; reputation signals from authorised sources; campaign performance (R3).

**Method:** a rolling median baseline with median absolute deviation (MAD). A robust z-score of 3.5 or more flags an anomaly. Metrics with too few observations report *insufficient history* rather than an alert. Scheduling uses the Spider queue and cron worker; until those are configured, Pulse compares observations when a run is opened.

### 6. VisTa Activate (R1–R5, retained)

R1–R5 keep all activation requirements, delivered through direct official API connections in their free developer environments:
- **Search and analytics:** Google Search Console, GA4 and Google Ads.
- **CRM:** HubSpot.
- **Websites and code:** WordPress, Shopify and GitHub.
- **Social and video:** Facebook and Instagram (Meta), LinkedIn, TikTok and YouTube.
- **Advertising:** Microsoft Advertising.

Each provider has a setup contract with the official setup URL, app type, the exact implemented redirect URI, scopes, environment variables, eligibility, test-account requirements and expected costs. Website remediation, publishing, CRM writes and campaign changes require explicit approval and leave action receipts. Campaigns are created paused. No advertising spend or paid subscription starts without explicit approval.

### 7. Cost architecture

Priorities, in order:
1. Open-source software: Playwright, Chromium and Postgres.
2. Existing Vercel and Supabase infrastructure.
3. Free authorised APIs: Search Console, GA4, PageSpeed, CrUX, platform APIs.
4. Open datasets: Common Crawl.
5. Proprietary algorithms.
6. Efficient caching, incremental crawling and deduplicated storage.
7. A shared public-data index, with tenant-isolated private data.

**Language models.** OpenAI stays a configurable integration (`VISTA_DISCOVERY_AI`). The AI layer accepts any OpenAI-compatible endpoint, so a self-hosted open-weight model served by vLLM, Ollama or llama.cpp (for example Llama, Qwen or Mistral families, under their licences) can take over workloads that need no web search: interpretation, extraction and classification. Self-hosting needs GPU or large-memory compute, which is paid infrastructure and needs approval first. Competitor research that depends on live web search stays on the configured provider until VisTa's own index can serve it.

## Acceptance gate: proprietary search intelligence

This gate replaces the live DataForSEO gate. On production, for **LabMedExpert, Ambidexters and imoenang.com**, with no paid intelligence provider configured:

1. **Lexicon:** every keyword shows its sources, intent, cluster, target page or content gap, and a VisTa opportunity score with its factor breakdown. No search volume, CPC or ranking is shown unless measured.
2. **Graph:** internal link authority for the client's pages; observed links between the client, its competitors and cited sources, with dates; observed-graph authority with methodology and a coverage statement.
3. **Index:** page observations with crawl dates and content fingerprints; Common Crawl capture history for the domain; and a historical comparison of archived and live versions of priority pages.
4. **Integrity:** every value is labelled measured, observed, historical, estimate, AI interpretation or unavailable, with its source and date.
5. **Repeatability:** two runs on the same evidence give identical Lexicon and Graph scores. AI-derived inputs are labelled.

## Owner actions (no purchases)

- **Apply the migrations** `database/index.sql` and `database/spider.sql` in the Supabase SQL editor (preview first). Then set `VISTA_SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` (32 or more characters) in Vercel to enable the server index, persistent queues and scheduled recrawling.
- **For R1 and beyond:** create the free Google Cloud OAuth client and the HubSpot developer app described in the provider setup contracts.
