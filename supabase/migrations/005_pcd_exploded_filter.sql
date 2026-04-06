-- ============================================================
-- Migration 005: PCD exploded filter support
-- ============================================================
-- Goals:
--   1. Normalize all existing PCD values in the database to
--      canonical form: uppercase, decimal dot, slash-separated
--      (e.g. "3x112, 4x100, 5x114,3" → "3X112/4X100/5X114.3")
--
--   2. Update get_cascading_filter_options so that:
--      a) The PCDs returned in the filter are INDIVIDUAL values
--         (each bolt count/diameter combo, not the full multi-bolt string)
--      b) PCD filtering in all CTEs uses array-overlap logic so that
--         selecting "5X112" returns both single-bolt AND multi-bolt products
--         that include 5X112 among their bolt patterns.
-- ============================================================


-- ── Step 1: Normalize existing PCD data ────────────────────────────────────────
--
-- Algorithm per row:
--   a) Normalize decimal commas between digits: "114,3" → "114.3"
--   b) Split by any list separator (/ ; | or comma after step a)
--   c) Per token: trim whitespace, uppercase, collapse spaces around X
--   d) Discard tokens that don't start with a digit (guards against empty strings)
--   e) Rejoin with canonical "/" separator

UPDATE products
SET pcd = (
  SELECT string_agg(
    UPPER(REGEXP_REPLACE(TRIM(token), '\s*[xX]\s*', 'X', 'g')),
    '/'
    ORDER BY ordinality
  )
  FROM unnest(
    -- split by /  ;  |  or comma (after decimal-comma normalization)
    regexp_split_to_array(
      -- normalize decimal comma "114,3" → "114.3"  (only between two digit chars)
      regexp_replace(TRIM(pcd), '(\d),(\d)', '\1.\2', 'g'),
      '[/;|]|,\s*'
    )
  ) WITH ORDINALITY AS t(token, ordinality)
  -- keep only tokens that start with a digit (skip empties / garbage)
  WHERE TRIM(token) ~ '^\d'
)
WHERE pcd IS NOT NULL;

-- Also normalize pcd_secondary if it exists and has data
UPDATE products
SET pcd_secondary = (
  SELECT string_agg(
    UPPER(REGEXP_REPLACE(TRIM(token), '\s*[xX]\s*', 'X', 'g')),
    '/'
    ORDER BY ordinality
  )
  FROM unnest(
    regexp_split_to_array(
      regexp_replace(TRIM(pcd_secondary), '(\d),(\d)', '\1.\2', 'g'),
      '[/;|]|,\s*'
    )
  ) WITH ORDINALITY AS t(token, ordinality)
  WHERE TRIM(token) ~ '^\d'
)
WHERE pcd_secondary IS NOT NULL;


-- ── Step 2: Update get_cascading_filter_options ────────────────────────────────
--
-- Changes vs migration 004:
--   • for_pcds CTE: unnests pcd → individual values (CROSS JOIN LATERAL unnest)
--   • PCD matching in all other CTEs: uses array-overlap  (string_to_array(pcd,'/') && p_pcds)
--     instead of exact equality (pcd = ANY(p_pcds))

CREATE OR REPLACE FUNCTION get_cascading_filter_options(
  p_search      text      DEFAULT NULL,
  p_brands      text[]    DEFAULT NULL,
  p_models      text[]    DEFAULT NULL,
  p_diameters   numeric[] DEFAULT NULL,
  p_widths      numeric[] DEFAULT NULL,
  p_pcds        text[]    DEFAULT NULL,
  p_colors      text[]    DEFAULT NULL,
  p_finishes    text[]    DEFAULT NULL,
  p_price_min   numeric   DEFAULT NULL,
  p_price_max   numeric   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  base AS (
    SELECT brand, model, diameter, width, pcd, color, finish, price
    FROM products
    WHERE is_active = true
      AND product_type = 'jante'
      AND (p_search IS NULL OR (
            name          ILIKE '%' || p_search || '%'
            OR brand      ILIKE '%' || p_search || '%'
            OR part_number ILIKE '%' || p_search || '%'
          ))
      AND (p_price_min IS NULL OR price >= p_price_min)
      AND (p_price_max IS NULL OR price <= p_price_max)
  ),
  -- Helper: check if the product's pcd field contains any of the selected PCDs
  -- as individual slash-separated elements (array overlap on string_to_array).
  -- Used in each "for_X" CTE except for_pcds (self-exclude cascading logic).

  for_brands AS (
    SELECT DISTINCT brand FROM base
    WHERE brand IS NOT NULL
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  for_models AS (
    SELECT DISTINCT model FROM base
    WHERE model IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  for_diameters AS (
    SELECT DISTINCT diameter FROM base
    WHERE diameter IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  for_widths AS (
    SELECT DISTINCT width FROM base
    WHERE width IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- for_pcds intentionally does NOT filter by p_pcds (self-exclude cascading).
  -- It UNNESTS each product's pcd value so every individual bolt pattern
  -- becomes its own distinct row in the filter list.
  for_pcds AS (
    SELECT DISTINCT individual_pcd
    FROM base
    CROSS JOIN LATERAL unnest(string_to_array(pcd, '/')) AS t(individual_pcd)
    WHERE pcd IS NOT NULL
      AND individual_pcd != ''
      AND individual_pcd ~ '^\d'   -- sanity: must start with digit
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  for_colors AS (
    SELECT DISTINCT color FROM base
    WHERE color IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  for_finishes AS (
    SELECT DISTINCT finish FROM base
    WHERE finish IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
  )
  SELECT jsonb_build_object(
    'brands',    COALESCE((SELECT jsonb_agg(brand          ORDER BY brand)          FROM for_brands),    '[]'),
    'models',    COALESCE((SELECT jsonb_agg(model          ORDER BY model)          FROM for_models),    '[]'),
    'diameters', COALESCE((SELECT jsonb_agg(diameter       ORDER BY diameter)       FROM for_diameters), '[]'),
    'widths',    COALESCE((SELECT jsonb_agg(width          ORDER BY width)          FROM for_widths),    '[]'),
    'pcds',      COALESCE((SELECT jsonb_agg(individual_pcd ORDER BY individual_pcd) FROM for_pcds),      '[]'),
    'colors',    COALESCE((SELECT jsonb_agg(color          ORDER BY color)          FROM for_colors),    '[]'),
    'finishes',  COALESCE((SELECT jsonb_agg(finish         ORDER BY finish)         FROM for_finishes),  '[]'),
    'price_min', COALESCE((SELECT MIN(price) FROM products WHERE is_active = true AND product_type = 'jante'), 0),
    'price_max', COALESCE((SELECT MAX(price) FROM products WHERE is_active = true AND product_type = 'jante'), 0)
  )
$$;

GRANT EXECUTE ON FUNCTION get_cascading_filter_options TO anon, authenticated;
