# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## READ FIRST — Source of Truth

**Before writing or modifying any code, read [`APP_STATE.md`](./APP_STATE.md).** It is the single source of truth for:
- All storefront pages, API routes and admin features
- ETL pipeline (single in-process path: `pimpit-web/lib/importRunner.ts`)
- Complete database schema, enums, RPCs, RLS policies, migrations
- Business logic (pricing formula, dedup, B2B, shipping, images)
- Known issues / tech debt with file:line references
- Roadmap of immediate optimizations

**Rule:** Any functional change (new feature, schema change, API route, significant bugfix) MUST update `APP_STATE.md` in the same commit:
- Update the relevant feature section
- Add a one-line entry to the Change Log (section 12)
- If a known issue is resolved, move it out of section 10 into the Change Log with `FIXED`

This keeps `APP_STATE.md` accurate enough that future sessions can answer "what's built / where do we continue" without re-reading the codebase.

## Commands

```bash
# From repo root
npm run dev          # Start Next.js dev server (pimpit-web)
npm run build        # Build pimpit-web for production
npm run start        # Start production server

# Inside pimpit-web/
npm run lint         # ESLint check
npm run dev          # next dev
```

There are no automated test suites. Validation is done manually via the admin UI or by running the sync and checking `sync_logs`.

## Architecture

This is a **B2B-B2C e-commerce platform** for wheel/rim/accessories aggregation from multiple suppliers. The repo has one Next.js package:

- **`pimpit-web/`** — Next.js 14 app. Storefront, admin panel, API routes, AND the ETL runner (in-process, triggered manually from the admin UI).
- **`supabase/`** — PostgreSQL migrations only.

Backend is **Supabase** (Postgres + Auth + Storage). The web app uses `@supabase/ssr` with the service role key for admin operations (bypasses RLS). Auth uses `createClient()` from `lib/supabase/server.ts` for cookie-based user sessions.

### Key path alias
`@/*` maps to `pimpit-web/` root.

### Import / Sync Pipeline

Supplier product import flows through these layers:

1. **Admin UI** — `app/admin/importuri/` — supplier CRUD and config
2. **Wizard** — `components/admin/ImportWizard.tsx` — multi-step config: feed URL, auth, delimiter, secondary feed, field mappings, REST image API
3. **API routes** — `app/api/admin/feeds/` — CRUD for `suppliers` table
4. **Import trigger** — `app/api/admin/feeds/[id]/import/route.ts` — calls `runImport()`
5. **`lib/importRunner.ts`** — Orchestrates: fetch feed → parse rows → deduplicate → upsert products+sources → update supplier stats → log to `sync_logs`
6. **`lib/feedParser.ts`** — Parses CSV/JSON/XML/XLSX buffers into row arrays
7. **`lib/genericParser.ts`** — Applies `FieldMappings` to a row → `ParsedProduct`
8. **`lib/formulaEvaluator.ts`** — Evaluates price formula strings (e.g. `price * 1.19`)

### Supplier Configuration

All per-supplier config lives in `suppliers.driver_config` (JSONB). Key fields:

| Key | Purpose |
|-----|---------|
| `field_mappings` | Column→field map (`part_number`, `brand`, `name`, `price_formula`, `image_api_id`, …) |
| `csv_delimiter` | CSV delimiter override |
| `api_key` / `token` / `customer_id` | Auth credentials |
| `image_api_url_template` | REST image proxy URL template, e.g. `https://api.example.com/Images/{Id}` |
| `secondary_feed_url` | Optional second feed to merge into primary via join keys |
| `secondary_join_key` / `primary_join_key` | Column names for merging feeds |

Feed URL can contain `{API_KEY}` / `{TOKEN}` placeholders resolved from env vars at runtime (via `supplier.api_key_ref` / `token_ref`).

### REST Image Proxy

For suppliers (e.g. Statusfalgar) that serve images behind auth:
- At import time, `products.images` is set to `["/api/images/{supplierId}/{imageId}"]`
- `app/api/images/[supplierId]/[imageId]/route.ts` fetches the real image from the supplier API with Basic Auth injected server-side
- Images are cached 1h in browser + CDN (`stale-while-revalidate=86400`)

### ZIP Image Import

For suppliers providing images in ZIP files (e.g. MB Design):
- `ParsedProduct` carries `zipImageUrl` + `zipImageIds[]`
- `lib/imageImporter.ts` downloads, extracts, and uploads to Supabase Storage `product-images` bucket
- Called post-upsert in `importRunner.ts` only when products have `zipImageUrl` set

### Database Key Tables

- `suppliers` — feed sources (config, auth, sync stats)
- `products` — aggregated products (upserted on `part_number,brand`)
- `product_sources` — per-supplier raw data audit trail (upserted on `part_number,brand,supplier_id`)
- `sync_logs` — import run history
- `users` — roles: `customer_b2c`, `customer_b2b`, `admin`
- `orders` / `order_items` / `cart` / `addresses` — commerce

### Product Types / Enums

`product_type_enum`: `jante` (wheels), `accesorii` (accessories)  
`feed_format_enum`: `csv`, `json`, `xml`  
`auth_method_enum`: `none`, `api_key`, `basic_auth`, `oauth`

### Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Supplier API credentials are stored directly in `driver_config` or referenced via env var names in `api_key_ref` / `token_ref` fields.

### Admin Routes

All admin pages are under `app/admin/` and protected by role check. Key sections:
- `importuri/` — supplier feed management
- `sincronizari/` — sync history and manual trigger
- `produse/` — product browser/editor
- `furnizori/` — supplier list
