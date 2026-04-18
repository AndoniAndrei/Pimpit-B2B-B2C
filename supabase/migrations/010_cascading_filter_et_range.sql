-- ============================================================
-- Migration 010: cascading filter RPC — ET range support
-- ============================================================
-- Context:
--   Migration 009 added products.et_min / et_max so wheels with a
--   continuous list of valid ET values ("20,21,…,50") or an interval
--   ("20-50") keep the full range instead of being collapsed to a
--   single (and wrong) number.
--
--   This migration teaches get_cascading_filter_options to:
--     • accept p_ets numeric[] (selected ET values to filter by)
--     • return an `ets` facet: every integer ET value that is valid on
--       at least one product reachable by the current filters. For a
--       product with range [et_min, et_max] we enumerate
--       generate_series(floor(et_min)::int, ceil(et_max)::int, 1) —
--       suppliers always publish integer ETs in the wild, so this
--       matches the data we will see.
--     • apply ET filtering via range intersection everywhere else:
--       a row matches if ANY selected ET falls inside [et_min, et_max].
--
--   The accesorii RPC is untouched — accessories don't have offsets.
-- ============================================================

CREATE OR REPLACE FUNCTION get_cascading_filter_options(
  p_search      text      DEFAULT NULL,
  p_brands      text[]    DEFAULT NULL,
  p_models      text[]    DEFAULT NULL,
  p_diameters   numeric[] DEFAULT NULL,
  p_widths      numeric[] DEFAULT NULL,
  p_pcds        text[]    DEFAULT NULL,
  p_ets         numeric[] DEFAULT NULL,
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
    SELECT brand, model, diameter, width, pcd, et_min, et_max, color, finish, price
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
  -- NOTE: ET predicate expressed the same way in each "for_X" CTE:
  --   p_ets IS NULL
  --   OR (et_min IS NOT NULL AND et_max IS NOT NULL
  --       AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max))
  for_brands AS (
    SELECT DISTINCT brand FROM base
    WHERE brand IS NOT NULL
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
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
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
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
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
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
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- for_pcds intentionally does NOT filter by p_pcds (self-exclude cascading).
  for_pcds AS (
    SELECT DISTINCT individual_pcd
    FROM base
    CROSS JOIN LATERAL unnest(string_to_array(pcd, '/')) AS t(individual_pcd)
    WHERE pcd IS NOT NULL
      AND individual_pcd != ''
      AND individual_pcd ~ '^\d'
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- for_ets: every integer ET in any reachable range. Self-excludes p_ets.
  for_ets AS (
    SELECT DISTINCT et_value
    FROM base
    CROSS JOIN LATERAL generate_series(floor(et_min)::int, ceil(et_max)::int, 1) AS t(et_value)
    WHERE et_min IS NOT NULL
      AND et_max IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_models    IS NULL OR model    = ANY(p_models))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR string_to_array(pcd, '/') && p_pcds)
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
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
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
      AND (p_ets       IS NULL OR (et_min IS NOT NULL AND et_max IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p_ets) e WHERE e BETWEEN et_min AND et_max)))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
  )
  SELECT jsonb_build_object(
    'brands',    COALESCE((SELECT jsonb_agg(brand          ORDER BY brand)          FROM for_brands),    '[]'),
    'models',    COALESCE((SELECT jsonb_agg(model          ORDER BY model)          FROM for_models),    '[]'),
    'diameters', COALESCE((SELECT jsonb_agg(diameter       ORDER BY diameter)       FROM for_diameters), '[]'),
    'widths',    COALESCE((SELECT jsonb_agg(width          ORDER BY width)          FROM for_widths),    '[]'),
    'pcds',      COALESCE((SELECT jsonb_agg(individual_pcd ORDER BY individual_pcd) FROM for_pcds),      '[]'),
    'ets',       COALESCE((SELECT jsonb_agg(et_value       ORDER BY et_value)       FROM for_ets),       '[]'),
    'colors',    COALESCE((SELECT jsonb_agg(color          ORDER BY color)          FROM for_colors),    '[]'),
    'finishes',  COALESCE((SELECT jsonb_agg(finish         ORDER BY finish)         FROM for_finishes),  '[]'),
    'price_min', COALESCE((SELECT MIN(price) FROM products WHERE is_active = true AND product_type = 'jante'), 0),
    'price_max', COALESCE((SELECT MAX(price) FROM products WHERE is_active = true AND product_type = 'jante'), 0)
  )
$$;

GRANT EXECUTE ON FUNCTION get_cascading_filter_options TO anon, authenticated;
