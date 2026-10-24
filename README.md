# VisTa

Marketing Superior Intelligence. Reimagined.

An Ambidexters technology.

VisTa is an integrated marketing intelligence platform organised around five strategic pillars and nine interconnected engines. The product combines search visibility, commercial impact, technical optimisation, content strategy, brand authority, digital reputation, agency operations, analytics and AI exposure.

## Five pillars

- V: Visibility
- I: Impact Intelligence
- S: Search and Site Optimisation
- T: Trust and Authority
- A: Agencies, Analytics and AI Exposure

## Nine intelligence engines

1. SEO and Search Visibility Intelligence
2. Conversion and Revenue Intelligence
3. Technical SEO and Website Audits
4. Strategic Content Studio
5. Brand Authority and Entity Intelligence
6. Digital PR and Reputation Intelligence
7. Agency and White-Label Intelligence
8. Digital Analytics and Performance Intelligence
9. AI Exposure and Generative Engine Optimisation

## VisTa nine-element evolution

The development branch adds a cinematic transition from the VisTa wordmark into nine labelled, orbiting intelligence elements. The constellation is interactive and the nine-element navigation dock remains available inside the application. Users can open each engine's value dashboard, review practical decision criteria, complete four diagnostic questions and log evidence against a saved project.

Each engine has a source-aware local evidence ledger with observation date, manual categorisation, HTTPS source URL, implications, actions, review stage, filters, exports and version-validated imports. Self-assessment results are explicitly labelled hypotheses and are not automatically verified by the platform. The Command Centre includes a cross-engine matrix with truthful per-engine source status and counts. These capabilities extend existing audit, content, comparison, project and action workflows.

The nine-element UI does not imply that nine external data sources are connected. Only public HTTPS HTML audit measurement currently runs as a live retrieval. Search Console, GA4, automated AI provider sampling, CRM and media intelligence require authenticated, authorised integrations. Browser-local data does not synchronize across users or devices. Do not store sensitive client records in this local-only beta.

Development and Work continuation instructions are in docs/vista-master-work-brief.md. The main production branch is kept separate while preview, accessibility and end-to-end testing remain open.

## Origin release

- Obsidian, pearl and mint visual system with a dimensional animated V emblem
- Pointer-responsive depth, orbit motion, animated transitions and reduced-motion support
- Command palette, interactive engine map and responsive mobile navigation
- Live comparison of up to three public webpages, with per-site error reporting and exports
- Local draft analysis for structure, reading time, topic mentions and source URLs
- Automatic browser-local draft saving

## Workspace release

- Project portfolios with audience and commercial objectives
- Saved HTML audits, repeat-scan comparisons and downloadable evidence
- Prioritised actions with completion tracking
- Editable content briefs and editorial stages
- Manual AI response observations with timestamps and source links
- Versioned JSON workspace backups with import validation

Workspace records are stored in browser localStorage. They do not sync across devices or users. Export backups before clearing browser data. Audit history retains the latest 100 scans across the workspace. Cloud accounts, tenant access controls, Google connections and automated AI sampling are not implemented. No external metrics are fabricated.

## Site intelligence

The initial release includes a responsive dashboard, a nine-engine directory and a working HTTPS website audit. It measures nine HTML signals and provides actionable findings.

The audit score is limited to observable HTML signals. It is not a Google ranking, an AI visibility measurement, a traffic estimate or a commercial forecast. The other engines are labelled as planned.

## Local development

Requires Node.js 22 or later.

- Install packages: npm install
- Start locally: npm run dev
- Open http://localhost:3000
- Type checking: npm run typecheck
- Production build: npm run build

## Architecture

- src/app: Next.js application and audit endpoint
- src/lib: nine-engine catalogue, HTML analysis and secured outbound retrieval
- docs: product development roadmap

## Security

The beta audit only fetches publicly resolvable HTTPS webpages on standard port 443. Private and reserved IPv4 destinations, redirects to private hosts, IP-literal URLs, large pages and lengthy requests are blocked. JavaScript rendering and IPv6-only websites are not currently supported.

Basic in-process throttling is a development measure only. Before exposing the audit API to broad public traffic, add production-grade edge rate limits, request quotas, observability and authentication.

Never commit environment secrets, unpublished research, customer data or proprietary datasets.

## Intellectual property

Copyright 2026 Ambidexters. All rights reserved.

This repository is publicly visible and no open-source licence is granted. Commercial copying or reuse requires permission. VisTa is a working product name pending appropriate trademark clearance.

## Evidence and execution

The action board groups current findings by project and exact page URL. Owners, due dates, notes and delivery stages persist across scans and workspace backup exports. A passing HTML check marks tracked work verified; a newer failing scan flags work previously marked ready for verification. Filters and Markdown register exports support review. Each finding can create an editable evidence brief in the editorial pipeline. Owners are local labels, with no notification delivery. Existing version-one backups remain compatible.
