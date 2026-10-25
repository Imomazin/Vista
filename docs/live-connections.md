# VisTa Live Source Integration Runbook

## Current status
Adapters and test UI are implemented on the development branch, but the project cannot return live provider data until it has credentials and authorised data access. At verification on 25 October 2026 Vercel had zero project environment variables. Configured does not mean a live connection; an actual source request must succeed.

## Minimum shared infrastructure
- Configure VISTA_SUPABASE_URL and VISTA_SUPABASE_ANON_KEY for verified member sign-in and organisation membership.
- Apply database/foundation.sql and relevant existing migrations to the authorised Supabase database.
- Use the Connections tab in VisTa. It displays Not connected, Credentials configured or Live test passed. Read requests require session, organisation membership and rate limits. Credentials stay on the server, not in public Github.
- Current Google/CRM server credentials are project-scoped, not per-customer. Do not onboard multiple customer tenants until per-org token vault and OAuth authorisation is implemented.

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
