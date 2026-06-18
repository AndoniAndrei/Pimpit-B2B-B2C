-- ============================================================
-- Migration 012: Seed SIXNINE Wheels as a permanent supplier
-- ============================================================
-- Adds SIXNINE Wheels (https://sixnine-wheels.com) as a supplier
-- feeding a CSV bundled in pimpit-web/public/feeds/sixnine.csv.
--
-- Pricing convention:
--   The feed only exposes `suggested_retail_price` (SRP) in EUR;
--   the `your_net_price` column is blank. Per product owner request,
--   we treat SRP as the final RON price as-is — no currency conversion,
--   no VAT uplift, no margin. All pricing_rules multipliers stay at 1.
--   Adjust later from the admin UI (Furnizori → SIXNINE → pricing rule)
--   when a real EUR→RON cost basis is agreed.
--
-- Stock convention:
--   The feed leaves `stock` blank on every row. The bundled CSV was
--   pre-processed to fill `stock = 99` so products are listed as
--   available out of the box. Once real stock data arrives, regenerate
--   the bundled CSV without that fill step (or point feed_url at the
--   live feed).
--
-- Multi-PCD wheels (e.g. 5x100, 5x114.3):
--   We rely on the existing `normalizeAndJoinPcds` helper in the parser,
--   which stores both bolt patterns as a single slash-separated string
--   ("5X100/5X114.3"). The customer picks one at the cart step via the
--   `selected_pcd` mechanism added in migration 009 — no schema change
--   needed here.
-- ============================================================

INSERT INTO suppliers (id, name, slug, feed_url, format, auth_method, csv_delimiter, driver_config)
VALUES (
  8,
  'SIXNINE Wheels',
  'sixnine',
  '/feeds/sixnine.csv',
  'csv',
  'none',
  ';',
  jsonb_build_object(
    'csv_delimiter', ';',
    'field_mappings', jsonb_build_object(
      'part_number',       'part_number',
      'brand',             'brand',
      'name',              'name',
      'model',             'model',
      'price_formula',     'suggested_retail_price',
      'stock',             'stock',
      'diameter',          'size',
      'width',             'width',
      'pcd',               'pcd',
      'et_offset',         'et',
      'color',             'colour',
      'center_bore',       'center_bore',
      'ean',               'ean',
      'images',            'photo',
      'images_2',          'photo1',
      'images_3',          'photo2',
      'images_4',          'photo3',
      'images_5',          'photo4',
      'youtube_link',      'youtube_link',
      'model_3d_url',      'link_3d',
      'description',       'description',
      'max_load',          'max_load',
      'production_method', 'production_method',
      'cn_code',           'cn_code',
      'product_type',      'jante'
    )
  )
)
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  feed_url      = EXCLUDED.feed_url,
  format        = EXCLUDED.format,
  csv_delimiter = EXCLUDED.csv_delimiter,
  driver_config = EXCLUDED.driver_config;

-- Pass-through pricing: SRP is taken as the final RON price.
-- pricing_rules has no unique constraint on supplier_id, so guard with NOT EXISTS
-- to keep this migration idempotent.
INSERT INTO pricing_rules
  (supplier_id, base_discount, base_multiplier, fixed_cost, vat_multiplier,
   margin_multiplier, final_divisor, notes)
SELECT 8, 0, 1, 0, 1, 1, 1,
   'SIXNINE: feed exposes only suggested_retail_price; pass-through to final RON price by request. Adjust here when a real EUR→RON + margin policy is agreed.'
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_rules WHERE supplier_id = 8
);
