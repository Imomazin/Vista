# VisTa Marketing Superior Intelligence Ecosystem

Marketing Superior Intelligence. Reimagined.

An Ambidexters technology.

## Product ambition

VisTa connects marketing evidence, strategic decisions, execution and measured outcomes across organisations, agencies and channels. The nine engines define its initial capability families. Each can support multiple specialist services and workflows.

## Shared operating model

The ecosystem revolves around organisations, projects, audiences, entities, goals, evidence, opportunities, actions, experiments and outcomes. Every recommendation should reference its underlying evidence and collection time. Every external action should identify the approving user, destination and result.

The operating cycle is observe, interpret, prioritise, approve, execute and measure. Scheduled discovery can propose work; publication, expenditure and outreach require explicit permissions and approval controls.

## Capability families

| Engine | Capabilities | Evidence and dependencies |
| --- | --- | --- |
| Search visibility | Query discovery, page opportunities, competitors, local and international search | Search Console, licensed ranking data, locale and date |
| Impact intelligence | Conversion journeys, experiments, lead quality, revenue attribution | GA4, CRM, consented events, documented attribution model |
| Site intelligence | Page audits, crawl coverage, technical change detection, accessibility checks | Retrieved responses, rendering, crawl policy, performance measurements |
| Content studio | Briefs, editorial workflow, source checking, optimisation, approved publishing | Keyword evidence, source references, editorial ownership, channel permissions |
| Authority graph | Organisation and author entities, identity consistency, evidence mapping | Verified identity sources and provenance for each relationship |
| Reputation intelligence | Coverage discovery, mentions, sentiment, PR opportunities | Licensed monitoring sources, verified contacts, outreach approval |
| Agency operations | Client portfolios, roles, permissions, reports and service workflows | Tenant isolation, membership checks, branding and audit logs |
| Analytics intelligence | Common metrics, source reconciliation, reporting and alerting | Source timestamps, currency and timezone alignment, metric definitions |
| AI exposure | Repeatable prompt sets, citation evidence, provider comparisons | Provider APIs, exact prompts and responses, sampling context and limits |

## Current release

The browser workspace includes projects, saved HTML audits, comparisons, actions, editable editorial templates, manual AI observations and validated backup import/export. It makes no cloud persistence or automatic AI monitoring claim.

## Next engineering milestones

### Shared identity and storage

Choose and configure an identity provider and managed database. Implement organisations, memberships and project permissions before accepting shared customer records. All project reads and writes must validate membership on the server. Store customer work outside the public repository. Add database migrations, backups, retention controls and tenant-isolation tests.

### First-party data

Implement server-side OAuth using minimal read-only scopes, state validation and encrypted token storage. Support property selection, disconnect, token revocation and refresh failure recovery. Normalise Search Console and GA4 records while retaining source definitions. Display collection time and avoid comparing incompatible time windows.

### Evidence-linked recommendations

Persist evidence and rule versions for each recommendation. Distinguish measured facts, hypotheses and user-entered observations. Prioritise by demonstrated impact, confidence and effort. Validate outcomes against a baseline after implementation.

### AI exposure monitoring

Support configured providers and versioned prompt sets. Record provider/model, sampling time, country when known, exact response and citations. Report sample counts and repeated observations. Avoid extrapolating universal visibility from a small sample.

### Controlled execution

Add content approvals, publishing adapters and campaign experiments. Use preview, approval, execution receipt and rollback where supported. Keep budgets, recipient lists and channel permissions explicit.

## Release measures

Track time to first verified insight, actionable findings resolved, repeat-scan improvements, editorial completion, qualified conversions where connected, and customer retention. Track data freshness and failed integrations alongside business outcomes.
