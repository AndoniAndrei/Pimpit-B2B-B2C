# PIMPIT.RO Design System

## Brand identity
- Segment: aftermarket alloy wheels, tuning enthusiast, Romania/EU
- Tone: premium automotive, technical authority, not generic e-commerce
- Aesthetic: light editorial automotive — premium gold accents on warm-white, editorial typography (Barlow Condensed)

## Color palette (light premium theme — dark mode disabled)
- Background: #FFFFFF
- Surface (cards): #FFFFFF
- Surface-2 (page wash): #F7F7F5 (warm stone)
- Border: #E5E5E0
- Accent: #B8860B (DarkGoldenRod — pops on white, 4.74:1 contrast)
- Accent hover: #9A6F08
- Accent light (highlight in gradients): #E5B95A
- Text: #0A0A0A (near-black — max readability)
- Text muted: #525252 (zinc-600 — still very readable)
- Text subtle: #737373 (zinc-500 — small captions)
- Success: #16A34A (green-600)
- Error: #DC2626 (red-600)

## Gold-shine primary CTA
Premium gold buttons use the `.btn-gold` utility (defined in `globals.css`):
- Base gradient: `linear-gradient(135deg, #E5B95A 0%, #C9A227 35%, #B8860B 65%, #8B6914 100%)`
- Soft gold drop shadow
- White text
- Animated shine sweep on hover (`::before` pseudo-element with diagonal white gloss)
- Hover gradient lightens + button lifts 1px

Outline variant: `.btn-gold-outline` — 2px gold border, transparent fill, gold text, inverts on hover.

Gold text shine: `.text-gold-shine` — gradient-clipped text for premium accents (logo `.RO`, hero highlight word).

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
- Pastel rounded buttons / pill CTAs
- Stock photo hero sections — use product renders or editorial CSS compositions
- Inter / Roboto / Arial for headlines (body Inter is fine; headlines must use Barlow Condensed)
- Cheap "yellow" — accent stays in the deep-gold range (#B5933A → #C9A84C)
- Dark mode (intentionally disabled — see Change Log 2026-06-03)

## Implementation notes (live)

### Fonts wired
- **Inter** (weights 300–900, via next/font) — used EVERYWHERE except spec badges. Simple, highly readable. Loaded as both `font-sans` and `font-display` (Tailwind alias).
- **JetBrains Mono** → `font-mono` — used only for the inline Ø / J / PCD / ET / CB chips on cards. Subtle technical touch.
- Barlow Condensed has been dropped (user feedback: harsh & not readable).

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
- Pimpit dark is the GLOBAL default (`:root` in `globals.css` flipped 2026-06-03). Admin and every storefront page inherit it via shadcn tokens.
- Use `pimpit-*` tailwind tokens (`bg-pimpit-bg`, `text-pimpit-accent`, etc.) for storefront UI; shadcn tokens (`bg-card`, `text-foreground`, `bg-primary`) work everywhere and map to the same dark palette.
- New CTAs: solid gold (`bg-pimpit-accent text-pimpit-bg` or `bg-primary text-primary-foreground`), `font-display` semibold, `tracking-[0.18em]+`, NEVER `rounded-full` / pill. Use `--radius: 0.25rem` global setting (sharp).
- New spec values: `font-mono`, uppercase tracked labels in `text-pimpit-accent`, values in `text-pimpit-text`.
- Display headings: `font-display` (Barlow Condensed) — uppercase, tracking-tight for titles, tracking-[0.18em+] for spec/CTA labels.
- Mobile filter drawer: bottom sheet (`items-end` on mobile, full-height side drawer on tablet+).
- Update this file whenever a new storefront component lands or the palette/typography evolves.

### Components shipped (2026-06-03, CARiD-style full overhaul)
- `globals.css` — pimpit dark is the global default (admin included). `--radius: 0.25rem`. `color-scheme: dark`. `.no-scrollbar` utility for horizontal scrollers.
- `components/shared/Navbar.tsx` — sticky dark nav with logo (PIMPIT.RO + gold .RO), Jante/Accesorii uppercase nav, prominent search input wired to /jante?search=, account & cart icons, mobile hamburger drawer with embedded search.
- `components/shared/Footer.tsx` — 4-column dark footer: brand + tagline | Catalog links | Cont links | Brand-uri. Trust strip on top (TÜV/KBA, livrare 24-48h, garanție, plată securizată). Bottom strip with copyright + payment methods.
- `components/home/Hero.tsx` — full-bleed dark hero with embedded vehicle Year/Make/Model selector as primary CTA, CSS-composed wheel anchor with side-light from the left, parallax on scroll.
- `components/home/VehicleSelector.tsx` — reusable Year/Make/Model selector (hero + inline variants). Submits to `/jante?vehicle=YYYY-Make-Model`. Source data in `lib/vehicleData.ts` (26 makes, ~150 models). Vehicle-FK lookups are a future enhancement.
- `components/home/CategoryTiles.tsx` — 6-tile grid (Jante 17"/18"/19"/20"/21"+/Accesorii), each with diameter number-as-art and hover gold border. Also exports `<SectionHeading>` used across homepage sections.
- `components/home/FeaturedBrands.tsx` — horizontal scroll strip of brand wordmarks (no logos — display typography is the brand). Server-fetched distinct brands from products.
- `components/home/SocialProof.tsx` — 4-cell stat bar: product count, brand count, livrare 24-48h, TÜV/KBA.
- `components/home/TrendingProducts.tsx` — top 8 by stock. Horizontal scroll on mobile, 4-col grid on lg+.
- `app/page.tsx` — composes Hero + SocialProof + CategoryTiles + FeaturedBrands + TrendingProducts. Single supabase query (one page of stock-sorted products).
- `components/catalog/ProductCard.tsx` — pimpit tokens, gold-on-hover border, monospace spec badges, solid gold CTA (square).
- `components/catalog/FilterSidebar.tsx` — full restyle: gold accordion headers, custom dark checkboxes with gold check, pill buttons for diameter/width/ET, active-filter chips, monospace.
- `components/catalog/CatalogControls.tsx` — dark search input with magnifier icon, monospace results counter, sort dropdown styled as token-based dark.
- `components/catalog/MobileFilters.tsx` — bottom sheet on mobile (`items-end`), side drawer on tablet+, gold sticky CTA at bottom.
- `components/catalog/AccordionSection.tsx` — reusable accordion for product detail sections.
- `app/jante/page.tsx` + `app/accesorii/page.tsx` — breadcrumb strip, sticky dark header bar, restyled empty-state, dark pagination buttons.
- `app/jante/[slug]/page.tsx` — 60/40 layout with cert badges (TÜV/KBA/JWL), accordion sections (Descriere, Fitment Checker = embedded VehicleSelector, Specificații complete, Livrare & retururi), horizontal-scroll related products row (8 items).
- `app/jante/[slug]/ProductActions.tsx` — pimpit token styling, primary gold CTA + secondary outlined "Cumpără acum" CTA.

### Admin pages
- Admin uses shadcn tokens (`bg-card`, `text-foreground`, `bg-primary`, etc.) which now all resolve to dark pimpit palette automatically.
- Hard-coded `bg-white`, `text-gray-*`, `bg-gray-*` references in `admin/produse/ProduseClient.tsx` and `admin/ImportWizard.tsx` were migrated to shadcn tokens (2026-06-03).
