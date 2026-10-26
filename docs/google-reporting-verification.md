# Google reporting workflow

Development branch: seamless-google-workflow. Production is unchanged by this work.

## Implemented

- GA4 channel, landing-page and daily reports with validated dates; Realtime event reports.
- Readable source tables, retrieval time, property, reporting period and JSON export.
- Explicit empty-result and truncated-result states. No fabricated metrics or additive user totals.
- Organisation selection, owner-only controls, cleared results on organisation changes and failed requests.
- Existing server-side membership, approved-provider organisation, readonly Google scopes and request limits retained.

## Validation

TypeScript and all 83 automated tests passed. Optimised Next.js build compiled and generated all routes successfully. New tests exercise all four GA4 request schemas, readonly impersonation, date validation, empty reports, truncation and malformed metric rejection using mocked provider responses.

## Remaining release checks

- Preview desktop/mobile interaction and visual verification.
- Signed-in production-authorised GA4 Realtime observation after a consented visit; compare against Google Analytics. Production-only federation must not be broadened merely for preview testing.
- Verify consent rejection emits no analytics events and acceptance emits expected events.
- Review and authorise production deployment.

## Remaining platform work

This package does not complete the enterprise platform. Google reports remain on-demand and are not persisted by the connection screen. Scheduled ingestion, durable report history, engine-wide metric reconciliation, CRM/AI provider activation and complete end-to-end testing of the nine engines remain separate work. An empty API response verifies retrieval access only, not event collection, search visibility, attribution or commercial results. The current shared connector endpoint permits five requests per hour; this is a connection-validation workflow, not a polling dashboard.
