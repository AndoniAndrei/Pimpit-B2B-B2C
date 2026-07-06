-- ============================================================================
-- 016 — BACKFILL LEGACY → CATALOG V2 (opt-in, re-rulabil, non-destructiv)
-- Copiază products (v1) → brands / catalog_products / product_variants /
-- supplier_offers / product_variant_attributes / media_assets.
-- NU se execută automat: se apelează manual `SELECT backfill_catalog_from_legacy();`
-- Strategie: 1 produs v1 = 1 familie + 1 variantă (gruparea în familii reale
-- e un pas ulterior de calitate a datelor — vezi docs/CATALOG_V2_PLAN.md §4).
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_catalog_from_legacy()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  n_brands   INT;
  n_products INT;
  n_variants INT;
  n_offers   INT;
  n_media    INT;
BEGIN
  -- 1) Branduri din products.brand (case-insensitive, primul câștigă)
  INSERT INTO brands (name, slug)
  SELECT DISTINCT ON (slugify(p.brand)) p.brand, slugify(p.brand)
  FROM products p
  WHERE p.brand IS NOT NULL AND slugify(p.brand) <> ''
  ORDER BY slugify(p.brand), p.brand
  ON CONFLICT (slug) DO NOTHING;
  GET DIAGNOSTICS n_brands = ROW_COUNT;

  -- 2) Familii: 1:1 cu produsele v1 (slug reutilizat — unic în v1)
  INSERT INTO catalog_products
    (category_id, brand_id, slug, name, description, is_active, legacy_source)
  SELECT
    c.id, b.id, p.slug, p.name, p.description, p.is_active, 'v1_backfill'
  FROM products p
  JOIN categories c ON c.slug = p.product_type::text   -- 'jante' | 'accesorii'
  JOIN brands b     ON b.slug = slugify(p.brand)
  WHERE NOT EXISTS (
    SELECT 1 FROM product_variants v WHERE v.legacy_product_id = p.id
  )
  ON CONFLICT (slug) DO NOTHING;
  GET DIAGNOSTICS n_products = ROW_COUNT;

  -- 3) Variante 1:1
  INSERT INTO product_variants
    (product_id, brand_id, part_number, ean, price, price_old, price_b2b,
     stock, stock_incoming, weight_kg, is_active, discontinued, legacy_product_id)
  SELECT
    cp.id, cp.brand_id, p.part_number, p.ean, p.price, p.price_old, p.price_b2b,
    COALESCE(p.stock, 0), COALESCE(p.stock_incoming, 0), p.weight,
    p.is_active, COALESCE(p.discontinued, false), p.id
  FROM products p
  JOIN catalog_products cp ON cp.slug = p.slug
  WHERE NOT EXISTS (
    SELECT 1 FROM product_variants v WHERE v.legacy_product_id = p.id
  )
  ON CONFLICT (brand_id, part_number) DO NOTHING;
  GET DIAGNOSTICS n_variants = ROW_COUNT;

  -- 4) Oferte din product_sources (audit v1)
  INSERT INTO supplier_offers
    (variant_id, supplier_id, raw_price, raw_currency, price,
     stock, stock_incoming, last_seen_at, raw_data)
  SELECT
    v.id, ps.supplier_id, ps.raw_price, COALESCE(ps.raw_currency, 'RON'),
    ps.calculated_price, COALESCE(ps.stock, 0), COALESCE(ps.stock_incoming, 0),
    COALESCE(ps.last_seen_at, now()), ps.raw_data
  FROM product_sources ps
  JOIN products p         ON p.part_number = ps.part_number AND p.brand = ps.brand
  JOIN product_variants v ON v.legacy_product_id = p.id
  ON CONFLICT (variant_id, supplier_id) DO UPDATE
    SET raw_price = EXCLUDED.raw_price,
        price     = EXCLUDED.price,
        stock     = EXCLUDED.stock,
        last_seen_at = EXCLUDED.last_seen_at;
  GET DIAGNOSTICS n_offers = ROW_COUNT;

  -- 4b) Ofertă sintetică pentru produse fără rând în product_sources
  INSERT INTO supplier_offers
    (variant_id, supplier_id, raw_price, price, price_b2b, stock, stock_incoming)
  SELECT
    v.id, p.winning_supplier_id, p.winning_raw_price, p.price, p.price_b2b,
    COALESCE(p.stock, 0), COALESCE(p.stock_incoming, 0)
  FROM products p
  JOIN product_variants v ON v.legacy_product_id = p.id
  WHERE p.winning_supplier_id IS NOT NULL
  ON CONFLICT (variant_id, supplier_id) DO NOTHING;

  -- 5) Atribute tipizate pentru jante
  --    (categoria 'jante'; definițiile vin din migrația 013)
  WITH defs AS (
    SELECT d.id, d.code
    FROM category_attribute_definitions d
    JOIN categories c ON c.id = d.category_id
    WHERE c.slug = 'jante'
  ),
  src AS (
    SELECT v.id AS variant_id, p.*
    FROM products p
    JOIN product_variants v ON v.legacy_product_id = p.id
    WHERE p.product_type::text = 'jante'
  )
  INSERT INTO product_variant_attributes
    (variant_id, attribute_id, value_text, value_numeric, value_numeric_max, value_json)
  SELECT s.variant_id, d.id,
    CASE d.code WHEN 'color' THEN s.color WHEN 'finish' THEN s.finish END,
    CASE d.code
      WHEN 'diameter_inch'  THEN s.diameter
      WHEN 'width_inch'     THEN s.width
      WHEN 'et_offset'      THEN COALESCE(s.et_min, s.et_offset)
      WHEN 'center_bore_mm' THEN s.center_bore
      WHEN 'max_load_kg'    THEN s.max_load
      WHEN 'wheel_weight_kg' THEN s.weight
    END,
    CASE d.code WHEN 'et_offset' THEN COALESCE(s.et_max, s.et_offset) END,
    CASE WHEN d.code = 'bolt_pattern' AND s.pcd IS NOT NULL
      THEN to_jsonb(string_to_array(s.pcd, '/'))
    END
  FROM src s
  CROSS JOIN defs d
  WHERE (d.code = 'diameter_inch'   AND s.diameter    IS NOT NULL)
     OR (d.code = 'width_inch'      AND s.width       IS NOT NULL)
     OR (d.code = 'et_offset'       AND COALESCE(s.et_min, s.et_offset) IS NOT NULL)
     OR (d.code = 'center_bore_mm'  AND s.center_bore IS NOT NULL)
     OR (d.code = 'color'           AND s.color       IS NOT NULL)
     OR (d.code = 'finish'          AND s.finish      IS NOT NULL)
     OR (d.code = 'bolt_pattern'    AND s.pcd         IS NOT NULL)
     OR (d.code = 'max_load_kg'     AND s.max_load    IS NOT NULL)
     OR (d.code = 'wheel_weight_kg' AND s.weight      IS NOT NULL)
  ON CONFLICT (variant_id, attribute_id) DO NOTHING;

  -- 6) Media din products.images[]
  INSERT INTO media_assets (product_id, variant_id, kind, source, url, position)
  SELECT cp.id, v.id, 'image',
    CASE WHEN img.url LIKE '/api/images/%' THEN 'rest_proxy'::media_source_enum
         ELSE 'feed_url'::media_source_enum END,
    img.url, img.ord - 1
  FROM products p
  JOIN product_variants v  ON v.legacy_product_id = p.id
  JOIN catalog_products cp ON cp.id = v.product_id
  CROSS JOIN LATERAL unnest(p.images) WITH ORDINALITY AS img(url, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM media_assets m WHERE m.variant_id = v.id
  );
  GET DIAGNOSTICS n_media = ROW_COUNT;

  RETURN jsonb_build_object(
    'brands_inserted',   n_brands,
    'families_inserted', n_products,
    'variants_inserted', n_variants,
    'offers_upserted',   n_offers,
    'media_inserted',    n_media
  );
END;
$$;

COMMENT ON FUNCTION backfill_catalog_from_legacy() IS
  'Copiază catalogul v1 (products/product_sources) în modelul v2. Re-rulabil; '
  'sare peste produsele deja migrate (match pe product_variants.legacy_product_id).';
