-- ============================================================================
-- 013 — CATEGORY ATTRIBUTE SYSTEM
-- category_attribute_definitions / product_variant_attributes /
-- category_filter_definitions + seed-uri per categorie
-- Vezi docs/CATALOG_V2_PLAN.md §3.2
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE attribute_data_type_enum AS ENUM
    ('text', 'number', 'integer', 'boolean', 'enum', 'multi_enum', 'range');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE filter_widget_enum AS ENUM
    ('checkbox_list', 'range_slider', 'toggle', 'search_select');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── category_attribute_definitions ──────────────────────────────────────────
-- Definițiile de atribute per categorie. Categoriile copil moștenesc
-- definițiile părintelui (rezolvat în cod, nu în DB).

CREATE TABLE IF NOT EXISTS category_attribute_definitions (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id         BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,      -- cheie stabilă, ex. 'diameter_inch'
  label               TEXT NOT NULL,      -- afișare RO, ex. 'Diametru'
  data_type           attribute_data_type_enum NOT NULL,
  unit                TEXT,               -- 'inch' | 'mm' | 'kg' | NULL
  enum_options        JSONB,              -- pentru enum/multi_enum: ["Iarnă","Vară",…]
  is_required         BOOLEAN NOT NULL DEFAULT false,
  -- true = atributul diferențiază variantele aceleiași familii (ex. diametru);
  -- false = atribut la nivel de familie (ex. metodă de producție)
  is_variant_defining BOOLEAN NOT NULL DEFAULT true,
  validation          JSONB,              -- {"min":10,"max":26,"regex":"…"}
  position            INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, code)
);

-- ── product_variant_attributes (EAV tipizat) ────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variant_attributes (
  variant_id        UUID   NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id      BIGINT NOT NULL REFERENCES category_attribute_definitions(id) ON DELETE CASCADE,
  value_text        TEXT,
  value_numeric     NUMERIC(14,4),
  value_numeric_max NUMERIC(14,4),        -- pentru range (ex. ET 20–50): min în value_numeric
  value_boolean     BOOLEAN,
  value_json        JSONB,                -- pentru multi_enum: ["5x112","5x120"]
  PRIMARY KEY (variant_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_pva_attribute_numeric
  ON product_variant_attributes(attribute_id, value_numeric);
CREATE INDEX IF NOT EXISTS idx_pva_attribute_text
  ON product_variant_attributes(attribute_id, value_text);

-- ── Sync EAV → product_variants.attrs (JSONB denormalizat) ──────────────────

CREATE OR REPLACE FUNCTION sync_variant_attrs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID := COALESCE(NEW.variant_id, OLD.variant_id);
BEGIN
  UPDATE product_variants pv
  SET attrs = COALESCE((
    SELECT jsonb_object_agg(
      d.code,
      CASE d.data_type
        WHEN 'boolean'    THEN to_jsonb(a.value_boolean)
        WHEN 'multi_enum' THEN COALESCE(a.value_json, to_jsonb(a.value_text))
        WHEN 'range'      THEN jsonb_build_object('min', a.value_numeric, 'max', a.value_numeric_max)
        WHEN 'number'     THEN to_jsonb(a.value_numeric)
        WHEN 'integer'    THEN to_jsonb(a.value_numeric)
        ELSE COALESCE(to_jsonb(a.value_text), to_jsonb(a.value_numeric))
      END
    )
    FROM product_variant_attributes a
    JOIN category_attribute_definitions d ON d.id = a.attribute_id
    WHERE a.variant_id = v_id
  ), '{}'::jsonb)
  WHERE pv.id = v_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pva_sync ON product_variant_attributes;
CREATE TRIGGER trg_pva_sync
  AFTER INSERT OR UPDATE OR DELETE ON product_variant_attributes
  FOR EACH ROW EXECUTE FUNCTION sync_variant_attrs();

-- ── category_filter_definitions ─────────────────────────────────────────────
-- Ce atribute devin fațete în storefront + cum se afișează.

CREATE TABLE IF NOT EXISTS category_filter_definitions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  attribute_id BIGINT NOT NULL REFERENCES category_attribute_definitions(id) ON DELETE CASCADE,
  widget       filter_widget_enum NOT NULL DEFAULT 'checkbox_list',
  position     INT NOT NULL DEFAULT 0,
  show_counts  BOOLEAN NOT NULL DEFAULT true,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (category_id, attribute_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE category_attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_attributes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_filter_definitions    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cad_public_read ON category_attribute_definitions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY pva_public_read ON product_variant_attributes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cfd_public_read ON category_filter_definitions FOR SELECT USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── SEED: definiții de atribute per categorie ───────────────────────────────
-- Helper temporar pentru seed compact.

CREATE OR REPLACE FUNCTION _seed_attr(
  p_cat_slug TEXT, p_code TEXT, p_label TEXT, p_type attribute_data_type_enum,
  p_unit TEXT DEFAULT NULL, p_enum JSONB DEFAULT NULL,
  p_required BOOLEAN DEFAULT false, p_variant BOOLEAN DEFAULT true,
  p_validation JSONB DEFAULT NULL, p_position INT DEFAULT 0
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO category_attribute_definitions
    (category_id, code, label, data_type, unit, enum_options,
     is_required, is_variant_defining, validation, position)
  SELECT c.id, p_code, p_label, p_type, p_unit, p_enum,
         p_required, p_variant, p_validation, p_position
  FROM categories c WHERE c.slug = p_cat_slug
  ON CONFLICT (category_id, code) DO NOTHING;
END;
$$;

-- Jante
SELECT _seed_attr('jante', 'diameter_inch',  'Diametru',        'number',  'inch', NULL, true,  true,  '{"min":10,"max":26}', 10);
SELECT _seed_attr('jante', 'width_inch',     'Lățime',          'number',  'inch', NULL, true,  true,  '{"min":3,"max":16}',  20);
SELECT _seed_attr('jante', 'bolt_pattern',   'Prindere (PCD)',  'multi_enum', NULL, NULL, true, true,  NULL,                  30);
SELECT _seed_attr('jante', 'et_offset',      'ET (offset)',     'range',   'mm',   NULL, false, true,  '{"min":-90,"max":150}', 40);
SELECT _seed_attr('jante', 'center_bore_mm', 'Alezaj central',  'number',  'mm',   NULL, false, true,  '{"min":40,"max":130}', 50);
SELECT _seed_attr('jante', 'color',          'Culoare',         'text',    NULL,   NULL, false, true,  NULL, 60);
SELECT _seed_attr('jante', 'finish',         'Finisaj',         'text',    NULL,   NULL, false, true,  NULL, 70);
SELECT _seed_attr('jante', 'construction',   'Construcție',     'enum',    NULL,   '["Turnată","Flow formed","Forjată","Multi-piece"]', false, false, NULL, 80);
SELECT _seed_attr('jante', 'max_load_kg',    'Sarcină maximă',  'number',  'kg',   NULL, false, true,  NULL, 90);
SELECT _seed_attr('jante', 'wheel_weight_kg','Greutate',        'number',  'kg',   NULL, false, true,  NULL, 100);

-- Anvelope
SELECT _seed_attr('anvelope', 'tire_width_mm',   'Lățime',          'integer', 'mm',   NULL, true,  true, '{"min":125,"max":405}', 10);
SELECT _seed_attr('anvelope', 'aspect_ratio',    'Profil',          'integer', '%',    NULL, true,  true, '{"min":20,"max":85}',   20);
SELECT _seed_attr('anvelope', 'rim_diameter_inch','Diametru jantă', 'number',  'inch', NULL, true,  true, '{"min":10,"max":26}',   30);
SELECT _seed_attr('anvelope', 'load_index',      'Indice sarcină',  'integer', NULL,   NULL, false, true, '{"min":50,"max":130}',  40);
SELECT _seed_attr('anvelope', 'speed_rating',    'Indice viteză',   'enum',    NULL,   '["Q","R","S","T","H","V","W","Y","(Y)","ZR"]', false, true, NULL, 50);
SELECT _seed_attr('anvelope', 'season',          'Sezon',           'enum',    NULL,   '["Vară","Iarnă","All-season"]', true, true, NULL, 60);
SELECT _seed_attr('anvelope', 'run_flat',        'Run-flat',        'boolean', NULL,   NULL, false, true, NULL, 70);
SELECT _seed_attr('anvelope', 'extra_load',      'Extra Load (XL)', 'boolean', NULL,   NULL, false, true, NULL, 80);

-- Suspensii (pe categoria părinte; copiii moștenesc în cod)
SELECT _seed_attr('suspensii', 'suspension_type', 'Tip',            'enum', NULL, '["Arcuri sport","Coilover","Suspensie aer","Amortizoare"]', true, false, NULL, 10);
SELECT _seed_attr('suspensii', 'drop_front_mm',   'Coborâre față',  'range', 'mm', NULL, false, true, NULL, 20);
SELECT _seed_attr('suspensii', 'drop_rear_mm',    'Coborâre spate', 'range', 'mm', NULL, false, true, NULL, 30);
SELECT _seed_attr('suspensii', 'adjustable_damping', 'Amortizare reglabilă', 'boolean', NULL, NULL, false, true, NULL, 40);

-- Iluminat (părinte; faruri/stopuri moștenesc)
SELECT _seed_attr('iluminat', 'light_side',      'Parte',       'enum', NULL, '["Stânga","Dreapta","Set"]', false, true, NULL, 10);
SELECT _seed_attr('iluminat', 'light_technology','Tehnologie',  'enum', NULL, '["Halogen","Xenon","LED","Full LED","Laser"]', false, true, NULL, 20);
SELECT _seed_attr('iluminat', 'homologation',    'Omologare',   'enum', NULL, '["ECE","DOT","Fără omologare stradală"]', false, false, NULL, 30);

-- Frâne (părinte)
SELECT _seed_attr('frane', 'brake_position',   'Poziție',           'enum',    NULL, '["Față","Spate","Față + Spate"]', false, true, NULL, 10);
SELECT _seed_attr('frane', 'disc_diameter_mm', 'Diametru disc',     'number',  'mm', NULL, false, true, NULL, 20);
SELECT _seed_attr('frane', 'piston_count',     'Număr pistoane',    'integer', NULL, NULL, false, true, NULL, 30);
SELECT _seed_attr('frane', 'disc_material',    'Material disc',     'enum',    NULL, '["Oțel","Carbon-ceramic","Bimetal"]', false, false, NULL, 40);

-- TPMS
SELECT _seed_attr('tpms', 'frequency_mhz', 'Frecvență',  'enum', 'MHz', '["315","433"]', false, true, NULL, 10);
SELECT _seed_attr('tpms', 'valve_type',    'Tip valvă',  'enum', NULL,  '["Cauciuc","Aluminiu"]', false, true, NULL, 20);

-- Distanțiere & adaptoare
SELECT _seed_attr('distantiere', 'thickness_mm',   'Grosime',          'number', 'mm', NULL, true,  true, '{"min":3,"max":50}', 10);
SELECT _seed_attr('distantiere', 'bolt_pattern',   'Prindere (PCD)',   'multi_enum', NULL, NULL, false, true, NULL, 20);
SELECT _seed_attr('distantiere', 'center_bore_mm', 'Alezaj central',   'number', 'mm', NULL, false, true, NULL, 30);
SELECT _seed_attr('distantiere', 'is_adapter',     'Adaptor (schimbă PCD)', 'boolean', NULL, NULL, false, true, NULL, 40);

-- Prezoane & piulițe
SELECT _seed_attr('prezoane-piulite', 'thread',      'Filet',       'enum', NULL, '["M12x1.25","M12x1.5","M12x1.75","M14x1.25","M14x1.5","M14x2.0"]', true, true, NULL, 10);
SELECT _seed_attr('prezoane-piulite', 'seat_type',   'Tip scaun',   'enum', NULL, '["Conic 60°","Sferic (R13/R14)","Plat"]', false, true, NULL, 20);
SELECT _seed_attr('prezoane-piulite', 'length_mm',   'Lungime',     'number', 'mm', NULL, false, true, NULL, 30);
SELECT _seed_attr('prezoane-piulite', 'head_size_mm','Cheie',       'integer', 'mm', NULL, false, true, NULL, 40);

-- Body kit & aero
SELECT _seed_attr('body-kit', 'material',    'Material', 'enum', NULL, '["ABS","Fibră de sticlă","Fibră de carbon","Poliuretan"]', false, true, NULL, 10);
SELECT _seed_attr('body-kit', 'kit_scope',   'Conținut', 'enum', NULL, '["Kit complet","Bară față","Bară spate","Praguri","Eleron","Difuzor"]', false, true, NULL, 20);

-- Pachete jante + anvelope (compozit — componentele au atributele lor)
SELECT _seed_attr('pachete-jante-anvelope', 'package_diameter_inch', 'Diametru pachet', 'number', 'inch', NULL, false, true, NULL, 10);
SELECT _seed_attr('pachete-jante-anvelope', 'mounted_balanced', 'Montat & echilibrat', 'boolean', NULL, NULL, false, false, NULL, 20);

-- ── SEED: fațete implicite (category_filter_definitions) ────────────────────

CREATE OR REPLACE FUNCTION _seed_filter(
  p_cat_slug TEXT, p_code TEXT, p_widget filter_widget_enum, p_position INT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO category_filter_definitions (category_id, attribute_id, widget, position)
  SELECT c.id, d.id, p_widget, p_position
  FROM categories c
  JOIN category_attribute_definitions d ON d.category_id = c.id AND d.code = p_code
  WHERE c.slug = p_cat_slug
  ON CONFLICT (category_id, attribute_id) DO NOTHING;
END;
$$;

SELECT _seed_filter('jante', 'diameter_inch',  'checkbox_list', 10);
SELECT _seed_filter('jante', 'width_inch',     'checkbox_list', 20);
SELECT _seed_filter('jante', 'bolt_pattern',   'search_select', 30);
SELECT _seed_filter('jante', 'et_offset',      'range_slider',  40);
SELECT _seed_filter('jante', 'color',          'checkbox_list', 50);
SELECT _seed_filter('jante', 'finish',         'checkbox_list', 60);

SELECT _seed_filter('anvelope', 'tire_width_mm',     'checkbox_list', 10);
SELECT _seed_filter('anvelope', 'aspect_ratio',      'checkbox_list', 20);
SELECT _seed_filter('anvelope', 'rim_diameter_inch', 'checkbox_list', 30);
SELECT _seed_filter('anvelope', 'season',            'checkbox_list', 40);
SELECT _seed_filter('anvelope', 'speed_rating',      'checkbox_list', 50);
SELECT _seed_filter('anvelope', 'run_flat',          'toggle',        60);

SELECT _seed_filter('suspensii', 'suspension_type',   'checkbox_list', 10);
SELECT _seed_filter('iluminat',  'light_side',        'checkbox_list', 10);
SELECT _seed_filter('iluminat',  'light_technology',  'checkbox_list', 20);
SELECT _seed_filter('frane',     'brake_position',    'checkbox_list', 10);
SELECT _seed_filter('frane',     'disc_diameter_mm',  'range_slider',  20);
SELECT _seed_filter('tpms',      'frequency_mhz',     'checkbox_list', 10);
SELECT _seed_filter('distantiere', 'thickness_mm',    'checkbox_list', 10);
SELECT _seed_filter('distantiere', 'bolt_pattern',    'search_select', 20);
SELECT _seed_filter('prezoane-piulite', 'thread',     'checkbox_list', 10);
SELECT _seed_filter('prezoane-piulite', 'seat_type',  'checkbox_list', 20);
SELECT _seed_filter('body-kit',  'material',          'checkbox_list', 10);

DROP FUNCTION _seed_attr(TEXT, TEXT, TEXT, attribute_data_type_enum, TEXT, JSONB, BOOLEAN, BOOLEAN, JSONB, INT);
DROP FUNCTION _seed_filter(TEXT, TEXT, filter_widget_enum, INT);
