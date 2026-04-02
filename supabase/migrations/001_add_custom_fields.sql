-- Migration: Add custom_fields JSONB column to products table
-- This stores extra supplier-specific fields that don't map to standard columns
-- e.g. {"Culoare Specială": "Negru Mat", "Tip Finisaj": "Gloss"}

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- Index for searching within custom_fields (GIN for JSONB containment queries)
CREATE INDEX IF NOT EXISTS idx_prod_custom_fields ON products USING gin(custom_fields);

COMMENT ON COLUMN products.custom_fields IS 'Extra supplier-specific fields stored as key-value pairs. Populated during import from extra_fields mapping configuration.';
