# Provider setup contracts

This is the setup VisTa needs from the owner for each activation provider, delivered before any credentials are requested (Issue #35). **Redirect URIs are listed only for flows VisTa has implemented.** A provider whose callback is not yet built says so; no callback path is guessed. All providers below have free developer access. Advertising spend, paid plans and publication always require the owner's explicit approval. Confirm names and steps on each official page, because consoles change.

Common prerequisites for every OAuth provider:
1. Apply `database/foundation.sql` (already in use) and `database/connections.sql` in Supabase, preview first.
2. In Vercel, set `VISTA_SUPABASE_SERVICE_ROLE_KEY`.
3. In Vercel, set `VISTA_TOKEN_ENCRYPTION_KEY`, a 32-byte key generated with `openssl rand -base64 32` and stored only in Vercel.
4. Set `VISTA_PUBLIC_ORIGIN` only for a non-production origin; the default is `https://vista.ambidexters.com`.

Refresh tokens are sealed with AES-256-GCM, bound to the organisation and provider, and never readable by browser roles.

## Google: Search Console and GA4 (R1, implemented)

| Item | Contract |
|---|---|
| Official setup | [Google Cloud credentials](https://console.cloud.google.com/apis/credentials) and [Google Auth Platform](https://console.cloud.google.com/auth/overview). Enable the **Google Search Console API** and the **Google Analytics Data API** for the project |
| App type | OAuth 2.0 Client ID, **Web application** |
| Authorised redirect URI (implemented, exact) | `https://vista.ambidexters.com/api/connections/google/callback` (for another origin: `<VISTA_PUBLIC_ORIGIN>/api/connections/google/callback`) |
| Authorised JavaScript origin | `https://vista.ambidexters.com` |
| Scopes | `openid`, `email`, `https://www.googleapis.com/auth/webmasters.readonly`, `https://www.googleapis.com/auth/analytics.readonly` (read-only) |
| Flow | Authorization code with PKCE (S256), random state in a sealed 10-minute HttpOnly cookie, `access_type=offline`, `prompt=consent`. Disconnect revokes the grant at `oauth2.googleapis.com/revoke` |
| Environment variables | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `VISTA_TOKEN_ENCRYPTION_KEY`, `VISTA_SUPABASE_SERVICE_ROLE_KEY` (optional: `VISTA_PUBLIC_ORIGIN`) |
| Eligibility | A Google account with access to at least one Search Console property (and a GA4 property for analytics) |
| Test accounts | While the consent screen is in **Testing**, add each Google account as a test user. Google expires refresh tokens issued in Testing after 7 days, so publish (and complete verification for the sensitive scopes) before relying on long-lived connections |
| Expected cost | None. The APIs are free within Google's quotas |
| Smoke test | 1. Sign in to VisTa as an organisation owner. 2. Studio → *Search & analytics* → **Connect Google**. 3. Approve. VisTa returns with `connection=connected`. 4. Choose a property; VisTa lists the last 28 days of queries and pages labelled *Measured* (source: Google Search Console API). 5. **Disconnect**: the response reports `revokedAtGoogle: true` |
| Not yet built | URL Inspection, sitemap submission (with explicit approval), GA4 tenant reports, and rank tracking from stored Search Console history (R1 continues) |

## Planned providers (callbacks not yet implemented)

| Provider | Release | Official setup | App type and access | Scopes or permissions (planned, read-only first) | Eligibility, test accounts and cost |
|---|---|---|---|---|---|
| HubSpot | R2 | [developers.hubspot.com](https://developers.hubspot.com/) | Developer account; public app with OAuth | CRM contacts, companies, deals and tasks (read; write only after approval, with dry-run and receipts) | Free developer account and test portal; available APIs depend on the customer's HubSpot plan |
| Google Ads | R3 | [Google Ads API access](https://developers.google.com/google-ads/api/docs/access-levels) | Same Google Cloud OAuth client plus a developer token from a Google Ads manager account | `https://www.googleapis.com/auth/adwords` | A test-account developer token works with test accounts only; Basic or Standard access needs an application. No API fee; media spend only with explicit approval; campaigns are created paused |
| Meta (Facebook, Instagram) | R3–R4 | [Meta for Developers](https://developers.facebook.com/) | Business app; Marketing API | `ads_read`, `ads_management`, `business_management`; Instagram and Pages publishing permissions for organic content | App Review and business verification for advanced access; no API fee |
| LinkedIn | R3–R4 | [LinkedIn Developers](https://www.linkedin.com/developers/) | Developer app; Advertising API access request (Development tier first) | `r_ads`, `r_ads_reporting`, `rw_ads`; Community Management API for organic posts | Access approval per tier; no API fee |
| Microsoft Advertising | R4 | [Microsoft Advertising API](https://learn.microsoft.com/advertising/guides/get-started) | Microsoft Entra app registration plus a developer token | `https://ads.microsoft.com/msads.manage` | Sandbox available; no API fee |
| TikTok | R4 | [TikTok API for Business](https://business-api.tiktok.com/) | Marketing API developer app | Ads management and reporting scopes granted at app approval | App approval; no API fee |
| YouTube | R4 | [YouTube Data API](https://developers.google.com/youtube/v3) | Google Cloud OAuth client (as above) | `https://www.googleapis.com/auth/youtube.readonly` (uploads need `youtube.upload` and an audit) | Free within quota |
| Shopify | R1–R2 | [Shopify Partners](https://www.shopify.com/partners) | App in the Partner Dashboard (OAuth) or a store's custom app | `read_products`, `read_content`; `write_content` only for approved remediation | Free development store for testing |
| WordPress | R1 | The owner's own WordPress site | Application Passwords (WordPress 5.6+); no OAuth | REST API for posts, pages and metadata, as a dedicated least-privilege user | An owned test site; changes are proposed, approved and reversible |
| GitHub | R1 | [GitHub Apps](https://docs.github.com/apps) | GitHub App installed on the target repository | `contents: write`, `pull_requests: write` (pull requests only, never direct pushes to the default branch) | Free |
| Stripe | R5 | [Stripe Dashboard](https://dashboard.stripe.com/) | Test-mode keys and a webhook endpoint | Products, prices, subscriptions, usage records | Test mode is free; live mode charges per transaction and requires owner approval |
