# PIMPIT.RO Design System

## Brand identity
- Segment: aftermarket alloy wheels, tuning enthusiast, Romania/EU
- Tone: premium automotive, technical authority, not generic e-commerce
- Aesthetic: dark-first, editorial, automotive editorial (think Vossen/Concaver vibes)

## Color palette
- Primary: #0A0A0A (obsidian)
- Accent: #C9A84C (gold — premium, not cheap yellow)
- Surface: #141414 / #1E1E1E
- Text: #F5F5F5 / #A0A0A0 muted

## Typography
- Headlines: wide-tracking, uppercase for specs (ET37 · 5X120)
- Body: neutral, readable, NOT Inter
- Spec tags: monospace, small caps

## Key components
- Product card: dark bg, hover = gold border + spec overlay
- Fitment specs: inline badge row (Ø · J · PCD · ET · CB)
- CTA: "Adaugă în coș" — solid gold, never rounded pill
- Filters: sidebar dark panel, no white backgrounds

## What to AVOID
- Generic white e-commerce cards (not Amazon, not eMAG)
- Rounded pastel buttons
- Stock photo hero sections
- Inter / Roboto / Arial fonts

## Implementation notes (live)

### Fonts wired
- `Space Grotesk` → `font-display` (CSS var `--font-display`) — headlines, CTAs, brand block
- `JetBrains Mono` → `font-mono` (CSS var `--font-mono`) — fitment specs, labels, prices (tabular nums)
- Inter remains as `<body>` default for admin + non-storefront pages (legacy)

### Color tokens in use (raw hex, scoped to storefront components)
- Bg base: `#0A0A0A` · Surface: `#141414` (cards), `#1E1E1E` (popovers)
- Text: `text-zinc-100` (≈ `#F4F4F5`, matches spec `#F5F5F5`), `text-zinc-400` muted
- Borders: `border-white/10` subtle, `border-white/5` ultra-subtle
- Gold accent: `#C9A84C` — applied via inline `style` (since shadcn `--primary` stays blue for admin compat)

### Components shipped (2026-06-03)
- `components/catalog/ProductCard.tsx` — dark card, gold hover border, monospace spec badges (Ø · J · PCD · ET · CB), hover spec overlay, solid gold CTA (square corners).
- `components/home/Hero.tsx` — full-bleed homepage hero, passive-scroll parallax via `requestAnimationFrame`, CSS-composed wheel anchor (no asset), side-lit from the left, spec ticker bar.
- `app/jante/[slug]/page.tsx` — 60/40 grid (image left, specs+CTA right), fitment ribbon, stock block, brand block in gold border, fitment spec table (monospace), related wheels row (4 cards, same brand fallback diameter), TÜV certificate link in gold underline.
- `app/jante/[slug]/ProductActions.tsx` — dark monospace selects with gold focus border, solid gold CTA with arrow affordance.

### Rules for future changes
- Storefront pages opt into pimpit dark explicitly via inline hex / arbitrary tailwind values; do NOT flip global tokens (admin depends on light theme).
- New CTAs: solid gold, `font-display` semibold, `tracking-[0.18em]+`, NEVER `rounded-full` / pill.
- New spec values: `font-mono`, uppercase tracked labels in gold, values in `text-zinc-100`.
- Update this file whenever a new storefront component lands or the palette/typography evolves.
