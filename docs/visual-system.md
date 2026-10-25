# VisTa Visual System

## Two complete environments

VisTa Obsidian is the dark cinematic intelligence theatre: graphite, near-black depth, luminous emerald, titanium and pearl reflections, and restrained antique-gold indications.

VisTa Porcelain is a fully art-directed light environment: warm ivory, alabaster, white architectural surfaces, platinum and silver highlights, controlled shadows, emerald signals, and crisp dark typography.

These are two compositions of one working product, not a generic colour-inversion filter. Source statuses, analytical measurements and existing records remain unchanged when appearance changes.

## Implemented architecture

- src/lib/appearance.ts defines the stored theme, type and system preference resolver.
- src/app/layout.tsx initialises the appearance attribute on the document element before paint, using remembered choice or system preference.
- src/app/page.tsx manages the in-app preference, local storage and cross-tab and system preference changes.
- src/app/appearance-switch.tsx provides a keyboard-accessible two-state theme control in the normal navigation and on the cinematic entrance.
- src/app/appearance.css contains separate material, contrast and interface styling for Porcelain. Existing Obsidian styling remains the default.
- src/app/cinematic-pearl.tsx renders different physical shell, lighting and environmental material colours for Obsidian and Porcelain.
- src/app/ecosystem.tsx emits nine curved light paths and particle signals into the named constellation elements.

## Visual and interaction requirements

- Every chart, input, button, overlay, radial map and interactive studio must remain readable in both environments.
- Preserve direct navigation, motion pause, skip and reduced-motion paths.
- The nine-element dock remains available as part of normal operation.
- Use CSS/SVG for inexpensive transitions; do not add costly visual features without measured value.
- Keep data-driven visualisations source-grounded.

## Required browser quality assurance

TypeScript checks, unit tests and a production build do not establish visual quality. Before production approval, inspect authenticated previews on desktop, tablet and mobile in both appearances.

Check contrast; chart legibility; keyboard/focus and reduced-motion behaviour; initial rendering and theme persistence; simulated storage denial; nine-element mobile dock; offline Canvas fallback; V reflections; cinematic reveal timing; navigation; and performance.

Capture actual screenshots of both modes and repair all visual regressions before approving the production release.
