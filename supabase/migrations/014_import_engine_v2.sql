-- ============================================================================
-- 014 — IMPORT ENGINE V2
-- Stratul raw: supplier_feeds / import_jobs / import_raw_rows / import_errors
-- Stratul de mapare: supplier_mapping_profiles / supplier_field_mappings /
--                    supplier_transform_rules / currency_rates
-- Staging: import_staged_variants
-- Vezi docs/CATALOG_V2_PLAN.md §3.4–3.5
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE import_job_status_enum AS ENUM
    ('queued', 'fetching', 'parsing', 'mapping', 'validating', 'staged',
     'publishing', 'published', 'failed', 'rolled_back', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_job_mode_enum AS ENUM ('dry_run', 'staged', 'direct');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_row_status_enum AS ENUM ('pending', 'mapped', 'error', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_error_severity_enum AS ENUM ('warning', 'error', 'fatal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_phase_enum AS ENUM ('fetch', 'parse', 'map', 'validate', 'stage', 'publish');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staged_action_enum AS ENUM ('create', 'update', 'unchanged', 'deactivate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mapping_target_kind_enum AS ENUM ('core', 'attribute', 'offer', 'media', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transform_rule_type_enum AS ENUM
    ('value_remap', 'brand_normalize', 'unit_convert', 'currency_convert',
     'formula', 'row_filter', 'regex_extract', 'template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── currency_rates ──────────────────────────────────────────────────────────
-- Normalizarea valutară iese din pricing_rules.base_multiplier.

CREATE TABLE IF NOT EXISTS currency_rates (
  code        TEXT PRIMARY KEY,           -- ISO 4217
  rate_to_ron NUMERIC(12,6) NOT NULL CHECK (rate_to_ron > 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO currency_rates (code, rate_to_ron) VALUES
  ('RON', 1.0), ('EUR', 5.08), ('USD', 4.30), ('SEK', 0.46),
  ('PLN', 1.19), ('GBP', 5.85), ('CHF', 5.40)
ON CONFLICT (code) DO NOTHING;

-- ── supplier_feeds ──────────────────────────────────────────────────────────
-- Mai multe feed-uri per furnizor (înlocuiește hack-ul secondary_feed_url).

CREATE TABLE IF NOT EXISTS supplier_feeds (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id   SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  feed_url      TEXT,                     -- NULL = doar upload manual
  format        feed_format_enum NOT NULL DEFAULT 'csv',
  auth_method   auth_method_enum NOT NULL DEFAULT 'none',
  csv_delimiter TEXT DEFAULT ',',
  -- config specific feed-ului: join keys, headere HTTP, paginare API, sheet name
  config        JSONB NOT NULL DEFAULT '{}',
  schedule_cron TEXT,                     -- NULL = doar manual
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_feeds_supplier ON supplier_feeds(supplier_id);

DROP TRIGGER IF EXISTS trg_supplier_feeds_updated ON supplier_feeds;
CREATE TRIGGER trg_supplier_feeds_updated BEFORE UPDATE ON supplier_feeds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── supplier_mapping_profiles ───────────────────────────────────────────────
-- Profil versionat de mapare per (furnizor × categorie țintă).

CREATE TABLE IF NOT EXISTS supplier_mapping_profiles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  feed_id     BIGINT REFERENCES supplier_feeds(id) ON DELETE SET NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, name, version)
);

CREATE INDEX IF NOT EXISTS idx_mapping_profiles_supplier ON supplier_mapping_profiles(supplier_id) WHERE is_active;

DROP TRIGGER IF EXISTS trg_mapping_profiles_updated ON supplier_mapping_profiles;
CREATE TRIGGER trg_mapping_profiles_updated BEFORE UPDATE ON supplier_mapping_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── supplier_field_mappings ─────────────────────────────────────────────────
-- O regulă per câmp țintă: coloană sursă / template + lanț de transformări.

CREATE TABLE IF NOT EXISTS supplier_field_mappings (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id        BIGINT NOT NULL REFERENCES supplier_mapping_profiles(id) ON DELETE CASCADE,
  target_kind       mapping_target_kind_enum NOT NULL,
  -- core: 'part_number'|'brand'|'name'|'family_name'|'ean'|'description'
  -- attribute: codul din category_attribute_definitions (ex. 'diameter_inch')
  -- offer: 'raw_price'|'currency'|'stock'|'stock_incoming'|'supplier_sku'|'lead_time_days'
  -- media: 'image_url'|'image_zip_url'|'image_zip_id'|'image_api_id'|'youtube'|'model_3d'
  target_code       TEXT NOT NULL,
  -- numele coloanei sau template "{col1} {col2}"
  source_expression TEXT NOT NULL,
  -- lanț ordonat de transformări la nivel de valoare:
  -- [{"type":"trim"},{"type":"number_locale","locale":"eu"},
  --  {"type":"unit_convert","from":"mm","to":"inch"},{"type":"regex_extract","pattern":"…"}]
  transform         JSONB NOT NULL DEFAULT '[]',
  required          BOOLEAN NOT NULL DEFAULT false,
  default_value     TEXT,
  position          INT NOT NULL DEFAULT 0,
  UNIQUE (profile_id, target_kind, target_code)
);

CREATE INDEX IF NOT EXISTS idx_field_mappings_profile ON supplier_field_mappings(profile_id);

-- ── supplier_transform_rules ────────────────────────────────────────────────
-- Reguli la nivel de rând/profil (nu per câmp): filtre, remap de brand,
-- formule de preț, conversii valutare implicite.

CREATE TABLE IF NOT EXISTS supplier_transform_rules (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES supplier_mapping_profiles(id) ON DELETE CASCADE,
  rule_type  transform_rule_type_enum NOT NULL,
  -- exemple:
  --  row_filter:       {"column":"Brand","op":"in","values":["Japan Racing"]}
  --  brand_normalize:  {"use_brand_aliases":true,"extra":{"stw":"STW"}}
  --  currency_convert: {"currency":"EUR"}  (aplică currency_rates la raw_price)
  --  formula:          {"target":"offer:price","expression":"{NetPrice} * 1.19"}
  config     JSONB NOT NULL DEFAULT '{}',
  position   INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_transform_rules_profile ON supplier_transform_rules(profile_id, position);

-- ── import_jobs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    SMALLINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  feed_id        BIGINT REFERENCES supplier_feeds(id) ON DELETE SET NULL,
  profile_id     BIGINT REFERENCES supplier_mapping_profiles(id) ON DELETE SET NULL,
  triggered_by   TEXT NOT NULL DEFAULT 'manual',  -- 'manual'|'schedule'|'api'
  mode           import_job_mode_enum NOT NULL DEFAULT 'staged',
  status         import_job_status_enum NOT NULL DEFAULT 'queued',
  -- snapshot-ul feed-ului brut în Storage (bucket feed-snapshots)
  snapshot_path  TEXT,
  snapshot_hash  TEXT,                    -- sha256 — detectează feed neschimbat
  rows_total     INT NOT NULL DEFAULT 0,
  rows_parsed    INT NOT NULL DEFAULT 0,
  rows_mapped    INT NOT NULL DEFAULT 0,
  rows_error     INT NOT NULL DEFAULT 0,
  rows_staged    INT NOT NULL DEFAULT 0,
  rows_published INT NOT NULL DEFAULT 0,
  stats          JSONB NOT NULL DEFAULT '{}',  -- heartbeat, faze, distribuții preț
  error_message  TEXT,
  created_by     UUID,                    -- auth.users.id
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_supplier ON import_jobs(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_queued   ON import_jobs(created_at) WHERE status = 'queued';

ALTER TABLE supplier_offers
  DROP CONSTRAINT IF EXISTS fk_offers_import_job,
  ADD CONSTRAINT fk_offers_import_job
    FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL;

-- ── import_raw_rows ─────────────────────────────────────────────────────────
-- Rândurile brute ale unui job. Purjabile după N zile (snapshot-ul rămâne).

CREATE TABLE IF NOT EXISTS import_raw_rows (
  job_id     UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_index  INT  NOT NULL,
  raw        JSONB NOT NULL,
  row_hash   TEXT NOT NULL,               -- sha256(raw) — diff ieftin între rulări
  status     import_row_status_enum NOT NULL DEFAULT 'pending',
  PRIMARY KEY (job_id, row_index)
);

-- ── import_errors ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_errors (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id    UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_index INT,                          -- NULL = eroare la nivel de job/fază
  phase     import_phase_enum NOT NULL,
  severity  import_error_severity_enum NOT NULL DEFAULT 'error',
  code      TEXT NOT NULL,                -- ex. 'MISSING_REQUIRED', 'BAD_NUMBER', 'UNKNOWN_BRAND'
  message   TEXT NOT NULL,
  details   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_errors_job ON import_errors(job_id, severity);

-- ── import_staged_variants ──────────────────────────────────────────────────
-- Diff-ul calculat, gata de review + publish. `previous` permite rollback.

CREATE TABLE IF NOT EXISTS import_staged_variants (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id             UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_index          INT,
  action             staged_action_enum NOT NULL,
  matched_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  -- payload-uri canonice rezolvate (post-mapare, post-validare)
  product_payload    JSONB NOT NULL DEFAULT '{}',   -- familie: brand, name, category, slug
  variant_payload    JSONB NOT NULL DEFAULT '{}',   -- part_number, ean, name_suffix
  attributes_payload JSONB NOT NULL DEFAULT '{}',   -- { code: value } tipizat
  offer_payload      JSONB NOT NULL DEFAULT '{}',   -- raw_price, currency, price, stock…
  media_payload      JSONB NOT NULL DEFAULT '[]',
  -- starea anterioară a ofertei/variantei (pentru rollback)
  previous           JSONB,
  validation_status  import_row_status_enum NOT NULL DEFAULT 'pending',
  validation_messages JSONB NOT NULL DEFAULT '[]',
  published_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staged_job ON import_staged_variants(job_id, action);

-- ── Worker: claim atomic al următorului job ─────────────────────────────────

CREATE OR REPLACE FUNCTION claim_next_import_job()
RETURNS import_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  job import_jobs;
BEGIN
  SELECT * INTO job
  FROM import_jobs
  WHERE status = 'queued'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF job.id IS NOT NULL THEN
    UPDATE import_jobs
    SET status = 'fetching', started_at = now()
    WHERE id = job.id;
    job.status := 'fetching';
  END IF;

  RETURN job;
END;
$$;

-- ── Retenție: purjare rânduri brute vechi ───────────────────────────────────

CREATE OR REPLACE FUNCTION purge_old_import_rows(keep_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  DELETE FROM import_raw_rows r
  USING import_jobs j
  WHERE j.id = r.job_id
    AND j.finished_at IS NOT NULL
    AND j.finished_at < now() - make_interval(days => keep_days);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ── Storage bucket pentru snapshot-uri feed ─────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('feed-snapshots', 'feed-snapshots', false, 209715200)  -- 200MB
ON CONFLICT (id) DO NOTHING;

-- ── RLS (doar admin/service_role — date de furnizor sensibile) ──────────────

ALTER TABLE currency_rates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_feeds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_mapping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_field_mappings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transform_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_raw_rows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staged_variants    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY currency_rates_public_read ON currency_rates FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'supplier_feeds', 'supplier_mapping_profiles', 'supplier_field_mappings',
    'supplier_transform_rules', 'import_jobs', 'import_raw_rows',
    'import_errors', 'import_staged_variants'
  ] LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I_admin_read ON %I FOR SELECT USING (get_my_role() = ''admin'')',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
