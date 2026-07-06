-- ============================================================================
-- 015 — VEHICLE FITMENT LAYER
-- vehicle_makes / vehicle_models / vehicle_generations / vehicles
-- vehicle_fitments (galeria de 57k fitmenturi Fitment Industries)
-- variant_vehicle_compatibility / fitment_rules / fitment_warnings
-- Vezi docs/CATALOG_V2_PLAN.md §3.3; seed prin scripts/import-fitment-gallery.ts
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE fitment_position_enum AS ENUM ('front', 'rear', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fitment_source_enum AS ENUM ('fitment_gallery', 'supplier', 'rule', 'manual', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Ierarhia vehiculelor ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_makes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,               -- forma canonică ("Infiniti", nu "INFINITI")
  logo_url   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id    BIGINT NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (make_id, slug)
);

-- Generații (ex. Golf Mk7, BMW E90). Populate ulterior din surse OEM;
-- galeria FI nu conține generația, doar anul.
CREATE TABLE IF NOT EXISTS vehicle_generations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id   BIGINT NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  code       TEXT,                        -- 'Mk7', 'E90', 'W205'
  name       TEXT NOT NULL,
  year_from  SMALLINT,
  year_to    SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, name)
);

-- Vehicul concret: model + an + trim ("2026 Toyota Camry SE").
CREATE TABLE IF NOT EXISTS vehicles (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id      BIGINT NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  generation_id BIGINT REFERENCES vehicle_generations(id) ON DELETE SET NULL,
  year          SMALLINT NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  trim          TEXT NOT NULL DEFAULT '',
  -- specificații OEM când vor exista: bolt_pattern, center_bore_mm,
  -- oem_diameter/width/et, thread, tire sizes
  specs         JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, year, trim)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_model_year ON vehicles(model_id, year DESC);

-- ── vehicle_fitments — setup-uri reale (galeria FI + viitoare surse) ────────

CREATE TABLE IF NOT EXISTS vehicle_fitments (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id         BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  source             fitment_source_enum NOT NULL DEFAULT 'fitment_gallery',
  source_url         TEXT UNIQUE,         -- cheie de dedup la re-import
  -- jante (parsate din "R19, J9.5, ET35")
  front_diameter     NUMERIC(4,1),
  front_width        NUMERIC(4,1),
  front_offset       NUMERIC(5,1),
  rear_diameter      NUMERIC(4,1),
  rear_width         NUMERIC(4,1),
  rear_offset        NUMERIC(5,1),
  is_staggered       BOOLEAN NOT NULL DEFAULT false,
  -- anvelope (parsate din "245/40R19")
  front_tire_width   SMALLINT,
  front_tire_aspect  SMALLINT,
  front_tire_diameter NUMERIC(4,1),
  rear_tire_width    SMALLINT,
  rear_tire_aspect   SMALLINT,
  rear_tire_diameter NUMERIC(4,1),
  front_tire_raw     TEXT,                -- "Lexani LX-Twenty 245/40R19 …"
  rear_tire_raw      TEXT,
  -- note calitative din galerie
  rubbing            TEXT,                -- "No rubbing or scrubbing"
  trimming           TEXT,                -- "No Modification"
  spacers_front      TEXT,                -- "5mm" / "None"
  spacers_rear       TEXT,
  stance             TEXT,                -- "Flush" / "Tucked" / "Poke"…
  raw                JSONB,               -- rândul original complet
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fitments_vehicle ON vehicle_fitments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fitments_specs
  ON vehicle_fitments(front_diameter, front_width, front_offset);

-- ── variant_vehicle_compatibility ───────────────────────────────────────────
-- Compatibilitate explicită (variantă × vehicul × poziție).

CREATE TABLE IF NOT EXISTS variant_vehicle_compatibility (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id UUID   NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  position   fitment_position_enum NOT NULL DEFAULT 'both',
  source     fitment_source_enum   NOT NULL DEFAULT 'rule',
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, vehicle_id, position)
);

CREATE INDEX IF NOT EXISTS idx_vvc_vehicle ON variant_vehicle_compatibility(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vvc_variant ON variant_vehicle_compatibility(variant_id);

-- ── fitment_rules ───────────────────────────────────────────────────────────
-- Reguli declarative de potrivire per categorie, evaluate de motorul de
-- fitment (Faza 5). Ex. jante: bolt_pattern ∈ vehicle.specs.bolt_pattern
-- AND center_bore >= vehicle.specs.center_bore_mm AND diametru în fereastră.

CREATE TABLE IF NOT EXISTS fitment_rules (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── fitment_warnings ────────────────────────────────────────────────────────
-- Avertismente atașate unei compatibilități sau unei combinații generice.

CREATE TABLE IF NOT EXISTS fitment_warnings (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compatibility_id BIGINT REFERENCES variant_vehicle_compatibility(id) ON DELETE CASCADE,
  vehicle_id       BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
  category_id      BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  severity         TEXT NOT NULL DEFAULT 'info'
                   CHECK (severity IN ('info', 'caution', 'warning')),
  message          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (compatibility_id IS NOT NULL OR vehicle_id IS NOT NULL OR category_id IS NOT NULL)
);

-- ── RLS: citire publică (date de navigare), scriere doar service_role ───────

ALTER TABLE vehicle_makes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_generations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_fitments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_vehicle_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_rules                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_warnings              ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicle_makes', 'vehicle_models', 'vehicle_generations', 'vehicles',
    'vehicle_fitments', 'variant_vehicle_compatibility', 'fitment_warnings'
  ] LOOP
    BEGIN
      EXECUTE format('CREATE POLICY %I_public_read ON %I FOR SELECT USING (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$ BEGIN
  CREATE POLICY fitment_rules_admin_read ON fitment_rules FOR SELECT
    USING (get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
