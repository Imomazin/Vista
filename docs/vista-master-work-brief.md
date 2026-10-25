# VisTa Master Work Execution Brief

## Mission
Complete VisTa as a cinematic, evidence-based, commercially useful nine-element Marketing Superior Intelligence platform. The public-facing brand must be written exactly **VisTa** with a capital V and T, and lower-case i, s and a. Product positioning: **Marketing Superior Intelligence. Reimagined.** VisTa is an Ambidexters technology.

Deliver actual working software, design and tests. Preserve existing functionality, do not fabricate live marketing data and do not ship placeholder-only dashboards.

The definitive product visual identity and its detailed dual-theme component, motion and QA specification is in docs/titanium-emerald-master-brief.md. Treat it as the governing design contract when creative references disagree.

## Working assets and starting point
- GitHub repository: Imomazin/Vista (keep this repository name).
- Main production branch: main.
- Current implementation branch: vista-cinematic-intelligence.
- Open draft pull request: #1.
- Vercel project: vista; attached verified domain vista.ambidexters.com.
- Stack: Next.js App Router, TypeScript, React, Cheerio, custom CSS and Lucide.
- GitHub Verify workflow: typecheck, unit tests and production build.
- Preview deployments have Vercel authentication. Actual visual testing requires authorized browser access.
- Read README.md, docs/ecosystem.md, docs/roadmap.md, docs/vista-transformation-blueprint.md, docs/vista-execution-backlog.md and docs/vista-work-execution-instructions.md.
- Follow this document and the source code on the development branch as the current implementation source of truth.

## Already implemented

1. VisTa rhetorical entrance, animated three-dimensional rotating V, pointer-responsive inertial movement, cinematic lighting and skip/pause/reduced-motion controls.
2. VisTa wordmark transformation into nine positioned intelligence elements.
3. Persistent nine-element navigation dock throughout the platform.
4. Interactive nine-element constellation with focused engine views, precise value propositions, metrics, evidence requirements and decision playbooks.
5. Individual diagnostic experiences across all nine engines, with four decision questions and structured self-assessment. Findings are labelled self-reported hypotheses.
6. Validated browser-local, project-scoped engine evidence ledger with dates, source links, kind, implication, action, observed stages, export and import.
7. Command Centre nine-engine matrix showing real local evidence counts and honest source-connection statuses.
8. Executive Intelligence Pulse with source-grounded technical opportunities, radar, project filters, history, signal timeline, evidence pathways and export.
9. Expanded Command search over tools, projects, audit findings and editorial briefs.
10. Existing working multi-page website investigation, nine-signal HTML audits, repeat scans, comparisons, text analysis, project workspaces, content briefs, action tracking and exports.

Do not rebuild existing working experiences. Improve visual quality, navigation, data integrity and cross-engine depth; use the test suite to catch regressions.

## Brand, cinematic experience and navigation
- Begin with the provocative opening question: "What if your next advantage is hiding in plain sight?"
- The VisTa wordmark must have distinctive treatment for the capital T, with premium physical depth, precise metallic/pearl lighting and strong typographic choreography.
- The wordmark visibly evolves into nine independent, named elements along elegant connecting trajectories. Elements settle in their intended positions within the interactive constellation.
- The nine elements stay accessible as a compact navigation dock in everyday workflows. Every element must be able to open its full studio and return to the overall Command Centre.
- Preserve immediate skip access, Escape handling, play/pause, mobile/touch accessibility and prefers-reduced-motion.
- Prototype WebGL/Three.js only when measured benefit over current Canvas warrants the additional size/complexity. Use fallback visuals on devices without graphics support.
- Visual direction: cinematic obsidian, sophisticated dark graphite, luminous mint/emerald, pearlescent-metal accents, elegant editorial typography and disciplined spacing.
- Main cockpit must feel like a real decision system, with dense but legible source-aware charts, comparisons, opportunity drilldowns, timelines, compelling empty states and responsive navigation.
- Absolutely no decorative controls without an action or fabricated graphs.

## Intelligence operating loop
Every engine should implement Observe -> Explain -> Prioritise -> Approve -> Act -> Verify -> Learn.

Capture for every quantitative or factual claim: project and tenant, metric definition, source, link/source ID, observation timestamp, geographic and time scopes, units, sample size, confidence and limitations. Separate direct measurements from manual observations, hypotheses and estimates. Record recommended action, owner, approval, verification and outcome when available. Never use a nine-signal HTML score as an overall search ranking, AI visibility or revenue score.

## Nine elements: full value scope

1. **Search Visibility**: Secure read-only Google Search Console OAuth; property selector, query and page views, impressions/clicks/CTR/position, time and country/device segmentation, meaningful changes, keyword/page opportunities, source transparency and licensed competitive rankings only where authorized.
2. **Impact Intelligence**: Consented GA4 events, qualified conversions, journeys, funnel loss, optional CRM integration, campaign contribution, documented attribution model, experiments, baseline and post-change outcomes. No invented conversion or revenue figures.
3. **Site Intelligence**: Expand secure HTML audits into scoped crawls covering redirects, broken links, sitemap/robots, canonicals, duplicates, structured data, internal link graph, hreflang, indexability, accessibility flags, JS rendering where warranted, documented Core Web Vitals and exact-page repeat verification. Preserve protections against private IPs, SSRF, rebinding, unsafe redirects and uncontrolled crawls.
4. **Strategic Content Studio**: Audience/intent gap research, source-grounded briefs, evidence-based draft analysis, claim validation, internal link recommendations, editorial workflow, versioning, owner approval, destination-limited publishing and outcome measurement.
5. **Trust and Authority Graph**: Verifiable brand, author, organisation and publication entities; linked authoritative sources, conflicts and discrepancies, structured data, provenance-aware authority claims, traceable corrective actions and verified identity improvements.
6. **Reputation and Digital PR**: Permitted public mentions, attributable source credibility, monitored date/context, human-reviewed sentiment, threats/opportunities, media response workflows and approval-controlled outreach.
7. **Agency Operations**: Secure organisations, projects, tenant-isolated client workspaces, roles, approvals, action ownership, service templates, scheduled reporting, white-label exports, SLA tracking and auditable permissions.
8. **Analytics Intelligence**: Reconciled GSC/GA4/crawl metrics with a source dictionary, time/currency/locale compatibility, drilldown, anomaly detection, change history, reports and action-outcome measurement.
9. **AI Exposure / GEO**: Provider-compliant prompt sampling via permitted APIs; exact prompts/responses/model/date/market where available, citations, brand and competitor mentions, repeat samples, uncertainty, source gap analysis and measurable intervention checks. No universal AI share-of-voice claims from limited samples.

Each of the nine studios must meaningfully answer:
- What is happening?
- Why does it matter?
- What should be done?
- How reliable is the evidence?
- How will the result be verified?

## Connected VisTa differentiators
Develop and connect the following as real workflow components:
- VisTa Opportunity Radar: evidence, persistence, relevance, confidence, effort, urgency, ownership and follow-up.
- VisTa Evidence Graph: link pages, queries, sources, entities, AI citations, events and outcomes.
- VisTa Decision Room: transparent scenarios, assumptions, alternatives and sensitivity ranges.
- VisTa Signal Timeline: verified historical changes across engines.
- VisTa Ask: retrieval-based, permission-aware explanations over actual connected organisational data, with citations and abstention where evidence is missing.
- VisTa Execution Loop: approved actions, owners, progress, publication where authorized, verification and recorded outcome.
- VisTa Agency Command: secure cross-client operations without data exposure between tenants.

## Secure foundation and integrations
- Implement robust identity, managed Postgres persistence, migrations, backups, tenant membership and role-based server authorization across every endpoint.
- Migrate browser-local work safely via explicit export, validation, preview, import, duplicate detection and rollback, preserving old data until the user confirms.
- OAuth must use scoped permissions, state validation, encrypted refresh tokens, property selection, disconnect and revocation handling.
- Build durable rate limiting, monitoring, scheduled jobs, retries, quotas, ingestion freshness and source provenance.
- Add privacy/retention/deletion/export controls, UK GDPR principles, proper consent, terms-compliant public data collection and API budget management.
- Never put real client data, secrets, licensed datasets or access tokens in the public repository.

## Work sequence
**Wave A: signature experience.** Authenticate into the preview, test the exact implemented entrance, VisTa wordmark, nine-element reveal, persistent dock, responsive element studios and Command Centre. Capture screenshots, benchmark performance and refine interactions. Fix any broken flow immediately.

**Wave B: secure evidence.** Build authentication, multi-tenant database, managed storage, validated migrations, import/export and secure jobs. Preserve existing browser-local records and existing site audit workflows.

**Wave C: first-party intelligence.** Connect Search Console, GA4 and extended technical crawling with real sourced data and measurable cross-engine Opportunity Radar.

**Wave D: differentiation.** Implement GEO provider sampling, evidence graph, strategic content connections, decision scenarios and a grounded conversational VisTa interface.

**Wave E: commercial scale.** Add agency/client permissions, reports, controlled publishing, subscriptions, governance, robust observability, documentation and full launch QA.

## Definition of done
- A complete tested walkthrough of the cinematic transformation and all nine elements on desktop and mobile.
- Every visible interaction works or clearly explains an unavailable integration.
- Each engine delivers a meaningful observation-to-action workflow with source-aware evidence.
- Accessibility meets WCAG 2.2 AA; motion controls and keyboard/escape paths work.
- Target Core Web Vitals at p75: LCP under 2.5s, INP under 200ms and CLS under 0.1 on representative traffic/devices.
- Automated typecheck, build and tests pass; add integration, end-to-end and security tests for all new functions.
- Provider metrics have accurate time windows, definitions, provenance and no fabricated values.
- Test tenant isolation, data validation, unsafe URLs, OAuth failures, quotas, recovery and permissions.
- Deploy to a permitted Vercel preview and validate the exact commit. Keep main/production unchanged until a tested release is approved.
- Deliver working code in reviewable pull requests with screenshots, source verification, test results and rollback instructions.

## Work operating instruction

Read the repo and these instructions, audit the running preview with your cloud browser, and make concrete code changes in the same working session. Do not stop after planning. Work through the waves as far as access and resources permit, stating genuine constraints and the next executable ticket. Never claim an integration is complete until its live, permissioned measurement is verified.

Final delivery should show: implementation and tested commit, preview state, quality results, working capability by each of the nine engines, source connection status, unfinished integrations and what authorization or credentials are required from the account holder.
