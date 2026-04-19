-- ============================================================
-- Migration 011: Clean up corrupt ET values
-- ============================================================
-- Context:
--   Older imports ran an et_offset parser that treated a list like
--   "20,21,22,...,49,50" as a single number with commas as thousands
--   separators. After clampNum(…, 5) that produced artefacts like
--   99999 stored in et_offset and, after migration 009's backfill,
--   copied into et_min / et_max as well.
--
--   Real ET values for wheels are roughly in the -60 … +150 mm range,
--   so anything with |value| > 999 is unambiguously garbage. We null
--   those out so the UI stops rendering "ET99999" and the filters stop
--   offering an integer range with tens of thousands of entries.
--
-- Safe to re-run: the WHERE clause only matches corrupt rows; once
-- they're NULL they no longer qualify.
-- ============================================================

UPDATE products
SET et_offset = NULL,
    et_offset_rear = NULL,
    et_min = NULL,
    et_max = NULL
WHERE (et_offset IS NOT NULL AND abs(et_offset) > 999)
   OR (et_offset_rear IS NOT NULL AND abs(et_offset_rear) > 999)
   OR (et_min IS NOT NULL AND abs(et_min) > 999)
   OR (et_max IS NOT NULL AND abs(et_max) > 999);
