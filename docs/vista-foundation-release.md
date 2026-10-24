# VisTa foundation and connected decisions

## Implementation scope

This increment extends vista-cinematic-intelligence, retaining the entrance, constellation, nine studios, diagnostics, technical tools, local projects and action workflows. It does not merge main or configure production services.

### Wave A

- Correct the entrance's inherited trademark styling that made the capital T too small.
- Add an independent metallic SVG emblem beneath the existing closed-mesh Canvas renderer. The preview browser showed an empty canvas region despite a sized canvas and advancing rotation attribute. The fallback preserves the visible identity when canvas compositing is unavailable.
- Guard zero-sized canvas initialization and avoid unnecessary backing-buffer resets.
- Persist individual engine selection in hash URLs, including refresh and browser history.
- Focus the main content on navigation and the skip control during the cinematic dialog; trap Tab inside the single-control dialog.
- Increase dock touch targets, preserve reduced motion and add visible studio focus states.
- Add /review, a preview-only embedded viewport harness at 320, 390, 768 and 1280 pixels. This tests actual responsive CSS, not physical phone hardware.

### Wave B

- Complete, validated transfer package covering local projects, audits, content briefs, manual AI samples, action plans, engine evidence, decisions and content draft. Existing individual backup formats remain supported.
- Preview record counts and download the package before any cloud upload. Browser originals are never removed. All packages validate project references, duplicate records and size limits.
- Supabase Auth email-code adapter using server-side provider verification and a secure, HttpOnly, host-only, SameSite=Strict cookie. No service-role key and no tokens in browser localStorage. Accounts must already exist. Sessions expire after at most one hour; refresh-token storage is deliberately not implemented.
- Organisation membership authorization on every cloud read/write, with owner/editor/viewer roles enforced again by Postgres row-level policies. Each client needs a separate organisation boundary.
- Revision-conditional cloud checkpoints, conflict detection and append-only database history. These checkpoints are not continuous multi-user synchronization. Previous revisions remain recoverable by an administrator; self-service restore is pending.
- Evidence ledger rejects stale cross-tab writes and prevents deleting evidence referenced by a decision.

### Connected workflow increment

- Decision Room: source-linked proposals, impact hypotheses, alternatives, owner, review date and verification plan.
- Sequential checkpoints: Proposed, Approved, In progress, Awaiting verification, Verified, Learned. Verification requires an outcome and HTTPS source; learning requires a retained lesson.
- Approvals and verification are explicitly manual attestations, not authenticated team approvals or automated outcome checks.
- Evidence Graph groups exact source URLs only within a project. Shared-source relationships do not imply causation or independent corroboration.
- VisTa Ask retrieves matching project evidence and source extracts, with explicit abstention when nothing matches. It is keyword retrieval, not generative AI.
- Signal Timeline combines dated engine observations with decision checkpoint history. Decision exports include supporting evidence.

## Capability boundaries

| Engine | Working in this preview | Not connected / remaining |
| --- | --- | --- |
| Search Visibility | Diagnostic, evidence capture, decisions, HTML comparisons | GSC OAuth, actual query/page metrics, licensed competitive rankings |
| Impact Intelligence | Project goals, evidence-backed experiment hypothesis and verification plan | GA4, CRM, conversions, attribution and revenue measurement |
| Site Intelligence | Public HTML retrieval, nine checks, five-page investigation, repeated scans, exact-page actions | Full crawler, robots/sitemap policy, rendering, CWV, durable quotas |
| Strategic Content | Draft analysis, evidence briefs, editorial stages, linked decision records | Source fact checking, versioned collaborative review, publishing APIs |
| Trust and Authority | Manual claims, sources, discrepancies, same-source cross-engine relationships | Verified entity ingestion, automated authority analysis |
| Reputation and PR | Manual mention evidence, response decisions, approval checkpoints | Licensed monitoring, alerts, authenticated approvals, outreach |
| Agency Operations | Local project portfolio, owners, due dates, exports; cloud checkpoint adapter | Live tenants, shared editing, granular project roles, SLAs, white-label reporting |
| Analytics Intelligence | Dated technical trends, scoped evidence search, decision history | Reconciled GSC/GA4 datasets, attribution, statistical anomalies |
| AI Exposure / GEO | Manual prompt/response observations, citations as entered, decisions and follow-up | Provider sampling, prompt versions, model comparisons, scheduling and uncertainty estimates |

Only public HTML inspection is a live external intelligence retrieval. No external marketing metrics were fabricated or connected by this increment.

## Activation requirements

The Vercel project environment list was empty during this session. Cloud endpoints fail closed until configured.

1. Provision an approved Supabase project in the chosen data region, with backups and retention policy. Use a dedicated preview database first.
2. Apply database/foundation.sql once through an administrator connection. It creates organisation membership, workspace checkpoint and history tables, RLS policies and an append-only revision trigger.
3. Provision verified Auth users and memberships through the administrator interface. There is intentionally no public self-service organisation creation or membership mutation endpoint.
4. Set VISTA_SUPABASE_URL and VISTA_SUPABASE_ANON_KEY as preview-only server environment variables. Do not use a service-role key. The configured URL must use the standard HTTPS *.supabase.co host.
5. Configure the email template to include the one-time Token, SMTP, provider rate limits and abuse protection. Configure allowed site URLs. Existing users only: create_user is false.
6. Validate live sign-in, denied membership, tenant isolation, expired/revoked sessions, concurrent writes, historical restore, retention/deletion and backups before client onboarding.
7. Google OAuth, analytics consent, encrypted connector credentials, durable jobs, scheduled measurements and API quotas are subsequent packages. No background worker or automatic synchronization is running.

Reference implementation uses the Supabase Auth HTTP API and Postgres RLS: https://supabase.com/docs/guides/auth/auth-email-passwordless and https://supabase.com/docs/guides/database/postgres/row-level-security.

## Verification and release requirements

Automated tests execute the actual SQL migration in embedded Postgres (PGlite) with simulated authenticated principals. They exercise cross-tenant reads/writes, viewer denial, role escalation denial, stale revisions and immutable history. This is not a live hosted Supabase verification.

Additional tests cover decision checkpoints, missing evidence, project-scoped retrieval, migration preservation, unsafe origins, body limits and engine routes. Type checking and production compilation are required alongside the existing regression suite.

Preview QA completed: full decision lifecycle through Learned, reload persistence, scoped evidence retrieval and no-match abstention, complete backup download parsed successfully, visible metallic entrance and responsive layouts at 320/390 CSS pixels without horizontal overflow. The viewport harness is not a physical-device test. Automated suite: 39 passing tests; type checking and production build passed. Follow-up hardening routes all Command Centre constellation nodes to their matching studios and rejects evidence replacement that would orphan decisions.

Open release gates: live cloud-provider tests, accessibility audit, representative device performance, p75 Core Web Vitals, durable API throttling, recovery drills, provider integrations and production authorization. No WCAG or enterprise-readiness certification is claimed.

Rollback: keep main unchanged. Previous branch preview remains available. Revert the incremental code commits if needed. The database migration is additive; keep checkpoint/history tables and exported data during rollback. Do not drop tenant data to roll back application code.
