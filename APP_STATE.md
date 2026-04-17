# APP_STATE — Source of Truth

> **Scop:** Fișier unic de referință pentru starea completă a aplicației Pimpit B2B/B2C.
> **Regulă:** La orice modificare funcțională (feature nou, schimbare de schemă, API nou, bugfix semnificativ) **acest fișier trebuie actualizat** în același commit. Secțiunile "Known Issues" și "Roadmap" se ajustează pe măsură ce lucrurile avansează.
> **Citire:** Claude Code trebuie să consulte acest fișier la începutul fiecărei sesiuni, ÎNAINTE de a citi cod.

Ultima actualizare: 2026-04-17

---

## 1. Overview

Pimpit este o platformă **B2B + B2C de e-commerce pentru jante (wheels) și accesorii auto**, care agregă produse din mai mulți furnizori externi (feed-uri CSV/JSON/XLSX), aplică reguli de pricing per furnizor, deduplică produsele pe cheia `(part_number, brand)` și servește un catalog unificat cu filtrare fațetată.

**Core loops:**
- **ETL loop** — sync zilnic/on-demand din 7 furnizori → normalizare → dedup → upsert în `products` + audit în `product_sources`.
- **Storefront loop** — browse catalog cu filtre cascade → product detail → coș → checkout (Ramburs).
- **Admin loop** — CRUD furnizori/pricing rules → trigger import → inspecție sync logs → editare produse inline + bulk.

**Branduri de produse:** jante (`product_type = 'jante'`) și accesorii (`product_type = 'accesorii'`).
**Moneda finală:** RON. Conversiile se fac în `pricing_rules.base_multiplier`.
**Piețe:** RO (domeniu `pimpit.ro`).

---

## 2. Tech Stack

| Layer | Tehnologie |
|---|---|
| Frontend + API | Next.js 14 (App Router) + React 18 + TypeScript |
| UI | TailwindCSS + Radix UI primitives + lucide-react |
| State (client) | Zustand (cart) |
| Forms | react-hook-form + zod (parțial) |
| Backend | Supabase (Postgres 15 + Auth + Storage) |
| ETL (separat) | Node.js CLI standalone în `pimpit-etl/` (tsx + papaparse) |
| Hosting web | Vercel (presupus) |
| Hosting ETL | Railway (declanșat via webhook `ETL_RAILWAY_URL`) |
| Parsere feed | papaparse (CSV), XLSX (Excel), native JSON, fflate (ZIP) |

**Node version:** presupus 20+ (nu e fixat în `.nvmrc`).

---

## 3. Repo Structure

```
/
├── CLAUDE.md                  # Reguli/instrucțiuni pentru Claude Code
├── APP_STATE.md               # ← ACEST FIȘIER (source of truth)
├── README.md                  # Scurt, orientat utilizator
├── package.json               # Wrapper root (dev/build/start proxy pentru pimpit-web)
├── pimpit-web/                # Next.js 14 — storefront + admin + API routes
│   ├── app/                   # Route handlers și pages (App Router)
│   ├── components/            # UI componente (shared, catalog, admin)
│   ├── lib/                   # Utilități + business logic (importRunner, parsers, supabase clients)
│   ├── middleware.ts          # Refresh sesiune auth
│   └── package.json
├── pimpit-etl/                # CLI standalone Node.js (sync scheduled extern)
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   └── etl/               # driver, parsers, pricing, normalizer, sync
│   └── package.json
├── supabase/
│   └── migrations/            # 8 migrații SQL (001...008)
└── .env.example
```

**Import alias:** `@/*` → `pimpit-web/*`.
**Comenzi principale:** `npm run dev` (root), `npm run lint` / `npm run build` (în `pimpit-web/`), `npm run sync` (în `pimpit-etl/`).

**Nu există teste automate.** Validarea se face manual prin UI admin sau rulând sync și verificând `sync_logs`.

---

## 4. Storefront — Pagini & Funcționalități

### Rute publice

| Rută | Fișier | Descriere |
|---|---|---|
| `/` | `app/page.tsx` | Landing cu hero + CTA spre `/jante` |
| `/jante` | `app/jante/page.tsx` | Catalog jante (server-side). 24/pagină. Filtre fațetate cu RPC `get_cascading_filter_options`. Sort: stock / preț asc/desc / newest. |
| `/jante/[slug]` | `app/jante/[slug]/page.tsx` | Detaliu produs. ISR 1h. Galerie imagini, spec-uri, YouTube embed, 3D model iframe, certificat TÜV, add-to-cart. `generateStaticParams` pre-build pentru top 1000. |
| `/accesorii` | `app/accesorii/page.tsx` | Catalog accesorii. RPC dedicat `get_cascading_filter_options_accesorii` (fără diameter/width/pcd). |
| `/cos` | `app/cos/page.tsx` | Coș Zustand. Subtotal, shipping (gratuit > 1000 RON altfel 50 RON). |
| `/checkout` | `app/checkout/page.tsx` | Form contact + adresă livrare. Plata hardcoded `ramburs`. POST spre `/api/orders`. |
| `/cont` | `app/cont/page.tsx` | Dashboard user. Profil (B2C/B2B), istoric comenzi cu badges status. Require auth. |
| `/auth/login` | `app/auth/login/page.tsx` | Email/parolă Supabase. Admin → `/admin`, restul → `/cont`. |
| `/setup` | `app/setup/page.tsx` | One-time: creează primul admin dacă nu există niciunul. |

### API publice

| Endpoint | Metodă | Descriere |
|---|---|---|
| `/api/products` | GET | Listă produse cu cursor pagination (limit 24). Filtre: brand, diameter, width, pcd, et_offset, product_type, price_min/max, in_stock, search. Mapează `price_b2b` pe `price` dacă user = customer_b2b. |
| `/api/cart` | GET/POST/DELETE | Coș pe `user_id` sau `session_id` (cookie). |
| `/api/orders` | POST | Creează order + order_items din cart curent. Validează stock. Șterge coșul la success. |
| `/api/filters` | GET | Filter options cached 1h (din `filter_options` MV). |
| `/api/image-proxy` | GET | Proxy imagini cu User-Agent de browser (ocolește CDN-uri care blochează serverless). Cache 1h + SWR 24h. |
| `/api/images/[supplierId]/[imageId]` | GET | Proxy imagini REST pentru furnizori cu auth (Statusfälgar). Basic Auth injectat server-side. |
| `/api/sitemap.xml` | GET | Sitemap dinamic cu toate produsele active. |

### Componente cheie

- `components/shared/Navbar.tsx` — navbar fix, mobile hamburger, link coș.
- `components/catalog/ProductCard.tsx` — card cu imagine, specs grid, badge stoc (verde/galben/roșu), preț + preț vechi, CTA add-to-cart.
- `components/catalog/FilterSidebar.tsx` — filtre cascade (Brand, Model, Diameter, Width, PCD, Color, Finish, Price). Active chips + reset all. State prin URL params.
- `components/catalog/MobileFilters.tsx` — modal trigger pe mobile cu badge count.
- `components/catalog/CatalogControls.tsx` — search input + sort dropdown + counts.
- `components/catalog/PriceDisplay.tsx` — formatare preț, strike old, badge B2B.
- `components/catalog/ProductImage.tsx` — wrapper peste `next/image` cu fallback.

### State & auth

- **Cart:** Zustand store `lib/store/cart.ts`. Acceptă guest (session_id cookie) + authenticated (user_id).
- **Auth:** Supabase `@supabase/ssr`. `lib/supabase/server.ts` (cookie-based) și `lib/supabase/client.ts` (browser).
- **Middleware:** `middleware.ts` → `lib/supabase/middleware.ts` refresh sesiune pe fiecare navigare (exclude `_next`, `/api/images`, favicons).

---

## 5. Admin Panel

Toate rutele `/admin/*` sunt protejate de check în `app/admin/layout.tsx` (redirect dacă `role != 'admin'`). Layout-ul client `AdminLayoutClient.tsx` oferă sidebar + drawer mobil.

### Pagini admin

| Rută | Fișier | Funcționalitate |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Dashboard: 3 stats (produse active, users, orders). |
| `/admin/produse` | `app/admin/produse/page.tsx` + `ProduseClient.tsx` | Table cu inline edit (click pe celulă). Bulk actions, search, filtre activ/supplier. 50/pagină. Modal 2-step pentru "Delete All". |
| `/admin/importuri` | `app/admin/importuri/page.tsx` | Listă feed-uri cu status, ultima sincronizare, Config + Import buttons (via `ImportActions.tsx`). |
| `/admin/importuri/nou` | `app/admin/importuri/nou/page.tsx` | Form furnizor nou (wizard multi-step `ImportWizard.tsx`). |
| `/admin/importuri/[id]/edit` | `app/admin/importuri/[id]/edit/page.tsx` | Editare config supplier. `force-dynamic` pentru a evita cache Next stale. |
| `/admin/furnizori` | `app/admin/furnizori/page.tsx` | Listă furnizori cu pricing rules inline (base discount, multiplier, fixed cost, margin). |
| `/admin/sincronizari` | `app/admin/sincronizari/page.tsx` + `SyncTrigger.tsx` | Istoric ultime 50 rulări ETL. Buton global sync (trigger Railway webhook). |

### API admin

| Endpoint | Metodă | Funcție |
|---|---|---|
| `/api/admin/produse` | GET/POST | Listă paginată (50/pg) + creare produs. |
| `/api/admin/produse/[id]` | GET/PATCH/DELETE | CRUD single. **ATENȚIE: GET nu are `checkAdmin()` — known issue.** |
| `/api/admin/produse/bulk` | POST | Bulk: activate / deactivate / set_price / set_stock / price_formula / delete. |
| `/api/admin/produse/delete-all` | DELETE | Nuke catalog. |
| `/api/admin/feeds` | GET/POST | CRUD suppliers. Auto-ID la creare. |
| `/api/admin/feeds/[id]` | GET/POST | Single supplier CRUD. |
| `/api/admin/feeds/[id]/import` | POST | Trigger `runImport()` pe un singur supplier. |
| `/api/admin/feeds/preview` | POST | Preview rânduri dintr-un fișier upload. |
| `/api/admin/feeds/upload-preview` | POST | Preview CSV/XLSX/JSON uploaded. |
| `/api/admin/feeds/statusfalgar-preview` | POST | Preview Statusfälgar multi-endpoint. |
| `/api/admin/feeds/scan-column` | POST | Extract unique values dintr-o coloană (pentru maparea câmpurilor). |
| `/api/admin/sync` | POST | Trigger global sync (webhook Railway). |
| `/api/setup-admin` | POST | One-time setup admin inițial. |

### ImportWizard — pași

`components/admin/ImportWizard.tsx` definește multi-step config pentru un supplier:

1. **Feed URL** — poate conține placeholdere `{API_KEY}` / `{TOKEN}` rezolvate din env vars prin `supplier.api_key_ref` / `token_ref`.
2. **Auth** — none / api_key / basic_auth / oauth.
3. **Format + delimiter** — CSV (cu delimiter custom) / JSON / XML / XLSX.
4. **Secondary feed** (opțional) — URL feed secundar + join keys (`primary_join_key` ↔ `secondary_join_key`).
5. **Field mappings** — map coloane feed → câmpuri produs (`part_number`, `brand`, `name`, `price_formula`, `image_api_id`, diameter, width, pcd, etc.).
6. **REST image API** (opțional) — `image_api_url_template` pentru fetch individual imagini cu auth.
7. **Brand filter** — whitelist/blacklist.

Toată config-ul ajunge în `suppliers.driver_config` (JSONB).

---

## 6. ETL — Două implementări paralele (ATENȚIE!)

**Observație importantă:** Există DOUĂ pipeline-uri ETL care fac lucruri similare dar diferite:

### 6.1 `pimpit-web/lib/importRunner.ts` (in-process, declanșat din admin UI)

- Entry: `runImport(supplierId)` apelat din `/api/admin/feeds/[id]/import/route.ts`.
- Flow: fetch feed → `feedParser.parseFeedBuffer()` (CSV/JSON/XML/XLSX) → `genericParser.parseRow()` aplică `field_mappings` → dedup pe `(part_number, brand)` → batch upsert 250/lot în `products` și `product_sources` → post-upsert `imageImporter` pentru ZIP → log în `sync_logs`.
- Driver special: `lib/statusfalgarDriver.ts` (multi-endpoint: Articles + NetPrices + Stock).
- Timeout fetch: 180s. Timeout per batch: 120s.

### 6.2 `pimpit-etl/` (CLI standalone, Railway scheduled)

- Entry: `pimpit-etl/src/index.ts` → `syncAllSuppliers()` în `src/etl/sync.ts`.
- Config-driven prin tabelele `suppliers` + `pricing_rules` + `supplier_transforms`.
- Parseri supplier-specific în `src/etl/parsers.ts` (PARSER_MAP):
  - `supplier-1`, `supplier-2` (Google Sheets)
  - `wheeltrade` (CSV ;, API key, autodetect jante vs accesorii după coloanele `thickness`/`thread_size`)
  - `felgeo` (Polish, CSV ;, token)
  - `abs-wheels` (JSON, API key)
  - `statusfalgar` (JSON, basic auth SEK→RON)
  - `veemann` (CSV, suport `old_price_formula`)
- Pricing universal 6 pași: `raw * (1 - baseDiscount) * baseMultiplier + fixedCost) * vatMultiplier * marginMultiplier / finalDivisor`.
- Deduplicare: cel mai mic preț → stoc maxim → supplier ID cel mai mic.
- Safety checks înainte de commit: minim 100 produse + ≥50% din count existent.
- Post-sync: mark inactive produsele ne-sincronizate în ultimele 24h + refresh MV `filter_options`.

**⚠ Riscul de divergență:** Logica poate drift-a între cele două path-uri. Orice schimbare de mapping/pricing trebuie replicată în ambele sau consolidată.

### 6.3 Helpers comuni (în `pimpit-web/lib/`)

- `feedParser.ts` — parsează buffer → rows (CSV/JSON/XML/XLSX).
- `genericParser.ts` — aplică `FieldMappings` pe un rând → `ParsedProduct`. Templates `{col}`. Filtre brand/model.
- `formulaEvaluator.ts` — `evaluateFormula("{price} * 1.19", { price: 100 })`. Folosit și în admin bulk.
- `priceParser.ts` — `parseSmartNumber()` tratează format european (14.000,00) vs US (14,000.00).
- `pcdUtils.ts` — normalizare PCD "5x112", split pentru multi-bolt "5X112/4X100".
- `imageImporter.ts` — download ZIP + extract + upload în Supabase Storage `product-images`.

---

## 7. Database Schema (Supabase / Postgres)

### 7.1 Enum-uri

```
product_type_enum   → 'jante' | 'accesorii'
sync_status_enum    → 'running' | 'success' | 'failed' | 'aborted'
auth_method_enum    → 'none' | 'api_key' | 'basic_auth' | 'oauth'
feed_format_enum    → 'csv' | 'json' | 'xml' | 'xlsx'
user_role_enum      → 'customer_b2c' | 'customer_b2b' | 'admin'
order_status_enum   → 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
```

### 7.2 Tabele

| Tabelă | Scop | PK / Unique |
|---|---|---|
| `suppliers` | Furnizori + config (`driver_config` JSONB, `brand_whitelist/blacklist`, `csv_delimiter`, refs env) | PK `id` (SMALLINT), UNIQUE `slug` |
| `pricing_rules` | Per-supplier: `base_discount`, `base_multiplier`, `fixed_cost`, `vat_multiplier`, `margin_multiplier`, `final_divisor`, `old_price_formula` | PK `id`, FK `supplier_id` |
| `supplier_transforms` | Reguli transformare (dual_price, brand_remap, image_url_prefix, brand_whitelist). `sort_order` determină ordinea. | PK `id`, FK `supplier_id` |
| `products` | Catalog unificat post-dedup. Câmpuri cheie: `part_number`, `brand`, `name`, `slug`, `product_type`, `diameter`, `width`, `pcd`, `et_offset`, `center_bore`, `price`, `price_old`, `price_b2b`, `images[]`, `stock`, `stock_incoming`, `winning_supplier_id`, `custom_fields` JSONB. Plus câmpuri extinse: `model`, `ean`, `weight`, `max_load`, `certificate_url`, `discontinued`, `is_active`, `last_synced_at`. | PK `id` UUID, UNIQUE `(part_number, brand)`, UNIQUE `slug` |
| `product_sources` | Audit trail: un rând per (product × supplier). `raw_price`, `raw_currency`, `calculated_price`, `raw_data` JSONB, `last_seen_at`. | PK `id`, UNIQUE `(part_number, brand, supplier_id)` |
| `price_history` | Auto-populat prin trigger `trg_price_history` la UPDATE pe `price`/`price_b2b`. | PK `id`, FK `product_id`, index `(product_id DESC, recorded_at DESC)` |
| `sync_logs` | Istoric rulări ETL. `status`, `products_fetched/inserted/updated/skipped`, `safety_check_*`, `error_*`, `duration_ms`. | PK `id` |
| `users` | Extinde `auth.users`. `role`, info B2B (`company_name`, `cui`, `reg_com`, `b2b_discount_pct`). Trigger `on_auth_user_created` auto-inserează. | PK `id` FK `auth.users(id)` |
| `addresses` | Adrese livrare/facturare user. | PK `id`, FK `user_id` |
| `cart` | Coș. Suportă auth (`user_id`) SAU anon (`session_id`). | UNIQUE `(user_id, product_id)` și `(session_id, product_id)` |
| `orders` | Header comandă. Acceptă guest (user_id NULL). `shipping_address`/`billing_address` JSONB snapshot. | PK `id` |
| `order_items` | Line items cu snapshot produs (nume/brand/PN/imagine) pentru că produsele se pot șterge. | PK `id`, FK `order_id`, FK `product_id` ON DELETE SET NULL |
| `price_alerts` | Alerte client când preț < `target_price`. | UNIQUE `(user_id, product_id)` |

### 7.3 Indexuri pe `products`

`is_active`, `brand`, `diameter`, `width`, `pcd`, `et_offset`, `price`, `stock`, `product_type`, `winning_supplier_id`.
**Trigram GIN:** `name`, `brand` (fuzzy search).
**Full-text:** combinat `brand + name + part_number`.

### 7.4 RPC / Funcții

| Funcție | Scop |
|---|---|
| `get_cascading_filter_options(...)` | Returnează opțiunile disponibile pentru fiecare dimensiune dat fiind filtrele curente. Pattern "exclude self" (fiecare dimensiune se re-calculează excluzând propriul filtru). Suportă PCD exploding pentru multi-bolt. Doar `product_type='jante'`. |
| `get_cascading_filter_options_accesorii(...)` | Similar, doar pentru accesorii, fără diameter/width/pcd. |
| `refresh_filter_options()` | REFRESH MATERIALIZED VIEW CONCURRENTLY `filter_options`. Chemat după fiecare sync. |
| `record_price_change()` | Trigger function → insert în `price_history` când `price` sau `price_b2b` se schimbă. |
| `handle_new_user()` | Trigger function → auto-insert în `public.users` la INSERT în `auth.users`. Default `role='customer_b2c'`. |
| `get_my_role()` | Helper → returnează rolul user-ului curent. |

### 7.5 Materialized View

`filter_options` — agregări pre-calculate (arrays de brands/diameters/widths/pcds/et_offsets + MIN/MAX price + COUNT). Refresh după fiecare sync.

### 7.6 Storage

Bucket `product-images` (public, 10MB limit, PNG/JPEG/WebP).
Policy: public READ, service_role WRITE.

### 7.7 RLS (rezumat)

- `products`: public READ dacă `is_active=true`; service_role write.
- `product_sources`, `sync_logs`, `pricing_rules`, `supplier_transforms`, `suppliers` (write): admin sau service_role.
- `users`, `addresses`, `cart`, `price_alerts`: own-rows (`user_id = auth.uid()`).
- `orders`: own-read, public-insert (guest checkout), admin-update.

### 7.8 Migrații aplicate

```
001_add_custom_fields.sql              → custom_fields JSONB
002_cascading_filter_options_rpc.sql   → RPC fațetat (v1)
003_product_fields_expansion.sql       → lățire coloane + metadata
004_filter_options_with_model.sql      → adăugare dimensiune model
005_pcd_exploded_filter.sql            → PCD array overlap pentru multi-bolt
006_accesorii_filter_rpc.sql           → RPC separat accesorii
007_product_images_bucket.sql          → bucket storage
008_feed_format_xlsx.sql               → XLSX în enum
```

---

## 8. Business Logic — Reguli cheie

### 8.1 Pricing universal (6 pași)

```
price = raw_price
      × (1 - base_discount)    // step 1: reducere de la furnizor
      × base_multiplier        // step 2: conversie valutară (EUR→RON ≈ 5-6, SEK→RON, etc.)
      + fixed_cost             // step 3: cost fix (transport intern, împachetare)
      × vat_multiplier         // step 4: TVA (1.19 sau 1.21 PL)
      × margin_multiplier      // step 5: marjă
      / final_divisor          // step 6: divizor final (de obicei 1)
```

Reguli per supplier în `pricing_rules`. Opțional `min_margin_pct` și `old_price_formula` (pentru "preț vechi" strikethrough).

### 8.2 Transformări supplier (`supplier_transforms`)

- `dual_price` — dacă SRP vs NET diferă peste un threshold, aplică multiplicatori diferiți (Wheeltrade).
- `brand_remap` — corectează brand-uri malformate (ABS Wheels: "stw" → "STW", "355" → ignorat).
- `image_url_prefix` — construiește URL complet imagine (Statusfälgar: prefix + ImageId).
- `brand_whitelist` — permite doar anumite brand-uri (Statusfälgar: Dirt AT, Boost, Status Wheels).

### 8.3 Dedup & winning supplier

La upsert în `products`:
1. Toate variantele unui `(part_number, brand)` intră în `product_sources`.
2. Variantele se reduc la una singură: **cel mai mic preț → cel mai mare stoc → supplier ID cel mai mic** (tie-break determinist).
3. Câștigătorul setează `winning_supplier_id`, `winning_raw_price`, `price`, `stock`, `images`, etc.

### 8.4 B2B pricing

- User cu `role = 'customer_b2b'` vede `products.price_b2b` în loc de `price`.
- Mapare făcută **la runtime în `/api/products`** (nu în DB). Fallback la `price` dacă `price_b2b` e NULL.
- **Nu există încă aplicare automată a `b2b_discount_pct`** — câmpul există dar e ignorat de cod.

### 8.5 Stock logic

- `stock` = stock real disponibil.
- `stock_incoming` = stoc comandat de la producător ("on the water").
- La checkout, `orders` validează `p.stock >= quantity`. Nu rezervă stoc înainte de plată.

### 8.6 Shipping & plăți

- Shipping gratuit peste **1000 RON**, altfel **50 RON** (hardcoded în `app/checkout/page.tsx` și `app/api/orders/route.ts`).
- Singurul payment method suportat: `ramburs` (cash on delivery). **Nu există integrare de plată online.**

### 8.7 Imagini — trei strategii

1. **Direct URL** — `products.images` conține URL-ul din feed (cei mai mulți furnizori).
2. **REST proxy** — pentru furnizori cu auth (Statusfälgar): `images = ["/api/images/{supplierId}/{imageId}"]`. Proxy server-side cu Basic Auth. Cache 1h browser + CDN + SWR 24h.
3. **ZIP download** — pentru furnizori ca MB Design: `zipImageUrl + zipImageIds[]` → `imageImporter.ts` descarcă, extrage, upload în bucket `product-images`.

### 8.8 Slug generation

Pattern: `brand-name-diameterxwidth-pcd`. Coliziuni rezolvate cu sufix `part_number`, apoi counter numeric.

### 8.9 Feed URL placeholders

`{API_KEY}`, `{TOKEN}`, `{CUSTOMER_ID}` rezolvate la runtime din env vars prin `api_key_ref`/`token_ref`/`customer_id_ref` pe row-ul `suppliers`. **Credentialele NU se stochează în DB în clar** (doar numele env var).

---

## 9. Environment Variables

### Web (`pimpit-web`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # bypass RLS pentru operații admin
ETL_RAILWAY_URL                 # webhook pentru sync global
NEXT_PUBLIC_SITE_URL            # default https://pimpit.ro (sitemap)
```

### ETL (`pimpit-etl`)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WHEELTRADE_API_KEY
ABS_WHEELS_API_KEY
STATUSFALGAR_CUSTOMER_ID
STATUSFALGAR_TOKEN
FELGEO_TOKEN
```

Credentialele noi per supplier se adaugă ca env vars + se referențiază din `suppliers.{api_key_ref | token_ref | customer_id_ref}`.

---

## 10. Known Issues & Tech Debt

Confirmate prin audit pe cod la data 2026-04-17.

### 10.1 Critice (de rezolvat prioritar)

| # | Issue | Fișier | Impact |
|---|---|---|---|
| C1 | `GET /api/admin/produse/[id]` **nu verifică admin**. Orice user poate prin hit direct. | `app/api/admin/produse/[id]/route.ts:12` | Information disclosure |
| C2 | Bulk `price_formula` face **N update-uri separate** (1 + N queries). | `app/api/admin/produse/bulk/route.ts:57-71` | Performance + timeout la bulk mare |
| C3 | `/api/orders` **nu validează** `shipping_address`, `customer_email`, `customer_phone`, `customer_name`. Insert direct. | `app/api/orders/route.ts:6-7` | Date corupte + potențial stored XSS |
| C4 | Form checkout trimite **orice** conținut ca address. Fără validare client nici server. | `app/checkout/page.tsx:16-34` | Data integrity |
| C5 | Search folosește `or(name.ilike.%${search}%,...)` cu **interpolare directă a input-ului** în filter string. Potențial bypass/injection în filter expression-ul PostgREST. | `app/api/products/route.ts:39`, `app/api/admin/produse/route.ts` | PostgREST injection (low severity dar real) |

### 10.2 High

| # | Issue | Fișier |
|---|---|---|
| H1 | Lookup `users.role` pe **fiecare** request la `/api/products` și la fiecare pagină de produs → query DB duplicat. | `app/api/products/route.ts:59-64`, `app/jante/[slug]/page.tsx:48-52` |
| H2 | `app/admin/furnizori/page.tsx` face `select('*, pricing_rules(*)')` → transfer mare la scală. | linia 8-11 |
| H3 | `/public/robots.txt` lipsă (nu există fișier). | — |
| H4 | `ProduseClient.tsx` folosește `<img>` nativ în tabel, nu `next/image`. | linia ~256 |
| H5 | Paginarea admin nu are upper bound pe `limit` → `?limit=999999` posibil. | `app/api/admin/produse/route.ts:26-27` |
| H6 | Formula bulk fără limită de lungime / whitelist operatori. | `app/api/admin/produse/bulk/route.ts:61` |
| H7 | Nu există rate limiting pe `/api/admin/*` (în special `sync`, `delete-all`, `import`). | toate rutele admin |

### 10.3 Medium / Low

- `any`-uri în `lib/importRunner.ts:68` (`supplier: any`) și `lib/imageImporter.ts` (`supabase: any`).
- `alt=""` pe carusel produs (`app/jante/[slug]/page.tsx:73`).
- Lipsă structured data JSON-LD pe pagini de produs (SEO).
- Lipsă `revalidate` / cache headers pe `/api/products` public.
- Timeout-uri hardcoded în importRunner (180s / 120s).
- Sincronizare log-uri doar în DB; fără integrare Sentry/DataDog.
- **Divergență potențială între `pimpit-web/lib/importRunner.ts` și `pimpit-etl/src/etl/sync.ts`** — aceleași reguli implementate în două locuri.
- `b2b_discount_pct` din `users` nu e aplicat nicăieri în cod.

---

## 11. Roadmap — Optimizări imediate propuse

Ordinea recomandată (de rezolvat în sesiuni viitoare):

1. **Fix auth GET admin produs** (C1) — adaugă `checkAdmin()` în handler GET.
2. **Validare Zod pentru `/api/orders`** (C3, C4) — schemă strictă pentru address + contact; respinge request-uri fără câmpuri minime; sanitizează stringuri.
3. **Batch update în bulk price formula** (C2) — grupează în chunks de 100-250 cu `upsert` sau construiește query SQL raw cu CASE WHEN.
4. **Escape input la ILIKE search** (C5) — escape `%`, `_`, `,` înainte de interpolare; sau folosește `.ilike('col', `%${escape(input)}%`)` direct cu parametri.
5. **Cache user role în middleware** (H1) — încarcă `role` într-un cookie/JWT claim la login; elimină lookup per-request.
6. **`public/robots.txt`** (H3) — include sitemap link.
7. **`limit` cap + validare paginare admin** (H5).
8. **Rate limiting** (H7) — middleware simplu pe `/api/admin/*` (token bucket, in-memory pentru MVP, Upstash Redis pentru prod).
9. **Unificare ETL** — consolidează `importRunner.ts` și `pimpit-etl/` într-un pachet comun `packages/etl-core` (refactor mai mare — pentru iterație ulterioară).
10. **Structured data JSON-LD** pentru produse (SEO).
11. **Aplicare `b2b_discount_pct`** în `/api/products` dacă `price_b2b` e NULL dar user e B2B.

---

## 12. Change Log

> Fiecare sesiune care modifică aplicația **trebuie să adauge o linie aici**. Formatul:
> `YYYY-MM-DD — [scurt] — [fișiere / zone afectate] — [link commit/PR dacă există]`

- 2026-04-17 — Initial APP_STATE created (audit complet, baseline) — `APP_STATE.md`, `CLAUDE.md`

---

## 13. Notes pentru Claude Code (best practices session)

- **Citește APP_STATE.md înainte de cod** când userul cere ceva care afectează features existente.
- **La fiecare modificare**, updatează secțiunea relevantă (feature, schema, business logic) și adaugă linie în Change Log.
- **Rute admin noi** → adaugă în secțiunea 5; verifică că ai `checkAdmin()` în handler.
- **Migrații noi** → adaugă în 7.8; documentează coloanele noi în 7.2.
- **Supplier nou** → documentează în 6.2 + env vars în 9.
- **Dacă rezolvi un Known Issue**, mută-l din secțiunea 10 în Change Log cu status `FIXED`.
- Pentru explorări noi mari, delegă la **Agent(Explore)** în loc de grep manual, pentru a economisi context.
- Pentru task-uri lungi cu mai multe fișiere, împarte în etape mici (pattern folosit la construirea acestui fișier) ca să eviți stream timeouts.




