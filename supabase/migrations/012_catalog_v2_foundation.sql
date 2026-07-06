-- ============================================================================
-- 012 — CATALOG V2 FOUNDATION (additive only — v1 tables untouched)
-- categories / brands / manufacturers
-- catalog_products / product_variants / supplier_offers / media_assets
-- See docs/CATALOG_V2_PLAN.md
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION slugify(input text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT trim(BOTH '-' FROM
    regexp_replace(
      regexp_replace(lower(unaccent(input)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE media_kind_enum AS ENUM ('image', 'video', 'model_3d', 'document', 'certificate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_source_enum AS ENUM ('feed_url', 'rest_proxy', 'zip_import', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── categories (tree) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id   BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,             -- display name (RO)
  name_en     TEXT,                      -- optional EN name
  description TEXT,
  icon        TEXT,                      -- lucide icon name or asset path
  position    INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── manufacturers & brands ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manufacturers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  country    TEXT,
  website    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manufacturer_id BIGINT REFERENCES manufacturers(id) ON DELETE SET NULL,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  -- lowercase alternative spellings seen in feeds ("stw", "japanracing", …);
  -- import mapping resolves brand text through name+aliases
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  logo_url        TEXT,
  website         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_aliases ON brands USING GIN (aliases);

DROP TRIGGER IF EXISTS trg_brands_updated ON brands;
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── catalog_products (product family) ───────────────────────────────────────
-- One row per product *family* (e.g. wheel model "JR11"), not per size/finish.
-- Named catalog_products while legacy `products` still exists; may be renamed
-- to `products` in the final contract migration.

CREATE TABLE IF NOT EXISTS catalog_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id         BIGINT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,          -- family name, e.g. "JR11"
  description      TEXT,
  -- product-level (non variant-defining) attributes, e.g. construction type
  attrs            JSONB NOT NULL DEFAULT '{}',
  seo_title        TEXT,
  seo_description  TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  legacy_source    TEXT,                   -- 'v1_backfill' when created by backfill
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products(category_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_catalog_products_brand    ON catalog_products(brand_id)    WHERE is_active;

DROP TRIGGER IF EXISTS trg_catalog_products_updated ON catalog_products;
CREATE TRIGGER trg_catalog_products_updated BEFORE UPDATE ON catalog_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── product_variants (sellable SKU) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  -- denormalized from product for the hard dedup key (v1: UNIQUE(part_number, brand))
  brand_id          BIGINT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  part_number       TEXT NOT NULL,
  ean               TEXT,
  slug              TEXT UNIQUE,            -- optional deep-link slug
  name_suffix       TEXT,                   -- e.g. "9.5x19 ET35 5x112 Gloss Black"
  -- typed values live in product_variant_attributes (013);
  -- this mirror is maintained by trigger for fast faceting: { code: value }
  attrs             JSONB NOT NULL DEFAULT '{}',
  -- denormalized commerce fields, recomputed from supplier_offers
  price             NUMERIC(12,2),
  price_old         NUMERIC(12,2),
  price_b2b         NUMERIC(12,2),
  stock             INT NOT NULL DEFAULT 0,
  stock_incoming    INT NOT NULL DEFAULT 0,
  best_offer_id     UUID,                   -- FK added after supplier_offers exists
  weight_kg         NUMERIC(10,3),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  discontinued      BOOLEAN NOT NULL DEFAULT false,
  legacy_product_id UUID,                   -- v1 products.id when backfilled
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, part_number)
);

CREATE INDEX IF NOT EXISTS idx_variants_product   ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_attrs     ON product_variants USING GIN (attrs jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_variants_active    ON product_variants(is_active, price);
CREATE INDEX IF NOT EXISTS idx_variants_legacy    ON product_variants(legacy_product_id) WHERE legacy_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_pn_lower  ON product_variants(lower(part_number));

DROP TRIGGER IF EXISTS trg_variants_updated ON product_variants;
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── supplier_offers ─────────────────────────────────────────────────────────
-- One row per (variant × supplier). ALL offers are kept, not only the winner.

CREATE TABLE IF NOT EXISTS supplier_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id       UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  supplier_id      SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku     TEXT,
  raw_price        NUMERIC(14,4),
  raw_currency     TEXT NOT NULL DEFAULT 'RON',
  price            NUMERIC(12,2),          -- calculated sale price, RON
  price_old        NUMERIC(12,2),
  price_b2b        NUMERIC(12,2),
  stock            INT NOT NULL DEFAULT 0,
  stock_incoming   INT NOT NULL DEFAULT 0,
  lead_time_days   INT,
  is_available     BOOLEAN NOT NULL DEFAULT true,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_job_id    UUID,                   -- stamped at publish (FK in 014)
  raw_data         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_variant  ON supplier_offers(variant_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier ON supplier_offers(supplier_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_offers_job      ON supplier_offers(import_job_id) WHERE import_job_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_offers_updated ON supplier_offers;
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON supplier_offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS fk_variants_best_offer,
  ADD CONSTRAINT fk_variants_best_offer
    FOREIGN KEY (best_offer_id) REFERENCES supplier_offers(id) ON DELETE SET NULL;

-- ── media_assets ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID REFERENCES catalog_products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  kind         media_kind_enum   NOT NULL DEFAULT 'image',
  source       media_source_enum NOT NULL DEFAULT 'feed_url',
  url          TEXT NOT NULL,
  storage_path TEXT,              -- when hosted in our Storage bucket
  alt          TEXT,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_media_product ON media_assets(product_id, position);
CREATE INDEX IF NOT EXISTS idx_media_variant ON media_assets(variant_id, position);

-- ── Winner recompute ────────────────────────────────────────────────────────
-- Same tie-break as v1: lowest price → highest stock → lowest supplier id.

CREATE OR REPLACE FUNCTION recompute_variant_pricing(p_variant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  best supplier_offers%ROWTYPE;
BEGIN
  SELECT * INTO best
  FROM supplier_offers o
  WHERE o.variant_id = p_variant_id
    AND o.is_available
    AND o.price IS NOT NULL AND o.price > 0
  ORDER BY o.price ASC, o.stock DESC, o.supplier_id ASC
  LIMIT 1;

  IF best.id IS NULL THEN
    UPDATE product_variants
    SET best_offer_id = NULL, price = NULL, price_old = NULL, price_b2b = NULL,
        stock = 0, stock_incoming = 0, is_active = false
    WHERE id = p_variant_id;
  ELSE
    UPDATE product_variants
    SET best_offer_id  = best.id,
        price          = best.price,
        price_old      = best.price_old,
        price_b2b      = best.price_b2b,
        stock          = best.stock,
        stock_incoming = best.stock_incoming,
        is_active      = NOT discontinued
    WHERE id = p_variant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_offer_recompute()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_variant_pricing(OLD.variant_id);
    RETURN OLD;
  END IF;
  PERFORM recompute_variant_pricing(NEW.variant_id);
  IF TG_OP = 'UPDATE' AND NEW.variant_id <> OLD.variant_id THEN
    PERFORM recompute_variant_pricing(OLD.variant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_recompute ON supplier_offers;
CREATE TRIGGER trg_offers_recompute
  AFTER INSERT OR UPDATE OR DELETE ON supplier_offers
  FOR EACH ROW EXECUTE FUNCTION trg_offer_recompute();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Writes happen exclusively through the service-role client (bypasses RLS).

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_offers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY categories_public_read ON categories FOR SELECT USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manufacturers_public_read ON manufacturers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY brands_public_read ON brands FOR SELECT USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY catalog_products_public_read ON catalog_products FOR SELECT USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY product_variants_public_read ON product_variants FOR SELECT USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  -- offers are visible to admins only (raw supplier pricing is sensitive)
  CREATE POLICY supplier_offers_admin_read ON supplier_offers FOR SELECT
    USING (get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY media_assets_public_read ON media_assets FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Category seed ───────────────────────────────────────────────────────────

WITH roots(slug, name, name_en, position) AS (
  VALUES
    ('jante',                'Jante',                  'Wheels',                 10),
    ('anvelope',             'Anvelope',               'Tires',                  20),
    ('pachete-jante-anvelope','Pachete Jante + Anvelope','Wheel & Tire Packages', 30),
    ('suspensii',            'Suspensii',              'Suspension',             40),
    ('iluminat',             'Iluminat',               'Lighting',               50),
    ('frane',                'Frâne',                  'Brakes',                 60),
    ('tpms',                 'Senzori TPMS',           'TPMS',                   70),
    ('distantiere',          'Distanțiere & Adaptoare','Spacers & Adapters',     80),
    ('prezoane-piulite',     'Prezoane & Piulițe',     'Bolts & Lug Nuts',       90),
    ('body-kit',             'Body Kit & Aero',        'Body Kits & Aero',      100),
    ('accesorii',            'Accesorii',              'Accessories',           110)
)
INSERT INTO categories (slug, name, name_en, position)
SELECT slug, name, name_en, position FROM roots
ON CONFLICT (slug) DO NOTHING;

WITH children(parent_slug, slug, name, name_en, position) AS (
  VALUES
    ('suspensii', 'arcuri-sport',   'Arcuri sport',        'Lowering Springs', 10),
    ('suspensii', 'coilovere',      'Coilovere',           'Coilovers',        20),
    ('suspensii', 'suspensii-aer',  'Suspensii pe aer',    'Air Suspension',   30),
    ('iluminat',  'faruri',         'Faruri',              'Headlights',       10),
    ('iluminat',  'stopuri',        'Stopuri',             'Taillights',       20),
    ('frane',     'kituri-frana',   'Kituri frână',        'Brake Kits',       10),
    ('frane',     'placute-frana',  'Plăcuțe frână',       'Brake Pads',       20),
    ('frane',     'discuri-frana',  'Discuri frână',       'Brake Rotors',     30)
)
INSERT INTO categories (parent_id, slug, name, name_en, position)
SELECT p.id, c.slug, c.name, c.name_en, c.position
FROM children c
JOIN categories p ON p.slug = c.parent_slug
ON CONFLICT (slug) DO NOTHING;
