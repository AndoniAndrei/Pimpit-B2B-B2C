-- Cascading filter options RPC
--
-- Returns distinct values for every filter dimension using the "exclude self"
-- pattern: each dimension's available values reflect ALL OTHER active filters.
-- Runs entirely in PostgreSQL with SELECT DISTINCT — no client-side row-limit issues.
-- Called as: supabase.rpc('get_cascading_filter_options', { p_brands: [...], ... })

CREATE OR REPLACE FUNCTION get_cascading_filter_options(
  p_search      text      DEFAULT NULL,
  p_brands      text[]    DEFAULT NULL,
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
  -- Apply search + price filters once; all dimension CTEs filter from this
  base AS (
    SELECT brand, diameter, width, pcd, color, finish, price
    FROM products
    WHERE is_active = true
      AND (p_search IS NULL OR (
            name         ILIKE '%' || p_search || '%'
            OR brand     ILIKE '%' || p_search || '%'
            OR part_number ILIKE '%' || p_search || '%'
          ))
      AND (p_price_min IS NULL OR price >= p_price_min)
      AND (p_price_max IS NULL OR price <= p_price_max)
  ),
  -- Brands: apply all filters EXCEPT brand
  for_brands AS (
    SELECT DISTINCT brand FROM base
    WHERE brand IS NOT NULL
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR pcd      = ANY(p_pcds))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- Diameters: apply all filters EXCEPT diameter
  for_diameters AS (
    SELECT DISTINCT diameter FROM base
    WHERE diameter IS NOT NULL
      AND (p_brands   IS NULL OR brand  = ANY(p_brands))
      AND (p_widths   IS NULL OR width  = ANY(p_widths))
      AND (p_pcds     IS NULL OR pcd    = ANY(p_pcds))
      AND (p_colors   IS NULL OR color  = ANY(p_colors))
      AND (p_finishes IS NULL OR finish = ANY(p_finishes))
  ),
  -- Widths: apply all filters EXCEPT width
  for_widths AS (
    SELECT DISTINCT width FROM base
    WHERE width IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_pcds      IS NULL OR pcd      = ANY(p_pcds))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- PCDs: apply all filters EXCEPT pcd
  for_pcds AS (
    SELECT DISTINCT pcd FROM base
    WHERE pcd IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- Colors: apply all filters EXCEPT color
  for_colors AS (
    SELECT DISTINCT color FROM base
    WHERE color IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR pcd      = ANY(p_pcds))
      AND (p_finishes  IS NULL OR finish   = ANY(p_finishes))
  ),
  -- Finishes: apply all filters EXCEPT finish
  for_finishes AS (
    SELECT DISTINCT finish FROM base
    WHERE finish IS NOT NULL
      AND (p_brands    IS NULL OR brand    = ANY(p_brands))
      AND (p_diameters IS NULL OR diameter = ANY(p_diameters))
      AND (p_widths    IS NULL OR width    = ANY(p_widths))
      AND (p_pcds      IS NULL OR pcd      = ANY(p_pcds))
      AND (p_colors    IS NULL OR color    = ANY(p_colors))
  )
  SELECT jsonb_build_object(
    'brands',    COALESCE((SELECT jsonb_agg(brand    ORDER BY brand)    FROM for_brands),    '[]'),
    'diameters', COALESCE((SELECT jsonb_agg(diameter ORDER BY diameter) FROM for_diameters), '[]'),
    'widths',    COALESCE((SELECT jsonb_agg(width    ORDER BY width)    FROM for_widths),    '[]'),
    'pcds',      COALESCE((SELECT jsonb_agg(pcd      ORDER BY pcd)      FROM for_pcds),      '[]'),
    'colors',    COALESCE((SELECT jsonb_agg(color    ORDER BY color)    FROM for_colors),    '[]'),
    'finishes',  COALESCE((SELECT jsonb_agg(finish   ORDER BY finish)   FROM for_finishes),  '[]'),
    -- Price range is always global so the user can always see the full extent
    'price_min', COALESCE((SELECT MIN(price) FROM products WHERE is_active = true), 0),
    'price_max', COALESCE((SELECT MAX(price) FROM products WHERE is_active = true), 0)
  )
$$;

-- Allow anonymous users to call this function (matches anon RLS on products)
GRANT EXECUTE ON FUNCTION get_cascading_filter_options TO anon, authenticated;
