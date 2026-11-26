# VisTa usability repair: 26 November 2026

## Delivered
- Explicit Porcelain foreground/background pairs for audit findings, page facts, decision cards, measurement tables, controls and image captions.
- Single-page audit exposes extracted links, language alternates, JSON-LD entities and static accessibility observations through Site Observatory.
- Audit findings CSV includes source URL, observation time, status, evidence and next action. Cells beginning with spreadsheet formula characters are escaped.
- Real Unsplash photographs by Walls.io and Paolo Resteghini are served locally in Command Centre and all nine studio introductions. Source records accompany assets.
- BoT audit walkthrough targets URL input, launch control and results. Missing controls produce guidance. Highlighting collapses the panel to reveal the target. Stalled answer requests time out.
- Next.js updated from 16.4.2 to 16.4.6. npm audit returned zero known vulnerabilities.

## Verification
- 93 automated tests passed, including CSV injection protection and audit walkthrough selectors.
- TypeScript check and production build passed.
- Vercel preview deployments reached READY.
- Browser checks: live public-page audit, page metadata, accessibility tab, save to project, recording review evidence, retained project/audit counts, Command Centre to studio navigation, real photograph loading and CSV download.
- BoT URL input received the highlight class on the final preview.

## Outstanding acceptance checks
- Full button-by-button matrix across all nine engines, desktop and mobile.
- Authenticated BoT answer requests, provider requests, cloud checkpoint save/restore and tenant/role boundaries in the deployed environment.
- GSC/GA4 reports with populated rows; successful access alone does not prove collection or useful report data.
- HubSpot and AI provider requests with authorised live accounts.
- Scheduled jobs and repeat measurements.
- Rendered-page crawling, performance measurements and independent indexing verification are outside the current HTML audit.
- BoT provides navigation and explanations. It does not execute arbitrary marketing tasks.
- Two new photographs are reused across studios; a broader discipline-specific photography collection remains desirable.

This release improves existing functions. It does not establish that every platform capability is complete.
