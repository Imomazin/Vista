# VisTa Live Source Integration Runbook

## Current status
Adapters and test UI are implemented on the development branch. The dedicated VisTa Supabase London project and its verified Ambidexters application Owner are operational, and Supabase URL/publishable key are configured on the Vercel development **preview branch only**. The application now supports magic-link redirect to `/auth/callback` and an optional six-digit email code. The authentication and cloud-save journey needs a final real-user browser check. Google Search Console, GA4, HubSpot and OpenAI provider credentials have not been authorised, so those external-data integrations remain inactive. Configured does not mean a live provider connection; an authenticated source response must succeed.

## VisTa Intelligence Google project activation (26 October 2026)
- Dedicated Google Cloud project **VisTa Intelligence**, project ID `vista-intelligence`, number `639180933626`, established under the authorised `imomazin.ae@gmail.com` account.
- Google Search Console API has been enabled. Google Analytics Data API enablement and a dedicated read-only service account are in progress. The existing GSC Wizard integration lists `sc-domain:imoenang.com`; it does not by itself grant VisTa app credentials.
- **Security safeguard:** `VISTA_PROVIDER_ORGANISATION_ID` restricts server-configured provider credentials to one pre-approved organisation, and the API further requires an authenticated `owner` role. This is an interim control, not multi-client OAuth.
- No cloud service-account private key, GA4 property permission, HubSpot app token or funded OpenAI account has yet been supplied. Never mark those feeds live until their real API tests succeed.
- When service account creation completes, grant it Search Console access to the actual owned property and GA4 Viewer access to the correct numeric property, then configure the restricted credentials via encrypted Vercel environment settings.
- **Billing controls:** Do not deploy a scheduled AI worker or paid API sampling merely because its implementation exists; wait for explicit provider funding and intended sample frequency.

## Google provider setup audit — 26 October 2026
- Google Cloud project `vista-intelligence` created under `imomazin.ae@gmail.com`; both **Google Search Console API** and **Google Analytics Data API** have been independently confirmed ENABLED. No billing or paid products were activated as part of that setup.
- Dedicated service account `vista-readonly-intelligence@vista-intelligence.iam.gserviceaccount.com` exists without project IAM roles or private keys.
- Google Search Console URL-prefix property `https://vista.ambidexters.com/` is **OWNER VERIFIED** via a deployed `google-site-verification` HTML meta tag; the tag must remain deployed. The property is registered in the linked GSC Wizard account and Google owner remains `imomazin.ae@gmail.com`.
- The service account has **Restricted** Search Console permission for that property, and no ownership or editing rights. The new URL-prefix property was independently verified as an owner in Google Search Console and registered through GSC Wizard on 26 October 2026. The Search Console API data is still initially processing, so zero returned rows are not proof of zero website traffic.
- Vercel production has `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SEARCH_CONSOLE_SITE_URL` and `VISTA_PROVIDER_ORGANISATION_ID`; `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` has **not** been set. Therefore the app's GSC connection cannot yet make an authenticated query despite the external property setup being complete.
- Google Analytics Data API **ENABLED** was verified on the project management page. The connected Google login has **no Ambidexters or VisTa Analytics account**. The attempted new company account creation was stopped before accepting Google Analytics binding Terms of Service; the authorised account holder must review and accept these terms. No analytics tracking pixels have been placed on the site.
- The linked Google account has one existing GA4 property named `Imowo Enang - GA4` (`properties/296462811`), which is a separate personal property and has NOT been silently configured as VisTa or Ambidexters analytics. Before GA4 can report on VisTa, create or select the correct company property, grant the service account Viewer access and configure its numeric property ID.
- Avoid exposing the Google service-account JSON key in GitHub, public browser responses or conversation messages. Prefer keyless federation where feasible; otherwise create a restricted key and deliver it directly into encrypted provider secrets, rotate it and monitor usage.

## GA4 activation update — 26 October 2026
- Google Analytics account **Ambidexters** (account ID **413424624**) and GA4 property **VisTa Marketing Intelligence** (property ID **560772567**) were independently confirmed through the connected Google account, separate from the existing personal property.
- The dedicated Google service account `vista-readonly-intelligence@vista-intelligence.iam.gserviceaccount.com` was granted **Viewer** permission on GA4 property 560772567 and verified in the Access Management list. It has no GA4 Editor/Administrator role.
- The existing web stream **VisTa Website** has measurement ID `G-8HXNC966L2`; its URL was corrected from HTTP to **https://vista.ambidexters.com** and the updated value verified in Google Analytics Admin.
- Vercel production configuration now includes `GOOGLE_ANALYTICS_PROPERTY_ID=560772567` and public `NEXT_PUBLIC_VISTA_GA4_MEASUREMENT_ID=G-8HXNC966L2`. The browser analytics loader in `src/app/analytics-consent.tsx` does **not load GA4 until visitors opt in** and provides ongoing preferences.
- Historical reporting is currently expected to be empty until visitors explicitly consent and Google processes traffic. Do not confuse GA4 reporting API permission with an activated data collection stream.
- An end-to-end read-only production Google API token exchange (Vercel OIDC to GCP STS / impersonated service account) still requires successful secret-protected runtime testing. Do not mark this connection as verified live based only on the configured environment and property access.

## Minimum shared infrastructure
- Configure VISTA_SUPABASE_URL and VISTA_SUPABASE_ANON_KEY for verified member sign-in and organisation membership.
- Apply database/foundation.sql and relevant existing migrations to the authorised Supabase database.
- Use the Connections tab in VisTa. It displays Not connected, Credentials configured or Live test passed. Read requests require session, organisation membership and rate limits. Credentials stay on the server, not in public Github.
- Current Google/CRM server credentials are project-scoped, not per-customer. Do not onboard multiple customer tenants until per-org token vault and OAuth authorisation is implemented.

## Development login verification
1. Open the latest Vercel preview build at the Workspace > Connections route in a browser with preview access.
2. Enter the verified VisTa Owner email and choose Send sign-in code; Supabase may send an email **magic link** by default, not a numeric code.
3. Open the newly generated email link in the **same browser**. The server requests a Supabase redirect to the current preview host at /auth/callback, avoiding the old localhost-only setting.
4. The callback removes the authentication fragment, validates Supabase user identity and organisation membership server-side, sets an HttpOnly secure cookie and redirects to the cloud workspace.
5. Inspect the Ambidexters cloud checkpoint. Test a deliberate empty/known backup preview and confirmed cloud save. Do not infer successful end-to-end login from unit tests alone.
6. A missing authentication token or a cross-origin write must be rejected. Keep Vercel preview protection enabled. Production is unchanged.

## GSC
- Enable Search Console API in an authorised Google Cloud project.
- Create a service account and grant its email user access to the exact verified Search Console property.
- Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_SEARCH_CONSOLE_SITE_URL as server secrets. Property may look like sc-domain:example.com or https://www.example.com/ (with trailing slash).
- The adapter signs a short-lived OAuth JWT and requests up to 25 queries for the last 28 complete reporting days using webmasters.readonly. It reports real clicks, impressions, CTR and position; it does not invent organic traffic or indexing results.

## GA4
- Enable Google Analytics Data API; add the same service account as GA4 property Viewer.
- Configure GOOGLE_ANALYTICS_PROPERTY_ID (numeric property number, NOT the G- measurement ID).
- The read-only adapter requests channel-level sessions, users and key events for 28 days, with scope and collection time.

## CRM
- Initial CRM integration is HubSpot, not Salesforce or Dynamics.
- Create HubSpot Private App with read-only crm.objects.contacts.read and crm.objects.deals.read scopes.
- Configure HUBSPOT_PRIVATE_APP_TOKEN privately. The API reads a bounded set of 20 contacts and 20 deals with minimised fields. These are samples, never CRM totals or attributed pipeline.
- Other CRM vendors require separate adapters and authorisation.

## AI real-answer sampling
- Configure OPENAI_API_KEY and optionally OPENAI_SAMPLING_MODEL with a supported Responses API model and funded account.
- Manual test sends an exact question and saves no provider response remotely by default. The response contains actual returned text, timestamp, literal brand mention, model name and only citations actually annotated by the provider.
- One sample is not a representative ranking. Do not manufacture citations or factuality scores.

## Automated daily sampling
- Apply database/ai-exposure.sql to the authorised Supabase project.
- Set server secrets VISTA_SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (32+ unpredictable characters), VISTA_AI_SAMPLING_ORGANISATION_ID, VISTA_AI_SAMPLING_BRAND and VISTA_AI_SAMPLING_PROMPTS (JSON array of 1–3 approved questions, each 12–900 characters).
- Production configuration vercel.json specifies a daily run at 08:00 UTC using /api/integrations/ai-sampler. PR previews do not activate this cron. The worker authenticates the cron secret, calls the real AI provider and persists dated responses and actual citation annotations to the organisation table.
- The Connections tab can review saved sample history once cloud identity and database table are configured.
- Monitor spending, errors and model version changes. Keep production unchanged and do not approve recurring API spend without the owner's authorisation.

## Proof required to call each source live
A signed-in authorised organisation member must click Test live connection and receive source-labelled real provider data. For recurring AI, prove that a post-cron row appears in the correct organisation with actual prompt and source. Missing keys, property permissions, cloud login or database schema mean NOT LIVE.

See .env.example for every required configuration key. Never put secret values in a public repository or browser localStorage.
