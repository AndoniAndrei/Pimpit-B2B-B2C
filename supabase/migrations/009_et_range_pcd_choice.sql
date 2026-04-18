-- ============================================================
-- Migration 009: ET range support + PCD/ET customer choice
-- ============================================================
-- Context:
--   Some suppliers (e.g. Wheeltrade) publish a list of valid ET
--   values per SKU, formatted either as a continuous list
--   ("20,21,22,...,49,50") or an interval ("20-50"). The legacy
--   parser collapsed these into a single number and the overflow
--   clamp produced the familiar "ET99999" artefact in the UI.
--
--   For wheels with 3+ bolt patterns the customer must also pick
--   one fitment at order time (or ask for help).
--
-- What this migration does:
--   1. Adds et_min / et_max on products so the catalog knows the
--      full valid ET interval. Single-value ET stays as before
--      (et_offset), but et_min/et_max mirror it for querying.
--   2. Adds per-line selection fields on cart + order_items so we
--      can record the customer's ET + PCD choice (or "needs help").
--   3. Backfills et_min/et_max from existing et_offset so the new
--      columns are never NULL for rows that had any offset data.
-- ============================================================

-- ── 1. products: et range ────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS et_min NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS et_max NUMERIC(6,2);

-- Mirror existing et_offset so range queries "just work" for legacy rows.
UPDATE products
SET et_min = et_offset,
    et_max = et_offset
WHERE et_offset IS NOT NULL
  AND (et_min IS NULL OR et_max IS NULL);

CREATE INDEX IF NOT EXISTS idx_prod_et_min ON products(et_min) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prod_et_max ON products(et_max) WHERE is_active = true;

-- Guardrail: if both are present, min <= max.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_prod_et_range;
ALTER TABLE products
  ADD CONSTRAINT chk_prod_et_range
  CHECK (et_min IS NULL OR et_max IS NULL OR et_min <= et_max);


-- ── 2. cart: customer ET / PCD choice ────────────────────────────────────────
ALTER TABLE cart
  ADD COLUMN IF NOT EXISTS selected_et     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS selected_pcd    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS needs_help_et   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_help_pcd  BOOLEAN NOT NULL DEFAULT false;


-- ── 3. order_items: snapshot of the choice at checkout ───────────────────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_et     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS selected_pcd    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS needs_help_et   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_help_pcd  BOOLEAN NOT NULL DEFAULT false;
