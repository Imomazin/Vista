# VisTa | Real Ambidexters Nine-Engine Validation

**Test target:** https://ambidexters.com
**Date:** 25 October 2026
**Method:** Live, unauthenticated public HTTPS fetch via VisTa's own safe-fetch + analyseHtml source code running in an isolated Vercel sandbox. Independently checked public navigation and page content through a browser automation session. No site records changed and no contact forms submitted.
**Status:** Actual live HTML findings; unavailable provider data is identified explicitly, never simulated.

## Five tested URLs

| Page | Actual observed title | H1 count in retrieved raw HTML | Canonical declared | Nine-signal HTML score after canonical validation fix |
| --- | --- | ---: | --- | ---: |
| https://ambidexters.com/ | Ambidexters | 0 | https://ambidexters.com | 89/100 |
| https://ambidexters.com/about-us | About \| Ambidexters | 0 | https://ambidexters.com | 83/100 |
| https://ambidexters.com/services | Services \| Ambidexters | 0 | https://ambidexters.com | 83/100 |
| https://ambidexters.com/contact | Contacts \| Ambidexters | 0 | https://ambidexters.com | 83/100 |
| https://ambidexters.com/projects/thehost | Ambidexters | 1 | https://ambidexters.com | 89/100 |

These are transparent *HTML technical checks*, not search rankings or overall SEO scores.

### Verified technical findings

1. **All four internal pages point their canonical to the homepage.** This is significant enough to review: if intentional consolidation is not wanted, set a self-canonical for each indexable page. VisTa's original audit mistakenly passed canonical URLs when same-host even if wrong page. This is now corrected and regression-tested.
2. **Same meta description appears across all five inspected raw HTML responses**, making the pages less differentiated. A new multi-page investigation check detects this duplication.
3. **Raw HTML has 0 H1 headings on homepage, About, Services and Contact.** The browser automation observed headings in rendered views; this difference suggests some headings are client-rendered or interpreted differently. HTML analysis is correct *for the response it fetched*; it must not be represented as the rendered page's definitive heading structure without further DOM comparison.
4. All five raw HTML pages have a declared viewport, Open Graph title, at least one parseable typed JSON-LD block and meta description. The separate rendered-browser automation did not identify some head tags: treat this as a tooling/DOM-observation difference, not proof they are absent.
5. TheHost project URL uses generic page title "Ambidexters" rather than project-specific language. Homepage title is only 11 characters.
6. Retrieved pages did not expose missing img alt attributes: homepage 72 images, About 8, Services 22, Contact 7, TheHost 6; all had alt attributes, including possibly empty alt for decorative images.
7. Company founding year appeared as 2023 on both homepage and About in the browser observation. The company About timeline reportedly lists AmbiSight in 2022; this may represent a precursor project, not necessarily an error. Verify chronology with management before calling it a contradiction.
8. Homepage advertises 99% satisfied clients, 30+ industries and 10+ countries; these are **on-page self-reported claims**, not independently validated commercial or client data.
9. Contact has a form with first name, last name, email and message; no form submission was performed. Social links for LinkedIn and Instagram are visible.

### Nine-engine decision record

| Engine | Real output for Ambidexters | Evidence status / limits | Recommended first action |
| --- | --- | --- | --- |
| 1 Search Visibility | Five raw page titles, shared canonical values, repeated description patterns and discoverability-related site issues | **Partial**; GSC impressions, CTR, clicks and ranking not accessible until property authorisation | Correct page-level canonical/title issues, then compare actual Google Search Console query performance |
| 2 Impact Intelligence | Contact enquiry route and CTA structures publicly observed | **Partial**; no consented GA4 conversion tracking or CRM lead/revenue evidence | Define form-submit key event, test the form appropriately with permission and agree CRM lead lifecycle |
| 3 Site Intelligence | Five live HTTPS page audits, nine technical checks each, scores 89/83/83/83/89 after canonical fix | **Verified public HTML**; no rendered JS test/performance metrics | Fix homepage-pointing internal canonicals, distinguish repeated descriptions and investigate missing raw H1 elements |
| 4 Strategic Content Studio | Public services and About themes, project catalogue and generic/duplicated metadata offer specific content brief topics | **Local analysis available**; publishing integrations and content conversion measurement unconnected | Create differentiated service and project briefs supported by actual source links |
| 5 Trust and Authority Graph | Public Ambidexters name, site, 2023 founding statements, project timeline to check and source-linked project pages | **Manual and public evidence**; no automatic third-party entity validation | Confirm chronology of AmbiSight launch versus business founding; document reliable third-party authority sources |
| 6 Reputation Intelligence | Public social/profile links and stated customer satisfaction claim | **Public links/self-report**; no earned-media crawler, trusted independent coverage dataset or sentiment series | Verify third-party mentions and document source/recency before inferring reputation |
| 7 Agency Operations | Services, project list and candidate site issues supply actionable workstreams | **Browser-local action/project management available**; no shared tenant unless Supabase is configured | Create project, assign canonical/metadata remediation tasks and record re-scan evidence |
| 8 Analytics Intelligence | Five technical audit scores and measured source metadata for comparative tracking | **HTML technical metric only**; GA4 and Search Console analytics not connected | Establish connected reporting properties, import comparable validated datasets or perform repeat technical scans |
| 9 AI Exposure / GEO | At least one typed JSON-LD block observed on each scanned page | **Technical evidence only**; zero actual sampled AI answers or citations without authorised provider API | Run exact, dated multi-provider brand prompts using approved credentials; record answers and citations, not invented AI visibility percentages |

### Connection readiness

Provider API adapter and authenticated Connections UI are implemented in the development branch. Server configuration was empty when checked: **no Supabase, GSC, GA4, HubSpot or OpenAI credentials were configured in the Vercel project**. No completed live connection or sample result should therefore be implied.

Available code:
- src/lib/external-integrations.ts
- src/app/api/integrations/route.ts
- src/app/connection-centre.tsx
- src/app/api/integrations/ai-sampler/route.ts
- src/app/api/integrations/ai-samples/route.ts
- database/ai-exposure.sql
- docs/live-connections.md

## Defects corrected during this validation

- Canonical self-page mismatch detection was added to the site audit, reducing false passes for internal pages.
- Multi-page investigation now identifies repeated meta descriptions, duplicate page titles and shared canonicals separately.
- Automated regression tests were added for both.

## Gating criteria for full enterprise release

- Authorised, tenant-scoped provider access with secure server-side credentials and audited source lineage;
- GSC / GA4 / CRM real requests succeed on the correct brand properties, respecting data/privacy boundaries;
- AI sampling executes under approved schedule and records actual output and citation annotations;
- Browser end-to-end navigation, forms, mobile screen captures and reduced-motion/theme tests pass;
- Continuous integration and Vercel build pass on the final development commit;
- User explicitly approves production release.

Production remains unchanged. This report contains observations, not the assertion that all nine providers or engines are fully live.
