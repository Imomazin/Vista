# VisTa | Titanium + Emerald Master Visual Identity and Execution Brief

## Status and governing decision

This is the definitive visual direction for **VisTa**, an Ambidexters technology positioned as **Marketing Superior Intelligence. Reimagined.**

**Master visual identity:** Titanium + Emerald Intelligence.
**Dark environment:** VisTa Obsidian Titanium.
**Light environment:** VisTa Porcelain Titanium.

Titanium is the structure; emerald is the intelligence. Metallic neutrality must visually dominate. Emerald is used selectively to indicate focus, activation, live signals, meaningful connections and brand identity. Neither environment should look like a uniformly green dashboard. The light identity must be purpose-designed, not created by colour inversion.

The goal is a striking but trustworthy product: an executive intelligence theatre with genuinely readable, actionable marketing analysis. Luxury comes from purposeful movement, excellent materials, coherence and restraint.

This document unifies the creative brief, design system specification and implementation/verification contract. It supersedes earlier exploratory visual palettes, but does not supersede the functional/security product requirements.

## Repository, source of truth and safety boundaries

Repository: Imomazin/Vista. Current feature branch: vista-cinematic-intelligence; draft pull request #1. Production branch: main. Vercel project: vista; designated domain: vista.ambidexters.com.

Before modifying, inspect the actual current branch and all files. Read docs/visual-system.md, docs/vista-master-work-brief.md, docs/ecosystem.md, README.md, src/app/appearance.css, src/app/appearance-switch.tsx, src/app/experience.tsx, src/app/ecosystem.tsx, src/app/cinematic-pearl.tsx, src/app/pulse.tsx and all relevant page/workspace components.

Existing Obsidian/Porcelain theme switching, responsive constellation, wordmark-to-nine-elements scene, rotating V, persistent navigation, real HTML audits, local evidence ledger and connected workflow interfaces must be preserved and improved. Do not replace a functioning component with a mockup. Do not merge to main or promote production without verified acceptance and user authorisation.

## One design language, two premium atmospheres

### Obsidian Titanium — dark cinematic theatre

Atmosphere: midnight mineral black, architectural graphite, soft dark metallic surfaces, titanium frames, bright platinum speculars, discreet champagne reflections and living emerald energy.

The room feels physically deep: softly focused lighting, deliberate perspective, reflective beveled V geometry, ambient dust or particle effects only at salient moments and real measured visualisations. Dark panels should be neutral charcoal, not tinted green across their whole surface.

### Porcelain Titanium — light architectural studio

Atmosphere: warm white and alabaster, pale ivory, satin titanium, silver edges, careful natural-looking shadow, immaculate editorial contrast, a small number of emerald signals and very restrained champagne warmth.

The light theme should feel as premium and cinematic as the dark one. Its 3D pearl and titanium surfaces get independently tuned lights, material response, shadows and reflections. It must never be the dark scene brightened with a CSS filter.

### Approved working palette (implementation starting point, adjust after visual QA)

| Semantic purpose | Obsidian Titanium | Porcelain Titanium |
| --- | --- | --- |
| App canvas | #090D12 | #F8F7F2 |
| Raised canvas | #111820 | #F0F2ED |
| Primary card surface | #172027 | #FFFFFF |
| Elevated glass layer | #233139E8 | #FFFFFFDE |
| Main text | #F2F5F4 | #19332D |
| Supporting text | #A1B3B0 | #526F64 |
| Delicate frame/border | #B3C5C332 | #41685632 |
| Titanium material | #BAC8CD | #85969A |
| Polished platinum | #EDF5F2 | #E6ECE8 |
| Emerald action/signal | #68E1B4 | #136C50 |
| Emerald secondary | #239B78 | #248667 |
| Subtle champagne accent | #CEAF7E | #967243 |
| Focus outline | #8CECC1 | #136C50 |
| Critical alert | #FF979A | #B23A45 |
| Caution alert | #F3C879 | #87571C |
| Informational accent | #9BCAE8 | #276A8D |

Colours above are working design tokens, not permission to use every swatch at once. Verify foreground/background contrast for the actual component and state. Dark emerald text needs a contrasting light surface; luminous emerald on a dark surface is an active signal. Champagne is limited to metallic reflection/micro-details and is not a second primary colour.

### Composition ratio

Use an approximate **75% neutral / 18% metal and glass / 7% emerald or other signal colour** composition for high-density interfaces. This is artistic guidance, not literal CSS coverage.

- The dominant visual field is neutral titanium/graphite/porcelain.
- Emerald belongs to the signature T, active selection, intelligence propagation, verified source pathway, main CTA and primary data series.
- Warnings, errors, declines and uncertainties use independently readable semantic colours and labels. Do not conflate emerald branding with all forms of success.

## Token architecture and code standards

Consolidate component-specific literals into a semantic theme foundation and shared material/component tokens. Retire duplicate overrides incrementally without breaking working routes.

Required token families:
- Foundations: app background, rail, topbar, surface, raised surface, inset surface, overlay, scrim, grid, border, foreground, muted foreground and strong foreground.
- Metal: titanium-light, titanium-mid, titanium-shadow, platinum-edge, shell-highlight, reflective-sheen and champagne-specular.
- Emerald: brand-reflection, interactive-primary, active-indicator, signal-path, node-energy, focus, selected-series and on-emerald.
- Semantic data: positive/negative/critical/warning/info/unavailable/manual/hypothesis/verified, each with icon/label strategies.
- Elevation: grounded, elevated, floating and ceremonial surfaces; blur or backdrop-filter only where supported and performant.
- Charts: foreground grid, muted comparator, primary series, selected series, highlighted interval, tooltip, error band and confidence interval.
- Motion: fast, standard, deep-focus, cinematic; easing, blur limits and transform distances.
- Typography: display, editorial heading, body, caption, monospaced data, label, button and chart-legend styles.

Build shared components or tokens for Button, IconButton, ThemeSwitcher, SurfaceCard, GlassOverlay, SignalBadge, EvidenceStatus, MetricTile, ChartTooltip, PanelHeader, TextInput, Select, Dialog, EmptyState, LoadingState, EngineNode and EvidenceConnector.

Ensure theme switch updates one authoritative document-level state, persists to a non-sensitive local preference, honours system preference when there is no explicit choice, works across tabs and does not flash the wrong theme at startup. Keep an accessible text label for each mode.

## VisTa's signature cinematic choreography

### Sequence A — The question

Open with: “What if your next advantage is hiding in plain sight?” Use confident restrained editorial typography, a quiet physical atmosphere and deliberate lighting. The opening must stay legible immediately.

### Sequence B — The titanium wordmark

The exact spelling is **VisTa**. The V and T are capitalised. The wordmark arrives as precise, well-weighted metallic typography with physically convincing beveled treatment. The **T** is the signature: its edges catch an emerald reflection or charge, but the whole word should not become a green neon sign.

Use a premium rotating machined-metal V with realistic light response. The current Canvas implementation may remain if it delivers the better tradeoff; only add WebGL/Three.js/React Three Fiber when the visual improvement is verified and fallback, bundle size and performance budgets are maintained.

### Sequence C — Wordmark becomes nine intelligence elements

The capital T initiates a coherent emerald energy transfer through the wordmark. Controlled emission, luminous paths and particles separate into nine destination signals. This must be a true visual narrative, not a hard cut to nine cards.

Each signal travels along a uniquely choreographed curve and resolves into one of the nine engine nodes. Preserve spatial identity so the user understands how the brand becomes the intelligence universe. Dark uses clear emerald luminescence; light uses jade-tinted refraction against pearl and platinum. Keep text and destination elements visible at the end.

### Sequence D — Living constellation

Nine titanium/pearl nodes orbit or align in a composed intelligence constellation around the core. Resting state: exquisite and quiet. Hover, keyboard focus or selection: one node advances, its genuine relationship paths illuminate and relevant intelligence details appear. Related paths dim gracefully when focus moves. Do not depict unverified business relationships as factual data.

### Sequence E — Enter the Command Centre

Use spatial continuity from selected node to full studio. The nine-engine navigation remains accessible; the central VisTa identity remains a recognisable navigation anchor. Return visits get a fast-entry path.

Suggested motion timing:
- Micro-reaction 130–200 ms.
- UI transitions 240–420 ms.
- Camera/depth transitions 550–900 ms.
- Full intro typically 3–4 seconds maximum, skippable instantly.
- Repeating ambience minimal and throttled; no meaningful content waits for completion of animation.

Support Escape, keyboard, mobile touch, reduced motion, optional pause, page visibility throttling and fallback without Canvas/WebGL. Do not add sound automatically.

## Spatial layout and operating density

Desktop: panoramic Command Centre with stable navigation, accessible command search, evidence summary and one deliberate hero visualisation. Use a responsive 12-column grid or equivalent and ensure no dock overlaps a card or tooltip. Main data should not be buried below theatrical decoration.

Tablet: compress navigation and data cards into two columns, keep charts intact and use discoverable tabs/drilldowns. Mobile: focus on one readable task at a time; collapse the constellation into a usable, beautiful adapted layout, while retaining entry to all nine engines and enough touch target area.

Hero experiences and visual introductions may be spacious. Working audit lists, conversion analysis, analytics tables and evidence registers should prioritise legibility, filtering, tables, ownership, source details and efficient task completion.

## Data visualisation contract

Every visual must communicate a genuine underlying relationship. If disconnected, show an exquisite but clearly labelled empty state, instrument status or example; no fictitious KPI displayed as live.

- Primary measured series: emerald; comparisons: titanium/slate. Reserve informational blue, critical red and caution amber only for their relevant meanings.
- Line charts: animation reveals source-confirmed series; axes, date scopes, units, zero bounds where appropriate and hover/focus tooltips remain legible in both modes.
- Radar/constellation: geometry describes documented technical signals or documented relations; do not imply a predictive AI/revenue score.
- Geospatial data: create a globe or map only when verifiable geographical data exists. A purely decorative globe is explicitly presented as brand ambience, not regional intelligence.
- Knowledge graphs: clearly distinguish confirmed nodes/edges, hypotheses, missing sources and user-entered records.
- AI Exposure: show measured samples, models, providers and cited pages with denominators and methodology limitations.
- Empty states: use restrained typographic, line-work or material illustrations with explicit actions for connecting authorised sources or generating the first observation.

Do not rely solely on colour to communicate status. Include text, iconography, source badge, date, method and accessible accessible chart summaries.

## Nine signature visual studios

| Engine | Signature look | Working interaction |
| --- | --- | --- |
| Search Visibility | Fine titanium demand curves with one emerald opportunity stream | Drill into verified queries, pages, country/device and date |
| Impact Intelligence | Metal-edged customer journey pathways, emerald conversion evidence | Compare measured steps, experiment baseline and attribution assumptions |
| Site Intelligence | Silver website architecture topology with priority issue highlights | Inspect exact URL, source finding, owner, action and rescan |
| Strategic Content Studio | Porcelain editorial table or graphite writing atelier with semantic links | Build source-backed briefs, inspect claims and review versions |
| Trust and Authority Graph | Sculptural node-edge identity graph with trusted metallic anchors | Follow verified entity links and distinguish unverified claims |
| Reputation Intelligence | Layered coverage timeline and restrained media signal map | Inspect dated public source, credibility, issue and response |
| Agency Operations | Luxury multi-client executive workspace with ownership/approval paths | Work across permissioned clients and delivery status |
| Analytics Intelligence | Executive measurement theatre with clear multi-series graph hierarchy | Filter by scope, reconcile sources, detect meaningful changes |
| AI Exposure / GEO | Dimensional prompt-to-citation network with selective emerald lines | Inspect exact prompt/model/sample/date/cited sources and repeat run |

Keep these visual worlds related through one design system, not nine different UI libraries. Each studio must support Observe → Explain → Prioritise → Act → Verify → Learn with evidenced, clickable pathways.

## Component-by-component design rules

- **Navigation:** satin neutral shell; emerald on active item only; clear label hierarchy. Nine-element dock never blocks content.
- **Buttons:** primary = accessible emerald + contrasting foreground; secondary = platinum/titanium with discrete frame; destructive = semantic warning, never emerald.
- **Cards:** neutral backgrounds and fine metallic lines; visual elevation through depth and spacing, not green-tinted fills.
- **Forms and tables:** opaque readable control surfaces; stable field labels, focus rings, clear validation and comfortable touch targets.
- **Metrics:** tabular numbers, labelled units, source freshness and provenance; emerald only for the main finding or selected series.
- **Evidence:** measured/manual/hypothesis/unavailable differentiated through language and icons as well as tone.
- **Dialog and command search:** premium glass only outside text-dense regions; correct keyboard and screen-reader semantics.
- **Motion and hover:** no gratuitous bouncing, rapid flashing, runaway particles, excessive parallax or scroll-jacking.
- **Empty state:** useful next action, no invented numbers, same high-quality art direction.

## Accessibility, quality and performance gates

Minimum: WCAG 2.2 AA across both themes. For ordinary text target at least 4.5:1 contrast; for large text and relevant non-text UI boundaries target at least 3:1. All interactions must be operable without a pointer. Focus must be visible and not obscured. Provide semantic alternatives for charts. Respect prefers-reduced-motion. Support 200% zoom and the narrow responsive layout without losing information or controls.

Performance targets using representative measurement: LCP at or below 2.5 s, INP at or below 200 ms, CLS at or below 0.1 at p75. Do not claim these targets achieved without measurements. Defer heavyweight graphics, pause off-screen animations and test lower-power/mobile devices. Keep existing SSRF protections and source integrity unchanged.

## Required Work execution and output

1. Review the source and inspect the authenticated development preview. Capture current baseline screenshots in Obsidian and Porcelain at desktop, tablet and mobile sizes.
2. Implement central semantic palettes and component material tokens. Replace scattered hard-coded colours incrementally, with regression testing.
3. Apply the Titanium + Emerald brand treatment to the capital T and rotating metallic V in both atmospheres.
4. Perfect the five-stage cinema, responsive constellation, illuminated relationships and transition into real working engine interfaces.
5. Restyle Command Centre, visualisations, analytics/decision rooms, evidence and diagnostics, workspace, navigation and all nine studios in both environments.
6. Test appearance preference on first paint, persistence, system change, cross-tab updates, mobile, keyboard focus, reduced motion, offline Canvas/WebGL support and empty/disconnected states.
7. Run all existing typechecks, tests and builds; add necessary regression tests and Playwright/browser visual checks. Review screenshots and refine until legibility and coherence are excellent.
8. Deploy only to a protected Vercel preview. Do not change production/main without approval.

Deliver desktop and mobile screenshots of the entrance, T transformation, fully formed constellation, Command Centre and all nine studios in each theme. Provide a before/after comparison, selected final tokens, tested commit and preview, performance/a11y results, remaining gaps and a realistic path to product release.

**Creative non-negotiable:** Titanium is the environment. Emerald is the signal. VisTa must be visually distinctive and stunning, yet every screen must remain accurate, usable, accountable and commercially purposeful.


## Implemented design refinement: chrome-violet cinematic identity

The design now has three calibrated dimensions:
- **Titanium**: product architecture, metallic frame, platinum reflectivity, sophistication.
- **Emerald**: evidence signal, real action, selection and trusted intelligence flow.
- **Violet chrome**: premium futuristic cinematic energy, especially the entrance, changing wordmark, AI/GEO, transitions and Platinum pricing.

This violet layer must be visible to visitors rather than so subtle it disappears. Use deliberate polished gradients and luminous fields without polluting the working charts with false semantics.

The image experience now uses a large, interactive featured photograph and responsive editorial image gallery for each of the nine studios, not tiny 70px strips. Every photograph must remain actually discoverable without overwhelming the analytical tools. Dark and light require deliberate, independently readable text/scrims.

### Three-tier commercial architecture (PROPOSED, NOT LIVE)

| Tier | Visual identity | Proposed monthly | Proposed annual commitment (monthly equivalent) | Starting limits |
| --- | --- | ---: | ---: | --- |
| VisTa Basic | Neutral Titanium | £49 | £39 | 1 brand / 1 user |
| VisTa Standard | Emerald intelligence | £149 | £119 | 5 brands / 3 users |
| VisTa Platinum | Violet chrome + polished platinum | £399 | £319 | 20 brands / 10 users |

Annual totals are 12 times the equivalent monthly rate, not monthly bills. Show actual annual total and discount. Standard is the recommended growing-business option.

At present these are **founding pricing proposals only**. Subscription management, payment processing, role enforcement, integrations, billing terms and certain advanced capabilities are not yet live. Pricing screens must use real enquiry options rather than fake checkout. Commercial approval, market validation, feature gating and privacy/legal terms are required before public sales.

Current code: src/app/pricing.tsx, src/app/pricing.css, src/lib/pricing-plans.ts and src/app/chrome-violet.css. Accessible via #pricing from the entrance, navigation and Command Centre.

Image layout remediation: src/app/visual-immersive.css and src/app/visual-stories.tsx.

Acceptance: verify substantial photo compositions, no repeated 70px strips, distinct chrome-violet glow visible in each theme, all three plan colours genuinely different, functional plan enquiry links, transparent proposed pricing and mobile legibility.
