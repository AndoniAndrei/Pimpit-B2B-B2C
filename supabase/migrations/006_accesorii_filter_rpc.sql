-- ============================================================
-- Migration 006: Filter options RPC for accesorii page
-- Mirrors get_cascading_filter_options but for non-jante products.
-- No PCD / diameter / width dimensions (not relevant for accessories).
-- ============================================================

CREATE OR REPLACE FUNCTION get_cascading_filter_options_accesorii(
  p_search      text    DEFAULT NULL,
  p_brands      text[]  DEFAULT NULL,
  p_models      text[]  DEFAULT NULL,
  p_colors      text[]  DEFAULT NULL,
  p_finishes    text[]  DEFAULT NULL,
  p_price_min   numeric DEFAULT NULL,
  p_price_max   numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  base AS (
    SELECT brand, model, color, finish, price
    FROM products
    WHERE is_active = true
      AND product_type != 'jante'
      AND (p_search IS NULL OR (
            name          ILIKE '%' || p_search || '%'
            OR brand      ILIKE '%' || p_search || '%'
            OR part_number ILIKE '%' || p_search || '%'
          ))
      AND (p_price_min IS NULL OR price >= p_price_min)
      AND (p_price_max IS NULL OR price <= p_price_max)
  ),
  for_brands AS (
    SELECT DISTINCT brand FROM base
    WHERE brand IS NOT NULL
      AND (p_models   IS NULL OR model  = ANY(p_models))
      AND (p_colors   IS NULL OR color  = ANY(p_colors))
      AND (p_finishes IS NULL OR finish = ANY(p_finishes))
  ),
  for_models AS (
    SELECT DISTINCT model FROM base
    WHERE model IS NOT NULL
      AND (p_brands   IS NULL OR brand  = ANY(p_brands))
      AND (p_colors   IS NULL OR color  = ANY(p_colors))
      AND (p_finishes IS NULL OR finish = ANY(p_finishes))
  ),
  for_colors AS (
    SELECT DISTINCT color FROM base
    WHERE color IS NOT NULL
      AND (p_brands   IS NULL OR brand  = ANY(p_brands))
      AND (p_models   IS NULL OR model  = ANY(p_models))
      AND (p_finishes IS NULL OR finish = ANY(p_finishes))
  ),
  for_finishes AS (
    SELECT DISTINCT finish FROM base
    WHERE finish IS NOT NULL
      AND (p_brands IS NULL OR brand = ANY(p_brands))
      AND (p_models IS NULL OR model = ANY(p_models))
      AND (p_colors IS NULL OR color = ANY(p_colors))
  )
  SELECT jsonb_build_object(
    'brands',    COALESCE((SELECT jsonb_agg(brand  ORDER BY brand)  FROM for_brands),   '[]'),
    'models',    COALESCE((SELECT jsonb_agg(model  ORDER BY model)  FROM for_models),   '[]'),
    'colors',    COALESCE((SELECT jsonb_agg(color  ORDER BY color)  FROM for_colors),   '[]'),
    'finishes',  COALESCE((SELECT jsonb_agg(finish ORDER BY finish) FROM for_finishes), '[]'),
    'price_min', COALESCE((SELECT MIN(price) FROM products WHERE is_active = true AND product_type != 'jante'), 0),
    'price_max', COALESCE((SELECT MAX(price) FROM products WHERE is_active = true AND product_type != 'jante'), 0)
  )
$$;

GRANT EXECUTE ON FUNCTION get_cascading_filter_options_accesorii TO anon, authenticated;
