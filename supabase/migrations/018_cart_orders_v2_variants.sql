-- ============================================================================
-- 018 — COȘ + COMENZI pentru variante V2 (aditiv; fluxul v1 rămâne neatins)
-- cart.variant_id / order_items.variant_id — un rând de coș referă FIE un
-- produs v1 (products), FIE o variantă v2 (product_variants).
-- ============================================================================

-- ── cart ────────────────────────────────────────────────────────────────────

ALTER TABLE cart
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- product_id devine opțional (rândurile v2 nu îl folosesc)
ALTER TABLE cart ALTER COLUMN product_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE cart ADD CONSTRAINT cart_product_or_variant
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unicitate per (user × variantă) și (sesiune × variantă).
-- NULL-urile nu intră în conflict, deci rândurile v1 nu sunt afectate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_user_variant
  ON cart(user_id, variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_session_variant
  ON cart(session_id, variant_id);

-- ── order_items ─────────────────────────────────────────────────────────────

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
