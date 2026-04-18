/**
 * Parse an ET offset value that may be a single number, a continuous comma list
 * ("20,21,22,...,49,50"), or a dash interval ("20-50").
 *
 * Suppliers in the wild (e.g. Wheeltrade) publish custom-ET wheels with either a
 * full enumeration of every valid offset or the two endpoints of an interval.
 * `parseSmartNumber` treats commas as thousands separators, so without this
 * helper "20,21,22,…,50" collapses into a huge number, gets clamped, and the
 * product ends up rendered as "ET99999".
 *
 * Returns the inferred min/max plus an `isRange` flag so callers can distinguish
 * a true range from a single value that happens to equal its min and max.
 *
 * Values we deliberately keep supporting as a single number:
 *   - "45"           → min=max=45
 *   - "45.5"         → min=max=45.5
 *   - "45,5"         → min=max=45.5  (European decimal, single separator)
 *
 * Values we treat as a range:
 *   - "20-50"        → min=20 max=50
 *   - "20 – 50"      → min=20 max=50  (en-dash / em-dash also accepted)
 *   - "20,21,…,50"   → min=20 max=50  (2+ commas means list, never decimal)
 *   - "20;21;22;…"   → min=20 max=50  (semicolon / pipe also accepted)
 */
export interface EtRange {
  min: number;
  max: number;
  isRange: boolean;
}

export function parseEtRange(raw: string | number | null | undefined): EtRange | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : { min: raw, max: raw, isRange: false };
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Dash / en-dash / em-dash interval: "20-50", "20 - 50", "-10 – 20"
  const dashMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)$/);
  if (dashMatch) {
    const a = parseFloat(dashMatch[1]);
    const b = parseFloat(dashMatch[2]);
    if (!isNaN(a) && !isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b), isRange: a !== b };
    }
  }

  // Two or more list separators → treat as enumeration, never a decimal.
  // A single comma could still be a European decimal ("45,5"), so require 2+.
  const sepCount = (s.match(/[,;|]/g) || []).length;
  if (sepCount >= 2) {
    const tokens = s.split(/[,;|]+/).map(t => t.trim()).filter(Boolean);
    const nums = tokens
      .map(t => parseFloat(t.replace(',', '.')))
      .filter(n => !isNaN(n));
    if (nums.length >= 2) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return { min, max, isRange: min !== max };
    }
  }

  // Single value, possibly with a European decimal comma.
  const single = parseFloat(s.replace(',', '.'));
  if (!isNaN(single)) return { min: single, max: single, isRange: false };

  return null;
}
