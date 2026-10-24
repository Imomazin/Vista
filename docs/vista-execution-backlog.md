# Vista Execution Backlog

## Immediate sequencing

| Priority | Work package | Work to deliver | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Baseline and reliability | Browser smoke test of custom domain, responsive views, endpoint and Vercel errors; run all current tests and build | Document verified working routes, bugs, screenshots, deployed commit and rollback |
| P0 | Brand design system | Cohesive visual tokens, typographic scale, premium surfaces, responsive components, motion vocabulary | Design checklist with representative desktop/mobile views and contrast tests |
| P0 | V cinematic signature | Solid high-quality rotating 3D V, real reflections, intentional opening sequence, pause/reduced motion/fallback | Demonstrated on desktop/mobile with motion controls, visible geometry, no blocked navigation |
| P0 | Command cockpit | Executive pulse, evidence cards, signal timeline, active project selector and actions queue | Working navigation and distinct empty/demo/live states; no invented metrics |
| P0 | Data identity foundation | Managed Postgres, auth, organisation projects, memberships, robust validation and backup | Cross-tenant access tests, migration tests, user export/deletion, browser-data import |
| P0 | Security and resilience | Durable rate limits, crawler SSRF review, quotas, logs, monitoring, workload budget | Negative SSRF tests, abuse tests, observable failures, stable run history |
| P1 | Search Console integration | Secure connect/select/read-only sync, normalized queries and pages, freshness | Authenticated GSC property loads real attributed metrics, disconnect works |
| P1 | GA4 integration | Consented connect, landing-page conversion and event reporting | Attributed GA4 events with identical date/locale handling and source details |
| P1 | Site Intelligence upgrade | Whole-site scoped crawl, robots/sitemap/indexability/link map, rendered checks, history | Test site issues are detected reproducibly and reported with page evidence |
| P1 | Opportunity Radar | Explainable prioritization with effort, importance, confidence, owner and evidence | Every scored recommendation shows inputs and can be rejected/edited |
| P1 | Competitor Observatory | Saved competitors and repeat comparisons across shared, sourced metrics | Timeline with trend changes and source/time comparability restrictions |
| P1 | AI Exposure pilot | Approved prompt set, provider scheduling, exact responses, mentions, citations and source gap | Repeatable sampled runs show denominators, provider details and errors |
| P1 | Content workflow | Brief from finding, evidence, drafts, approvals, changelog and follow-up | Trace an action through brief, published change and verification |
| P2 | Authority and PR | Verified entity graph, source discrepancies, permitted public mentions | Evidence clickthrough, timestamp and uncertainty on each claim |
| P2 | Agency workspace | Client roles, white-label export, task templates, configurable reports | Cross-client isolation, role test suite and branded output |
| P2 | Vista Ask / Decision Room | Scoped semantic retrieval, cited insights and scenario assumptions | Citation checks, no cross-tenant leakage, unsupported-answer refusal |
| P2 | Billing and subscriptions | Entitlements, self-serve billing, quota views and invoicing | No access bypass, full transaction audit, cancellation works |
| P2 | Growth and global scale | Internationalisation, localization, scalable jobs, benchmark reliability | Agreed load targets, recovery procedure, launch checklist |

## Wave structure

### Foundation and showpiece
Address P0 items. Prioritise excellent visuals and working command navigation in parallel with the database and authentication foundation. Create a real demo mode clearly labelled as a sample; keep live data segregated. Avoid letting the design rewrite erase audit and workspace functionality.

### Evidence-bearing intelligence
Deliver a coherent workflow across website discovery, GSC, GA4, site crawl, competitor comparison, opportunity prioritisation and action verification. The first meaningful customer outcome should be discover → explain → assign → rescan → observe change.

### GEO differentiation
Launch controlled provider-compliant AI sampling, competitor mention analysis, source citation mapping and evidence-linked GEO recommendations. Establish reproducible prompts and review conditions. Present uncertainty and platform availability conspicuously.

### Enterprise and agency expansion
Implement role-specific dashboards, white-label exports, scheduled reports, team approvals, content publishing adapters, reputation/authority products and organization-wide summaries after foundation gates pass.

## Recommended first ten Work tickets

1. Audit deployed site and repository; report actual user flows, broken controls, responsive, accessibility and performance issues.
2. Set the official art direction and tokens; update reusable components without deleting current interactions.
3. Prototype real 3D V in isolated route and compare against current Canvas for image quality, performance and fallback.
4. Implement flagship question entrance and seamless skip-friendly transition.
5. Build the executive cockpit with real/local/demo data labels and reusable evidence inspector.
6. Establish tenant-safe database/auth/data migration with automated isolation tests.
7. Harden public audit and jobs: quotas, SSRF, logging and failure visibility.
8. Implement verified first-party GSC connection with clear property/time selections.
9. Implement advanced site crawl and historical comparison.
10. Implement opportunity/action workflow and pilot AI sampling behind feature flags.

## Definition of done for every ticket

- Behaviour is demonstrable, not decorative; all controls act or are explicitly disabled with an explanation.
- Real claims show exact source and collection date; estimated or sampled outputs are labelled.
- Responsive on mobile/tablet/desktop; keyboard and reduced-motion states tested.
- Unit/integration/e2e tests cover success, failure and role boundaries.
- Typecheck, build, accessibility and relevant performance tests pass.
- New data has retention, export, access and deletion paths where appropriate.
- Each release is deployed to preview, tested, and approved before production promotion.
- Changes include a concise list of completed work, remaining constraints and release verification steps.

## Nonnegotiable competitive outcomes

- A first-time user can run a valuable website inspection without an account, under safe public quotas.
- A connected user can see one trusted, source-referenced view across at least GSC and GA4.
- A user can investigate a specific opportunity, assign work and verify the resulting change.
- AI visibility screens clearly separate observed samples, source citations, mentions and estimated reach.
- An agency client can never see another client's confidential project data.
- The public entrance feels premium and cinematic, while productive tasks remain fast and accessible.
