-- Add ET offset range support for BLANK/multi-fit wheels where ET is custom-ordered
-- Some suppliers send 99999 as sentinel for "ET variable/custom" — these wheels have an ET range

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS et_offset_min NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS et_offset_max NUMERIC(7,2);

COMMENT ON COLUMN products.et_offset_min IS 'Minimum ET for custom-ET wheels (e.g. 20 for ET20-40)';
COMMENT ON COLUMN products.et_offset_max IS 'Maximum ET for custom-ET wheels (e.g. 40 for ET20-40)';
