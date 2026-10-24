# Vista Transformation Blueprint

## Product identity

**Vista | Marketing Superior Intelligence. Reimagined.**
An Ambidexters technology.

Vista connects visibility, influence, technical health, audience behaviour, commercial results, and decisions in one evidence-based intelligence ecosystem. The five pillars remain V — Visibility, I — Impact Intelligence, S — Search and Site Optimisation, T — Trust and Authority, A — Agencies, Analytics and AI Exposure. Preserve all nine intelligence engines and their identities.

Vista's distinctive workflow is **Observe → Explain → Prioritise → Act → Verify → Learn**. Each dashboard, engine and recommendation must contribute to this chain. Every important metric requires a source, period, scope and freshness timestamp. Every recommendation needs an evidence link, impact hypothesis, confidence, effort, owner and verification method.

## Existing foundation as of 24 October 2026

- Source repository: Imomazin/Vista on branch main; Next.js 16 App Router, React 19, TypeScript, Cheerio, CSS, Lucide.
- A live HTML retrieval path evaluates nine technical signals; it must not be presented as an overall SEO, GEO or commercial score.
- Current product surfaces: cinematic entrance with Canvas-rendered rotating dimensional V, command dashboard, single-page audits, up-to-three-page comparisons, scoped multi-page investigation, content draft analysis, browser workspace, manual AI observations, action board and exports.
- Workspace data resides in browser localStorage, without cloud account sync or tenant security.
- Most engine catalogue entries remain planned. The repository has unit tests and CI verification.
- Vercel project named vista has a ready deployment and lists the intended custom domain vista.ambidexters.com. Rendering and domain reachability require an actual browser smoke test before release.
- Do not discard the existing useful workflow, migrate existing local records without loss, or claim unimplemented integrations are functional.

## Experience and art direction

### Cinematic entrance

- The opening visual starts with a short provocative question: “What if your next advantage is hiding in plain sight?” Preserve its editorial clarity.
- A visually substantial, solid, machined, six-dimensional-feeling **V** is the brand hero. Use actual geometry, bevels, realistic physically based materials, changing specular reflections, engineered movement, shadow and apparent depth. The V must remain legible at every angle and feel monumental on large screens.
- Create a signature sequence: atmospheric opening, gentle model reveal, one intentional interaction, precise transition into the command centre. Do not force long waits; let users skip immediately.
- Use a premium obsidian, luminous pearl and restrained mint palette. Introduce a small spectral accent only if it improves hierarchy. Avoid gaudy rainbow gradients, generic glowing cards and excessive glass.
- Motion: smooth turntable, pointer-responsive parallax, atmospheric particles, choreographed typography, responsive animated constellation and subtle data transformations. All motion must support prefers-reduced-motion, pause/play controls and mobile fallbacks.
- Implement a reusable, lightweight 3D stack, for example Three.js with React Three Fiber, only after a performance prototype demonstrates the advantage over the current Canvas renderer. Asset weight, battery use, render cost and accessibility are release gates.
- Add a hero poster/fallback for low-power devices, failed WebGL, slow networks and screen readers. Do not block the first interaction on 3D loading.

### Command centre

- On entry, show a meaningful cockpit, not a second marketing page. Display current project, real connected sources, time ranges, freshness, major changes, opportunities, issues and actions.
- Primary information hierarchy: Executive pulse → Signals and changes → Why it matters → Recommended next moves → Evidence.
- Main surfaces: global search / command palette; project and competitor switcher; unified timeline; source status; interactive globe or geographic heat map only where reliable geographic data exists; opportunity cards; live action queue; compact integrations; export/report.
- Use meaningful charts, evidence inspectors, clean tables, drilldowns, diff views and side-by-side comparisons. Show informative empty states, demonstration data conspicuously labelled, and source-unavailable states.
- Offer different views for executives, analysts, marketers, agency managers and content teams. Make the executive view truly decision-oriented, and the analyst view richly explorable.
- Make mobile excellent through controlled content density, sticky selectors and collapsible evidence; avoid miniature desktop dashboards.

### Design system and quality

- Define typography scale, spacing, radii, materials, depth, tokens, iconography, interactions, motion curves, components and chart rules before page-by-page implementation.
- Add polished loading, optimistic updates where safe, success/error states, inline help and onboarding. Use one canonical navigation model across mobile and desktop.
- Meet WCAG 2.2 AA, keyboard navigation, visible focus, semantic charts and colour contrast. Evaluate non-motion and reduced-data experiences.
- Targets: no horizontal overflow at 320px; Lighthouse accessibility at least 95 for representative flows; Core Web Vitals targets LCP under 2.5s, INP under 200ms, CLS under 0.1 at p75 under appropriate real-world measurement; cap heavy hero effects by device capability.

## Nine intelligence engines

### Visibility / Search visibility

Authenticated Search Console property selection; search queries, clicks, impressions, CTR, average position, landing pages, countries, devices, coverage and change analysis. Optional licensed rankings and competitor datasets must be identified as such. Discover query/page opportunities, content cannibalisation and underperforming high-impression pages. Support multi-country comparisons with consistent periods.

### Impact / Commercial intelligence

Connect consented GA4 and later CRM and advertising accounts. Track outcomes, events, qualified leads, funnels, campaign effects and conversion by landing page. Expose attribution methodology, uncertainty, missing events and date alignment. Build experiment hypotheses and post-change outcome validation. Never invent ROI where revenue or cost data are unavailable.

### Site / Technical intelligence

Grow beyond nine HTML tags: crawl queues with crawl limits and robots controls; link graph, redirects, canonicals, sitemap, robots, headers, status codes, duplicate content, schema parsing/validation, structured data, hreflang, internal linking, orphan pages, JS rendering and mobile accessibility. Integrate documented performance APIs for Core Web Vitals. Preserve snapshots, history, severity and confidence. Security protection against SSRF and prohibited targets is mandatory.

### Strategic Content Studio

Briefs tied to verified query intent, audience, competitors, evidence and objectives. Add content gap maps, outlines, editorial collaboration, approvals, version history, claim/source checking, internal link suggestions, publishing previews and measured follow-up. Treat generated suggestions as drafts with source transparency. Publishing needs explicit permission.

### Trust / Authority Graph

Track verified brand, author and organisation identity across owned sites and trusted third-party sources. Map schema entities, authorship, publication records, authoritative mentions and conflicting metadata as provenance-aware graph nodes. Do not treat repeated assertions as independently verified proof.

### Digital PR / Reputation

Monitor permitted news and web mentions, changes, coverage sources, sentiment with uncertainty, authoritative domain visibility and response opportunities. Log media outreach stages with source/date/consent; never send outreach automatically without user approval. Add reputation incident detection with confidence thresholds.

### Agencies / Operations

Organisation/client workspaces with roles, project membership, granular source permissions, branded dashboards, repeatable templates, delivery SLAs, report scheduling, approval trails and client-facing exports. Tenant data isolation must be enforced server-side for every read and write.

### Analytics / Performance

Unify GSC, GA4, crawl and approved CRM source series in a metric dictionary. Enable flexible periods, segmentation, attribution details, anomalies, cohorts, trends, exports and source reconciliation. Record unknowns and freshness; do not compare non-equivalent time windows.

### AI Exposure / GEO

Versioned prompt libraries organised by theme, buyer persona, purchase stage, location and language. Scheduled sampling against approved provider APIs and terms. Record exact prompt, provider, model, timestamp, retrieved response, citations, brand mentions, competitor mentions, sentiment and limitations. Display sample denominators and confidence. Separate model output observations from public traffic demand, actual user conversations and search rankings. Provide source/citation-gap analysis, answer consistency, entity conflicts, content interventions and remeasurement. Include Google AI result sources only via authorised compliant access or licensed data. No scraping private chats or claiming universal AI visibility.

## Signature differentiators

1. **Vista Opportunity Radar:** detect and rank cross-engine opportunities with a transparent scoring model combining expected commercial relevance, severity, confidence, effort, freshness and dependencies.
2. **Vista Evidence Graph:** connect pages, queries, prompts, entities, citations, campaigns, conversions, source snapshots and actions. Clicking a conclusion reveals its inputs.
3. **Vista Decision Room:** compare strategic scenarios using labelled assumptions, sensitivities and actual baselines; provide actions and measurement plans, not unsupported forecasts.
4. **Vista Signal Timeline:** unified chronological view of site changes, query shifts, AI citation changes and outcomes.
5. **Vista Ask:** evidence-grounded conversational querying over connected organisation data, returning source-linked answers; enforce tenancy and redaction.
6. **Vista Execution Loop:** assign owners, create briefs, record approvals, execute approved changes through scoped integrations, verify technical changes and measure results.
7. **Vista Agency Command:** roll up multiple clients without cross-client leakage, and produce branded, source-verified executive reports.

## Foundational architecture

- Retain Next.js App Router and TypeScript, using a clean separation between presentation, verified data collection, metric normalization, recommendation rules and user actions.
- Adopt managed Postgres with migrations, indexes, backups and tenant-aware access controls. Suggested conceptual entities: organisations, memberships, projects, sites, connections, source accounts, pages, crawls, evidence, metrics, prompts, AI observations, citations, actions, approvals, experiments, reports and activity logs.
- Add audited authentication and organisation membership; implement RBAC and server-side authorization on every project/resource operation. Client-side project selectors are not access control.
- Implement OAuth for GSC and GA4 with minimal scopes, OAuth state/PKCE as applicable, encryption of credentials at rest, refresh handling, disconnect/revoke and failure states.
- Use background jobs, durable queues, repeatable schedulers, idempotent fetches, provider budgets, retries and reconciliation. Avoid relying on serverless in-memory throttling for production quotas.
- Preserve URL safety and SSRF protections for crawling and check redirects/dns re-resolution/IPv6. Rate-limit by authenticated tenant, user, IP and workload. Set resource budgets and crawl consent policies.
- Add observability, error tracing, data lineage, audit logs, health checks and release feature flags. Store no real customer data or API keys in the public repo.
- Back up current browser-local work and offer an explicit, validated cloud-import migration with duplicate detection and user confirmation.
- UK GDPR and international privacy requirements: lawful basis, minimisation, deletion/export, retention settings, vendor agreements, cookie/consent controls when required, breach response and international transfer review.
- Suggested adapter model: source ingestion → normalized events and facts → evidence/provenance store → rules and analysis → actions → results. Source-specific API and licensing costs require selection before implementation.

## Commercial strategy

Serve enterprise marketing teams, agencies and scaling businesses with packages that can be implemented incrementally: Explore (limited audits and previews), Growth (connected first-party signals and action tracking), Intelligence (AI exposure and integrated outcomes), and Agency/Enterprise (multi-client governance, white-label, SLAs and custom integrations). Prices need market validation; no pricing claims before costing.

## Delivery constraints

- Preserve Vista naming, Ambidexters credit, existing domain and nine-engine/five-pillar logic.
- Preserve existing tests and build; implement incremental migrations and avoid destructive rewrites of working features.
- Every shipped interactive control must have an actual function; never fake live metrics, connections, audiences, revenue or AI citations.
- Separate production capabilities, preview capabilities and planned features clearly.
- Code must be tested, documented and deployable through pull requests with rollback. No direct production code push before end-to-end verification.
- No source secrets, customer PII, proprietary data or unapproved licensing in this public repository.
