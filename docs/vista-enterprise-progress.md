# VisTa measurement, recovery and operational execution

This release continues the existing cinematic-intelligence branch. Main and the custom production domain are not promoted. It adds functioning report analysis, recovery and deeper HTML inspection, plus deployable cloud-job and rate-limit adapters. It does not certify the whole enterprise brief as complete.

## Implemented user workflows

### Measurements

Open Measurements, create/select a project, then import a source report. Supported CSV contracts are:

- GSC: date,page,query,country,device,clicks,impressions,position. Query, country and device are optional columns.
- GA4: date,page,country,device,channel,sessions,keyevents,revenue. Country, device and channel are optional columns.

Use daily page-level rows. Remove provider summary rows and rename columns to the contract. Record the actual property, source report URL, date range, collection time, report filters, time zone, currency and limitations. Never upload access tokens or individual customer records. Limits: 5,000 rows per report, 24 reports, 10,000 rows total and 2 MB for the register.

Validation rejects duplicate dimensional rows, nonnumeric metrics, impossible dates, orphaned projects and mixed provider metrics. The preview shows aggregate counts before explicit confirmation. Existing report identity/period/scope combinations cannot silently overwrite earlier imports.

The cockpit includes daily charts with exact tables, country/device/channel filters, page/query search, page totals, source metadata and Markdown export. CTR uses total clicks/total impressions; average position is impression-weighted. GA4 key events/session is explicitly not a conversion probability. Revenue retains its declared currency.

Comparisons require matching project, source, property, scope, time zone, currency and dimension availability, non-overlapping dates and equal period lengths. Missing dates are not filled with zeros. Imported aggregates are not claimed to equal provider property totals.

Review opportunities use a transparent within-report volume × gap rule, with a minimum volume of 100. They are not significance tests or uplift forecasts. Recording a hypothesis copies report provenance, filters and values into the existing evidence ledger for the Decision Room workflow.

Imports are user-supplied reports. They are not authenticated Google connections and their authenticity is not independently verified.

### Backup restoration

Connections now previews and restores complete packages, including measurement reports. Older packages remain accepted. Before any replacement, the application stores the previous raw browser registers in a recovery journal. Stale previews are rejected. A mid-write failure attempts rollback and retains the recovery journal even if rollback cannot finish. A separate control restores previous data; another explicitly discards the recovery copy. Local storage quota limitations remain applicable.

### Site and authority observatory

Deep investigation now extracts bounded internal/external link evidence, JSON-LD entity declarations and relationships, identity links, hreflang declarations and static accessibility review signals. Across inspected pages it identifies repeated titles, different names attached to the exact same declared entity ID and observed links between completed pages. Findings can enter the existing engine evidence ledger after the page audit is saved to a project.

Declared identity claims are not independent verification. A name discrepancy may be a legitimate alias. Link destinations, rendered content, robots policy, full-site crawl coverage, colour contrast and assistive-technology behaviour are not verified by this extraction.

## Operational controls

Public audit requests now enforce same-origin requests and a 4 KB JSON body limit. Request IDs, status and duration are logged without page URLs, report contents, IPs or tokens. Sign-in requests have an application request limit in addition to provider controls.

Optional durable rate limiting uses an atomic Redis Lua counter and expiry through Upstash REST. Configure these server-only variables:

- VISTA_RATE_LIMIT_URL: HTTPS Upstash REST origin.
- VISTA_RATE_LIMIT_TOKEN: a restricted Redis credential with EVAL/INCR/EXPIRE/TTL permissions for the vista:limit key prefix.
- VISTA_RATE_LIMIT_SALT: at least 32 random characters for HMAC identifier hashing.

If all are absent, the existing process-local limit remains available, with bounded memory and an explicit operational limitation. Partial configuration or provider failure fails closed. Production needs a configured durable limiter or equivalent edge protection. Trust x-real-ip only behind the deployment provider that overwrites it; direct self-hosting needs an authenticated proxy/header policy.

### Durable audit queue

Apply database/foundation.sql, then database/jobs.sql to a dedicated preview Supabase database. The new queue supports one bounded public-page audit per job, scheduled up to thirty days ahead. It is not a full-site crawling or general connector scheduler.

- Enqueue requires owner/editor membership and an existing project in the organisation's saved cloud checkpoint.
- Per-organisation idempotency keys prevent duplicate submissions.
- Database locking serializes the 20 pending/100 rolling-day quotas.
- Workers claim due jobs using row locks and a two-minute lease.
- Unique fencing tokens prevent expired workers or cancelled jobs from being overwritten.
- At most three attempts; failures become due again after an attempt-based delay. Exhausted expired leases become failed.
- Viewers may read their organisation's jobs but cannot schedule, cancel, claim or finish them. Lease tokens are not selectable by authenticated browser users.
- Job results include requested URL, collection time, audit findings and limitations. They remain separate from approved project evidence.

Required server-only configuration, in addition to the existing Supabase URL/anon key:

- VISTA_JOB_WORKER_KEY: the Supabase service-role credential, used only by the worker's claim/finish RPC calls. This credential is powerful and must never reach clients or the public repository. Prefer a dedicated preview database and rotate according to the organisation's policy.
- CRON_SECRET: at least 32 random characters.

Invoke GET or POST /api/jobs/worker with Authorization: Bearer <CRON_SECRET> through an authorised scheduler. Each invocation claims at most one job. No recurring schedule is enabled in this release. Set an appropriate cadence and budget after hosted validation. The UI displays configuration requirements when unavailable. Results and queue rows currently require an administrator-managed retention policy; automatic retention and deletion workflows are outstanding.

## Current nine-engine status

| Engine | Operational capabilities | Outstanding enterprise work |
| --- | --- | --- |
| Search Visibility | Imported daily reports, segmentation, weighted metrics, period checks and sourced hypotheses | Google OAuth/property selection/sync and live reconciliation; licensed competitive data |
| Impact Intelligence | Imported GA4 landing-page outcomes, comparisons, explicit metric definitions and experiment hypotheses | Consented direct integration, CRM, funnels and causal/attribution methods |
| Site Intelligence | Secure public HTML audits, scoped five-page investigation, detailed link/entity/accessibility evidence and repeat verification | Robots/sitemaps, large durable crawls, rendering, response/redirect graph, CWV |
| Strategic Content | Existing draft analysis, briefs, editorial stages, evidence-linked decisions | Versioned collaborative approval, source claim verification, authorised publishing |
| Trust and Authority | JSON-LD entity extraction, same-ID name discrepancies, source-linked evidence and decisions | Independent identity verification, richer entity reconciliation and authoritative-source ingestion |
| Reputation and PR | Existing manual evidence and response decision workflow | Licensed media ingestion, monitoring, alerts and authenticated outreach approvals |
| Agency Operations | Local projects, ownership, exports, complete restoration; optional tenant-scoped cloud checkpoints and audit jobs | Hosted activation, collaborative editing, project roles, service/SLA and white-label reporting |
| Analytics Intelligence | Imported GSC/GA4 analysis, compatibility rules, dictionary, source-aware reports and existing technical trends | Direct connectors, automated reconciliations, statistical anomalies, executive reporting schedules |
| AI Exposure / GEO | Existing exact manual prompt/response observations and source/evidence workflows | Provider APIs, versioned prompt libraries, repeated controlled sampling, model comparisons and defensible uncertainty |

## Validation and release gates

Tests exercise real SQL migrations in embedded Postgres, including tenant/role access, idempotency, cancelled-worker fencing and three-attempt crash recovery. They also cover CSV quoting, metric weighting, incompatible comparisons, malformed imports, backup compatibility, stale restore previews, rollback on storage failure, rate-limit provider failure, endpoint request limits, entity extraction and source graph scope. Hosted Supabase and Redis are not configured or live-tested.

Deploy the branch preview and verify report import → filter → hypothesis → Decision Room; complete backup → restore → rollback; public HTML investigation → entity/accessibility tabs → sourced finding. Test at desktop and narrow mobile widths. Production still requires hosted security tests, external integrations, accessibility/performance review, recovery/retention drills and explicit deployment authorisation.

The Vercel account has existing Prisma and Neon integrations, but neither is attached to VisTa. This is not equivalent to an available configured Supabase identity/database service. No unrelated database or application configuration has been changed.

References for the implemented report semantics and adapters:
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
- https://upstash.com/docs/redis/features/restapi
- https://vercel.com/docs/cron-jobs
