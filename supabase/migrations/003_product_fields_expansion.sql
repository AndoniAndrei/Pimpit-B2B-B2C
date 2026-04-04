-- Expand products table with new supplier data fields
-- Fix numeric overflow by widening precision on price, center_bore, et_offset

-- Widen numeric columns to prevent "numeric field overflow" on large values
ALTER TABLE products
  ALTER COLUMN price       TYPE NUMERIC(12,2),
  ALTER COLUMN center_bore TYPE NUMERIC(8,3),
  ALTER COLUMN et_offset   TYPE NUMERIC(7,2),
  ALTER COLUMN et_offset_rear TYPE NUMERIC(7,2),
  ALTER COLUMN winning_raw_price TYPE NUMERIC(14,4);

-- New product data columns from supplier specification
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS model             VARCHAR(200),
  ADD COLUMN IF NOT EXISTS ean               VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS youtube_link      TEXT,
  ADD COLUMN IF NOT EXISTS model_3d_url      TEXT,
  ADD COLUMN IF NOT EXISTS weight            NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS max_load          INTEGER,
  ADD COLUMN IF NOT EXISTS discontinued      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS concave_profile   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cn_code           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS certificate_url   TEXT,
  ADD COLUMN IF NOT EXISTS tuv_max_load      VARCHAR(50);
