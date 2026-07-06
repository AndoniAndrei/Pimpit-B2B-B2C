# CATALOG V2 — Universal Automotive Catalog & Import Engine

> Technical plan for evolving Pimpit from a wheel-centric catalog into a universal
> automotive parts platform (wheels, tires, packages, suspension, lighting, brakes,
> TPMS, spacers, hardware, body kits, accessories) with vehicle fitment,
> modeled after CARiD.com and FitmentIndustries.com.
>
> Status: **Phase 1 implemented** (schema foundation). Phases 2–6 are design-only.
> Companion doc: `APP_STATE.md` (v1 source of truth — still authoritative for the
> live storefront until cutover).

Last updated: 2026-07-06

---

## 1. Current System Audit (v1)

### 1.1 What exists and works

| Area | State |
|---|---|
| Storefront | `/jante` + `/accesorii` catalogs, faceted cascade filters (RPC), product detail, cart, ramburs checkout. Solid for wheels. |
| ETL | Single in-process path `lib/importRunner.ts`, triggered from admin. 7 suppliers, CSV/JSON/XML/XLSX via `feedParser.ts`, generic column mapping via `genericParser.ts` (`FieldMappings` in `suppliers.driver_config` JSONB). |
| Pricing | 6-step formula in `pricing_rules` per supplier + free-form `price_formula` per mapping. FX buried in `base_multiplier`. |
| Dedup | In-memory per-import on `(part_number, brand)`, winner = lowest price → highest stock → lowest supplier id. Audit trail in `product_sources`. |
| Admin | ImportWizard (7-step), product table with inline edit, sync history. |

### 1.2 Structural problems (why enum values are not enough)

1. **`products` is a wheel table.** `diameter`, `width`, `pcd`, `et_offset`, `center_bore`, `concave_profile`, `tuv_max_load` are first-class columns. A tire (205/55R16 91V, load index, speed rating, season) or a coilover kit (drop range, spring rate) has no home except `custom_fields` JSONB — untyped, unfilterable, unvalidated.
2. **No product/variant split.** A wheel model (e.g. "Japan Racing JR11") exists as N unrelated rows, one per size/finish/ET combination. CARiD/FI model this as *one product page with option selectors*; we can't render that, can't share media/description, and SEO-cannibalize ourselves with near-duplicate pages.
3. **Winner-takes-all overwrites.** `products` holds only the winning supplier's price/stock; losing offers exist only as `product_sources` audit rows. No per-offer B2B price, no lead time, no multi-offer display, and a supplier outage silently flips product data.
4. **Import is fire-and-forget.** No raw snapshot, no staging, no dry run, no diff preview, no rollback. A bad mapping publishes directly into the live catalog. Errors are capped at 10 strings in a `sync_logs` row.
5. **Mappings are a single JSONB blob** (`driver_config.field_mappings`) with hardcoded wheel field names. No versioning, no per-category profiles, no reusable transform rules (brand remaps live in a separate ad-hoc `supplier_transforms` table with 4 hardcoded rule types).
6. **ETL runs inside Next.js route handlers** capped at `maxDuration = 300s` — already a known scaling ceiling (APP_STATE §10.3).
7. **No vehicle dimension at all.** The single most important navigation pattern on CARiD/FI — "shop by vehicle" (Year/Make/Model, verified fitment, rubbing/stance data) — has no schema.
8. **Filters are hardcoded per type.** Two near-duplicate RPCs (`get_cascading_filter_options` / `_accesorii`) with wheel columns baked in. Every new category would need a new RPC.
9. **Base schema is not in migrations.** `supabase/migrations/` starts at 001 (incremental); core DDL exists only in the live database. V2 fixes this: everything new is in checked-in migrations.

### 1.3 What we keep

- Supabase (Postgres/Auth/Storage), Next.js 14 storefront, admin auth model.
- `suppliers` table (identity, auth refs, env-var credential indirection).
- `pricing_rules` semantics (as *margin* rules; FX moves to `currency_rates`).
- Parsers: `feedParser`, `priceParser`, `pcdUtils`, `etRangeParser`, `formulaEvaluator` — reused by the v2 engine.
- The old import path stays operational until the v2 engine reaches feature parity (Phase 4 cutover).

---

## 2. Reference-Site Analysis (CARiD / Fitment Industries)

Patterns worth copying, and how they map to our schema:

| Pattern | CARiD / FI behaviour | V2 mechanism |
|---|---|---|
| **Vehicle-first shopping** | Persistent YMM (Year/Make/Model/Trim) selector; catalog silently filters to fitting parts; "My Garage" saves vehicles | `vehicle_makes/models/generations/vehicles` + `variant_vehicle_compatibility`; selected vehicle in cookie/session; garage table later |
| **Product = family, variant = buyable option** | One JR11 page, selectors for size/ET/finish; one tire model page, selectors for size/load/speed | `catalog_products` (family, media, SEO) + `product_variants` (SKU, typed attributes) |
| **Category-specific facets** | Wheels filter by diameter/width/offset/bolt pattern; tires by size/season/speed rating; lights by side/technology | `category_attribute_definitions` + `category_filter_definitions` → one generic facet engine instead of per-category RPCs |
| **Verified fitment gallery** | FI's wheel-offset gallery: real cars, wheel specs, tire specs, rubbing/trimming/stance notes | `vehicle_fitments` seeded from our 57k-row FI gallery export |
| **Fitment confidence messaging** | "Fits your vehicle" badge, "may require fender rolling" warnings | `fitment_rules` + `fitment_warnings` |
| **Wheel & tire packages** | Configurator: wheel + tire + TPMS bundled, mounted & balanced | package = `catalog_products` in category `wheel-tire-packages` with component links (Phase 5) |
| **Multiple sellers/availability tiers** | Ship dates per option, backorder states | `supplier_offers` per variant (price, stock, lead time) with computed winner |

---

## 3. Target Architecture — Four Layers

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. RAW SUPPLIER LAYER  (immutable evidence)                        │
│    supplier_feeds → import_jobs → snapshot (Storage)               │
│                     → import_raw_rows → import_errors              │
├────────────────────────────────────────────────────────────────────┤
│ 2. MAPPING LAYER  (versioned, per supplier × category)             │
│    supplier_mapping_profiles → supplier_field_mappings             │
│                              → supplier_transform_rules            │
│    + currency_rates, brand aliases, unit normalization             │
├────────────────────────────────────────────────────────────────────┤
│ 3. STAGING  (diffable, publishable, rollbackable)                  │
│    import_staged_variants (create/update/unchanged/deactivate)     │
├────────────────────────────────────────────────────────────────────┤
│ 4. CANONICAL CATALOG  (what the storefront reads)                  │
│    categories, brands, manufacturers                               │
│    catalog_products → product_variants → supplier_offers           │
│                     → media_assets → product_variant_attributes    │
│    vehicles* + variant_vehicle_compatibility + vehicle_fitments    │
└────────────────────────────────────────────────────────────────────┘
```

Data flows strictly downward. Publishing is the only step that touches layer 4,
it is transactional, and every published offer is stamped with its
`import_job_id` so a job can be rolled back.

### 3.1 Canonical catalog model

- **`categories`** — tree (self-referencing `parent_id`). Seeded: Wheels, Tires,
  Wheel & Tire Packages, Suspension (Lowering Springs / Coilovers / Air),
  Lighting (Headlights / Taillights), Brakes (Brake Kits / Pads / Rotors),
  TPMS, Spacers & Adapters, Bolts & Lug Nuts, Body Kits & Aero, Accessories.
- **`brands`** — normalized registry with `aliases text[]` (replaces ad-hoc
  `brand_remap` transforms: "stw" → STW happens at mapping time via alias lookup).
  Optional `manufacturer_id`.
- **`manufacturers`** — corporate entity (Tenneco → Monroe/Rancho, etc.). Optional.
- **`catalog_products`** — the *family*: brand + category + name/slug, description,
  SEO fields. One row per "JR11", not per size.
- **`product_variants`** — the *SKU*: `part_number`, `ean`, denormalized `brand_id`
  (hard uniqueness `(brand_id, part_number)` = today's dedup key), typed attributes
  via EAV **plus** a trigger-maintained `attrs jsonb` (GIN-indexed) for fast faceting,
  and denormalized commerce columns (`price`, `price_b2b`, `stock`,
  `best_offer_id`) recomputed from offers.
- **`supplier_offers`** — one row per (variant × supplier): raw price+currency,
  calculated RON price, B2B price, stock, incoming stock, lead time,
  `last_seen_at`, `import_job_id`. Winner selection (same tie-break as v1:
  min price → max stock → min supplier id) runs in
  `recompute_variant_pricing()` and denormalizes onto the variant.
- **`media_assets`** — images/video/3D/documents attached to product or variant,
  with `source` (feed_url / rest_proxy / zip_import / manual) and ordering.

### 3.2 Category attribute system

- **`category_attribute_definitions`** — per category: `code`, label, `data_type`
  (`text|number|integer|boolean|enum|multi_enum|range`), `unit`, enum options,
  required/variant-defining flags, validation JSON. Child categories inherit
  parent definitions (resolved in code).
- **`product_variant_attributes`** — typed EAV row per (variant × attribute):
  `value_text / value_numeric / value_numeric_max (ranges, e.g. ET 20–50) /
  value_boolean / value_json`. A trigger mirrors values into
  `product_variants.attrs` so the storefront filters on one GIN index.
- **`category_filter_definitions`** — which attributes become storefront facets,
  with widget type (`checkbox_list | range_slider | toggle | search_select`) and
  order. One generic facet query replaces the per-type RPCs.

Seeded attribute sets (migration 013): wheels (diameter, width, bolt pattern,
ET incl. range, center bore, color, finish, construction, load rating), tires
(width, aspect, rim diameter, load index, speed rating, season, run-flat, XL),
suspension (type, drop front/rear, adjustability), lighting (side, technology,
beam, homologation), brakes (position, disc diameter, piston count, material),
TPMS (frequency, valve type), spacers (thickness, bolt pattern, center bore),
bolts/lug nuts (thread, seat, length, head), body kits (material, finish).

### 3.3 Vehicle fitment layer

- **`vehicle_makes` → `vehicle_models` → `vehicle_generations` (optional) →
  `vehicles`** (concrete model-year-trim; `specs jsonb` for bolt pattern, CB,
  OEM sizes when we source OEM data).
- **`vehicle_fitments`** — real-world setups. Seeded from the 57,162-row
  Fitment Industries gallery export (`scripts/import-fitment-gallery.ts`):
  year/make/model/trim, front+rear wheel specs (parsed from "R19, J9.5, ET35"),
  front+rear tire specs (parsed from "245/40R19"), rubbing, trimming, spacers,
  stance, source URL (dedup key).
- **`variant_vehicle_compatibility`** — explicit (variant × vehicle × position)
  fit records, from rules, suppliers or manual curation.
- **`fitment_rules`** — declarative matching config per category (wheels match on
  bolt pattern + center bore + diameter/width/ET windows vs vehicle specs).
- **`fitment_warnings`** — "may rub", "requires fender rolling", severity-tagged.

The gallery data yields immediate value even before OEM fitment data exists:
for a chosen vehicle we can show *community-verified* wheel/tire setups and
aggregate them into recommended size windows ("what fits my car").

### 3.4 Import engine v2 (workflow)

```
upload / feed URL / API
        │
   ┌────▼─────┐   snapshot → Storage bucket feed-snapshots/{job}/feed.bin
   │  FETCH   │   import_jobs.status: queued → fetching
   └────┬─────┘
   ┌────▼─────┐   rows → import_raw_rows (raw jsonb + row_hash)
   │  PARSE   │   errors → import_errors (phase='parse')
   └────┬─────┘
   ┌────▼─────┐   apply supplier_mapping_profile (fields + transforms:
   │   MAP    │   units, currency via currency_rates, brand via aliases)
   └────┬─────┘
   ┌────▼─────┐   typed validation vs category_attribute_definitions
   │ VALIDATE │   (required, ranges, enum membership) → import_errors
   └────┬─────┘
   ┌────▼─────┐   diff against live variants → import_staged_variants
   │  STAGE   │   action: create | update | unchanged | deactivate
   └────┬─────┘   ── DRY RUN stops here; admin reviews report ──
   ┌────▼─────┐   transactional apply to catalog_products / product_variants /
   │ PUBLISH  │   supplier_offers / media_assets; recompute winners;
   └────┬─────┘   stamp import_job_id on touched offers
   ┌────▼─────┐
   │ ROLLBACK │   restore `previous` payloads captured at staging time
   └──────────┘
```

Every phase is resumable and observable (`import_jobs.stats jsonb`, row counts
per phase). Raw rows are purgeable after N days (snapshot file remains the
permanent evidence).

### 3.5 Worker architecture

Heavy work must leave Next.js request handlers. Decision: **DB-backed job queue,
polled by a standalone worker.**

- The admin UI only *inserts* an `import_jobs` row (`status='queued'`) and then
  polls/streams job status. Route handlers return immediately.
- A worker process (plain Node, reuses `pimpit-web/lib/**` parsers; deployable on
  Railway/Fly/VPS — or a Supabase scheduled Edge Function for small feeds)
  claims jobs with `FOR UPDATE SKIP LOCKED`, executes the pipeline, heartbeats
  into `import_jobs.stats`.
- Why not pgmq/Redis/SQS: one queue consumer, low job volume (dozens/day), and
  the job table doubles as the audit/UI record. A dedicated broker adds ops cost
  with no benefit at this scale. Revisit if we ever need >1 concurrent worker
  per supplier.
- Interim (Phase 2, before the worker exists): the pipeline can still run
  in-process behind the same `import_jobs` state machine, keeping the 300s cap
  but gaining staging/dry-run/rollback. Cutover to the worker is transparent
  because the contract is the job row, not the transport.

### 3.6 Admin UX flow (Phase 4)

1. **Supplier onboarding wizard** — supplier identity → feeds (`supplier_feeds`,
   multiple per supplier; replaces the secondary-feed hack) → auth (env-var refs,
   unchanged) → fetch sample → **column preview**.
2. **Mapping editor** — pick target category → two-pane UI: feed columns left,
   canonical fields + category attributes right; per-field transform chain
   (trim, regex extract, unit convert, number locale, template); live preview on
   20 sample rows; save as versioned `supplier_mapping_profile`.
3. **Dry-run report** — counts (create/update/unchanged/deactivate), error table
   grouped by code, sample diffs, price-change distribution (guardrail: warn when
   >X% of prices move >Y%).
4. **Error review** — `import_errors` browser with raw-row drill-down.
5. **Staging review + Publish button** — approve → publish; job log shows
   progress; **Rollback button** on published jobs.

---

## 4. Migration Strategy

**Principle: expand → backfill → cutover → contract. Nothing destructive until
the final, separate, reviewed migration.**

| Stage | Content | Risk |
|---|---|---|
| **Expand** (Phase 1, done) | Migrations 012–015 create all v2 tables alongside v1. Zero changes to existing tables, RPCs, or code paths. Storefront untouched. | None — additive only |
| **Backfill** (opt-in) | `backfill_catalog_from_legacy()` SQL function (in 012) copies `products` → brands/catalog_products/variants/offers/attributes (1 product = 1 family = 1 variant initially; family-grouping is a later data-quality pass). Re-runnable; matches on `legacy_product_id`. | Low — writes only to v2 tables |
| **Parallel run** (Phases 2–4) | New import engine writes to v2; old engine keeps writing to v1. Storefront reads v1. New admin pages read v2. Since catalog will be re-imported anyway (per product decision), backfill is a convenience, not a dependency. | Low |
| **Cutover** (Phase 5) | Storefront pages/APIs switch to v2 reads behind a feature flag (`CATALOG_V2_READS=1`). Old import engine disabled per supplier as each gets a v2 mapping profile. Cart/orders keep FK-ing v1 `products.id` until cutover, then new orders reference variants (order_items already snapshot product data, so history is safe). | Medium — mitigated by flag + per-supplier ramp |
| **Contract** (Phase 6) | After ≥2 weeks stable: drop v1 `products`/`product_sources`/wheel RPCs/`filter_options` MV; optionally rename `catalog_products` → `products`. | Gated on explicit sign-off |

**Rollback plan per stage:** Expand — drop v2 tables (nothing references them).
Backfill — truncate v2 catalog tables, re-run. Parallel — disable v2 jobs.
Cutover — flip feature flag back (v1 pipeline still running until Contract).
Import-level — per-job rollback via staged `previous` payloads.

**Risks:**

| Risk | Mitigation |
|---|---|
| EAV performance on large facets | denormalized `attrs` JSONB + GIN; facet queries hit one table; measured before cutover |
| Family grouping wrong (variants under wrong product) | grouping key = (brand, category, model-name); admin merge/split tool in Phase 4; worst case = 1 family per variant (v1 parity) |
| Live DB drift vs migrations (v1 base schema was never checked in) | v2 is fully migration-defined; `supabase db diff` before each apply |
| Fitment CSV data quality (case variants "DACIA"/"INFINITI", free-text trims) | normalizers + slug-based upsert; import script reports per-row rejects, dry-run mode |
| Two catalogs diverge during parallel run | product decision: v1 catalog is disposable; re-import into v2 is the plan of record |
| Vercel 300s cap during Phase 2 interim | unchanged from today; worker lands in Phase 3 before any big-feed supplier moves |

---

## 5. Step-by-Step Implementation Plan

- **Phase 1 — Schema foundation** ✅ (this change)
  - Migrations 012–015 (catalog, attributes, import engine, fitment) + seeds.
  - `lib/catalog/types.ts` (canonical TS model), `lib/import/normalizers.ts`
    (units, currency, brand aliasing, tire-size + wheel-spec parsers).
  - `scripts/import-fitment-gallery.ts` — 57k FI gallery rows → vehicle tables
    (dry-run + apply modes). Data committed as `data/fitmentgallery.csv.gz`.
  - Test suite (`npm test`) for parsers, normalizers, pricing, dedup.
- **Phase 2 — Import pipeline core (in-process behind job table)**
  - Fetch/snapshot/parse/map/validate/stage/publish/rollback as `lib/import/engine/*`.
  - Mapping profile CRUD API. First supplier (smallest feed) mapped end-to-end.
- **Phase 3 — Worker**
  - Standalone Node worker with `SKIP LOCKED` claim loop; deploy; move big feeds.
  - Scheduling via trigger/cron inserting queued jobs.
- **Phase 4 — Admin UI v2**
  - Onboarding wizard, mapping editor with live preview, dry-run report,
    error browser, staging review + publish/rollback buttons.
  - Migrate all 7 suppliers to mapping profiles; freeze old wizard.
- **Phase 5 — Storefront v2**
  - Vehicle selector (YMM) + garage; generic category pages with
    `category_filter_definitions`-driven facets; variant-selector product pages;
    fitment gallery surfacing; wheel & tire package builder; cutover flag.
- **Phase 6 — Contract**
  - Decommission v1 tables/RPCs, rename, APP_STATE rewrite.

---

## 6. Phase 1 Deliverables (implemented)

| File | Content |
|---|---|
| `supabase/migrations/012_catalog_v2_foundation.sql` | categories/brands/manufacturers, catalog_products, product_variants, supplier_offers, media_assets, winner recompute fn, attrs-sync trigger, category seed, RLS, `backfill_catalog_from_legacy()` |
| `supabase/migrations/013_category_attributes.sql` | category_attribute_definitions, product_variant_attributes, category_filter_definitions + full attribute/filter seeds per category |
| `supabase/migrations/014_import_engine_v2.sql` | supplier_feeds, import_jobs, import_raw_rows, import_errors, import_staged_variants, supplier_mapping_profiles, supplier_field_mappings, supplier_transform_rules, currency_rates, feed-snapshots bucket, `claim_next_import_job()` |
| `supabase/migrations/015_vehicle_fitment.sql` | vehicle_makes/models/generations/vehicles, vehicle_fitments, variant_vehicle_compatibility, fitment_rules, fitment_warnings |
| `pimpit-web/lib/catalog/types.ts` | TS types for the v2 model |
| `pimpit-web/lib/import/normalizers.ts` | unit/currency/brand/text normalizers, tire-size parser, wheel-spec parser, vehicle name normalizer |
| `pimpit-web/scripts/import-fitment-gallery.ts` | FI gallery CSV → vehicles + vehicle_fitments (dry-run default) |
| `pimpit-web/tests/*.test.ts` | parsers, normalizers, pricing formula, dedup |
| `data/fitmentgallery.csv.gz` | 57,162 fitment records (source data) |
