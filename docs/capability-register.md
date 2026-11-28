# VisTa capability register

Maintained under the *Enterprise Intelligence and Activation* brief. Each capability records its status, the evidence behind that status, and the dependency that blocks the next step. A configured key does not prove a working API, and a deployed page does not prove a working feature.

**Status values:** *Live-tested* (exercised against the real provider or site in production, with evidence) · *Deployed* (in production, not yet live-tested end to end) · *Fixture-tested* (verified against fixtures or simulated providers only) · *Implemented* (code exists, not verified) · *Blocked* (needs an owner or provider action) · *Not started*.

Last updated: 28 November 2026 (production `vista.ambidexters.com`).

## Register

| Capability | Engine | Status | Evidence | Next dependency |
|---|---|---|---|---|
| Public website crawl, streaming resource policy, robots.txt | 3 | Live-tested | LabMedExpert Deep investigation: 101 pages analysed, 8 failed, 50 robots-restricted, pages up to 6 MB (28 Nov 2026) | — |
| Intelligent Discovery from a URL (profile, segments, competitors, keywords, prompts, priority pages, scope) | 1, 4, 5, 9 | Live-tested | Six live sites (LabMedExpert, Ambidexters, Imoenang, Allbirds UK, Grant Thornton UK, Excalidraw), 28 Nov 2026; fixture acceptance `scripts/discovery-acceptance.mjs` | R0 quality changes (PR 30) to be re-verified live |
| Competitor verification (retrieval, identity, relevance; service and cited pages) | 1, 5 | Fixture-tested | Unit tests `intel-discovery.test.ts` | Live re-verification after PR 30 |
| AI-assisted profiling and competitor research (OpenAI Responses API, web search) | 9 | Live-tested | Live runs above; budgets `VISTA_DISCOVERY_AI`, `VISTA_DISCOVERY_DAILY_AI_CALLS` | Per-tenant usage ledger (R5) |
| GEO answer sampling (API surface, template prompts) | 9 | Live-tested | LabMedExpert: brand mentioned in 3 of 4 sampled answers, citations recorded | Versioned prompt panels and repeated observations (R4) |
| Keyword volume, difficulty, CPC, SERP rankings, organic competitors (DataForSEO) | 1 | Fixture-tested | Adapter tests with recorded response shapes | **Blocked:** DataForSEO account and credentials (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`) |
| Live web results (Brave Search) | 1 | Fixture-tested | Adapter tests | Optional: `BRAVE_SEARCH_API_KEY` |
| PageSpeed Insights (mobile/desktop) | 3 | Live-tested | 28 Nov 2026, production: ambidexters.com desktop returned a lab result in 18 s (score 100, LCP 0.61 s, Lighthouse 13.6.0). labmedexpert.com: Google's Lighthouse returned "Something went wrong" for the home and contact pages (mobile, 65–81 s) and the desktop home test exceeded 110 s; the investigation reports this provider error as an evidence gap. Route allows 120 s (accepted by the Vercel plan). | Site-specific: Lighthouse cannot complete on labmedexpert.com; retest later or with a rendering service |
| Chrome UX Report API | 3 | Not started | PageSpeed responses include CrUX field data where available | Separate CrUX key if needed |
| JavaScript rendering | 3 | Implemented | `src/lib/intel/render.ts` (Browserless-compatible) | **Blocked:** rendering service (`VISTA_RENDER_ENDPOINT`, `VISTA_RENDER_TOKEN`) |
| Search Console (single property, service account) | 1, 8 | Implemented | Owner-only routes; configured flag true | Live owner test; **tenant OAuth (R1) not started**: Google OAuth client and consent screen |
| Search Console sitemap submission and URL Inspection | 3 | Not started | — | Tenant OAuth (R1) |
| GA4 reporting (service account) | 2, 8 | Implemented | Owner-only routes | Live owner test; tenant OAuth (R2) |
| HubSpot (shared, read-only) | 2 | Implemented | Owner-only sample read | **Tenant OAuth and write (R2) not started:** HubSpot developer account and public app |
| CMS remediation: WordPress, Shopify, GitHub/Vercel PR | 3, 4 | Not started | — | **Blocked:** owned test site and credentials; GitHub App access to the target repository |
| Paid campaigns: Google Ads, Meta, LinkedIn, Microsoft, TikTok, YouTube | 2, 7 | Not started | — | **Blocked:** developer access, app review and business verification, test ad accounts (see matrix) |
| Organic social publishing | 4 | Not started | — | Platform app approvals and eligible owned accounts |
| Stripe subscriptions and metered usage | — | Not started | — | Stripe account, products, prices and webhook secret |
| Durable workers for unattended jobs | all | Partial | Investigations checkpoint in the browser; Supabase job queue exists for single-page audits but is not configured | Durable queue/worker (e.g. Supabase queue + Vercel cron or a worker service) |
| Multi-tenant model, RLS, roles and approvals | all | Partial | Supabase organisations and memberships for workspace sync | Domain model and migrations for connections, interventions, approvals and receipts (R1–R2) |
| Usage and cost ledger | — | Partial | DataForSEO request cost logged; AI budgets enforced per connection and per deployment | Ledger with reserved, consumed and reconciled units (R5) |
| Executive Studio (PPTX, 16:9 PDF, A4 PDF, Excel, CSV, JSON, charts) | 7 | Live-tested | Exports generated and inspected in earlier releases | Frozen investigation snapshots, action receipts (R4–R5) |
| VisTa BoT: conversational discovery and launch | all | Fixture-tested | `scripts/discovery-acceptance.mjs` BoT step | Draft actions with approvals (R1+) |

## Provider procurement matrix

Prices change; confirm each figure on the official page before purchase. Third-party summaries were used only to estimate orders of magnitude. **No purchase or commitment is made without the owner's explicit approval.**

| Provider | Priority | Purpose | Plan and pricing (verify) | Indicative marginal cost | Approvals and setup |
|---|---|---|---|---|---|
| DataForSEO ([pricing](https://dataforseo.com/pricing), [docs](https://docs.dataforseo.com/)) | P0 | Keyword volume, CPC, difficulty, Google SERP snapshots, rankings, backlinks | Pay-as-you-go after a minimum top-up (reported as $50); per-task prices differ by queue (Standard, Priority, Live) | Discovery: about 6 live SERPs plus one volume and one difficulty request, roughly $0.05–0.15 per discovery at reported rates | Owner creates the account, tops up, and sets `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` in Vercel |
| OpenAI ([pricing](https://openai.com/api/pricing/)) | P0 | Grounded profiling, competitor research, GEO sampling | Token pricing per model; web search tool billed per 1,000 calls (reported $10 per 1,000) plus search content tokens | Discovery: about 7 calls including 6 web-search calls, roughly $0.07–0.15 | Already configured; set an organisation spend limit in the OpenAI console |
| Google PageSpeed Insights ([get started](https://developers.google.com/speed/docs/insights/v5/get-started)) | P0 | Lab and field performance | Free with an API key, subject to quota | None beyond quota | Key configured; verify quota in Google Cloud |
| Chrome UX Report ([API](https://developer.chrome.com/docs/crux/api/)) | P1 | Origin and URL field data | Free with an API key | None | Optional key |
| Browserless ([pricing](https://www.browserless.io/pricing)) | P1 | JavaScript rendering | Unit-based; free tier of 1,000 units a month; paid tiers billed monthly or annually | Roughly one unit per rendered page (up to 30 s) | Owner account; set `VISTA_RENDER_ENDPOINT`, `VISTA_RENDER_TOKEN` and a spend limit |
| Google Ads API ([access levels](https://developers.google.com/google-ads/api/docs/access-levels)) | P0–P1 | Paused campaign creation, reporting | No API fee; access tied to a Google Cloud project with brand verification (Explorer, Basic, Standard) | Media spend only, when authorised | Google Cloud project, brand verification, access application, test account |
| Meta Marketing API ([docs](https://developers.facebook.com/documentation/ads-commerce/marketing-api)) | P1 | Campaigns, ad sets, creatives, insights | No API fee; app review and business verification for advanced access | Media spend only | Meta business portfolio, app, review |
| LinkedIn Advertising API ([tiers](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/marketing-tiers)) | P1 | Campaign groups, campaigns, analytics | No API fee; Development tier then Standard tier approval | Media spend only | LinkedIn developer app and access request |
| HubSpot ([developers](https://developers.hubspot.com/)) | P0–P1 | Tenant CRM read/write, tasks, deals | Developer account free; customer plan determines available APIs | None | Public app with OAuth scopes, redirect URL, optional marketplace review |
| Stripe ([pricing](https://stripe.com/pricing)) | P1 | Subscriptions, metered usage | Per-transaction fees; Billing fees apply to subscriptions | Percentage of revenue | Stripe account, products, webhook endpoint |
| Microsoft Advertising, TikTok, YouTube, listening providers | P2 | Additional channels and monitoring | See the provider reference register in the brief | — | Access review per platform |

## Release gates

| Release | Exit gate | Status |
|---|---|---|
| R0 Discovery quality | Live LabMedExpert discovery returns grounded recommendations and clearly scoped gaps; PageSpeed verified; DataForSEO wired | Deployed (PR 30). PageSpeed live-tested; DataForSEO wired and fixture-tested, awaiting credentials for a live test |
| R1 Search activation | Tenant GSC OAuth, rank tracking, WordPress or repository change flow on an owned test site | Not started: needs Google OAuth client and an owned test site |
| R2 Revenue activation | HubSpot OAuth, lead ingestion, task/deal creation, GA4 + CRM outcomes | Not started: needs HubSpot app and sandbox |
| R3 Campaign activation | Google Ads and Meta paused creation, approval, review, pause/resume | Not started: needs developer access and test ad accounts |
| R4 Full ecosystem | Remaining engines, durable scheduling, cross-engine measurement | Not started |
| R5 Commercial launch | Stripe entitlements, metered costs, security tests, onboarding | Not started |
