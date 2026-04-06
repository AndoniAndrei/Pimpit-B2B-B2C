/**
 * PCD (Pitch Circle Diameter) normalization utilities.
 *
 * Handles the variety of formats suppliers use:
 *   - decimal separator:  "5x114,3"  → "5X114.3"
 *   - case:               "5x112"    → "5X112"
 *   - spaces around X:   "5 x 112"  → "5X112"
 *   - list separators:   "/", ",", ";", "|" all treated as multi-bolt delimiters
 *
 * Canonical storage format: individual PCDs joined by PCD_SEPARATOR ("/").
 * Example: "3X112/4X100/5X112"
 */

/** Canonical separator used when storing multi-bolt PCDs in the database. */
export const PCD_SEPARATOR = '/';

/**
 * Normalize a single PCD token to canonical form.
 *
 * Steps:
 *   1. Trim whitespace
 *   2. Replace decimal comma with dot  ("114,3" → "114.3")
 *   3. Uppercase
 *   4. Collapse any whitespace around the 'X' bolt-circle separator
 */
export function normalizeSinglePcd(raw: string): string {
  return raw
    .trim()
    .replace(/(\d),(\d)/g, '$1.$2')  // decimal comma → dot (only between digits)
    .toUpperCase()
    .replace(/\s*X\s*/g, 'X');       // collapse spaces around X
}

/**
 * Regex that matches any multi-bolt list separator AFTER decimal commas
 * have already been normalized to dots.
 * Handles: / ; | and lone commas (not decimal ones).
 */
const SEPARATOR_RE = /[/;|]|,\s*/;

/**
 * Sanity-check: a valid individual PCD token must start with a digit.
 */
const VALID_PCD_RE = /^\d/;

/**
 * Split a raw PCD field value (as received from a supplier) into an array
 * of individual normalized PCD strings.
 *
 * @example
 * splitAndNormalizePcds("3X112/4X100/5x114,3")
 *   // → ["3X112", "4X100", "5X114.3"]
 *
 * splitAndNormalizePcds("3X112, 4X100, 5 x 114,3")
 *   // → ["3X112", "4X100", "5X114.3"]
 *
 * splitAndNormalizePcds("5X112")
 *   // → ["5X112"]
 */
export function splitAndNormalizePcds(raw: string): string[] {
  if (!raw) return [];
  // Step 1: normalize decimal commas so "114,3" → "114.3" before splitting on ","
  const decimalFixed = raw.replace(/(\d),(\d)/g, '$1.$2');
  // Step 2: split on any list separator
  return decimalFixed
    .split(SEPARATOR_RE)
    .map(normalizeSinglePcd)
    .filter(p => p.length > 0 && VALID_PCD_RE.test(p));
}

/**
 * Normalize a raw PCD field value for canonical database storage:
 * splits into individual PCDs, normalizes each, then rejoins with PCD_SEPARATOR.
 *
 * Returns undefined if no valid PCD tokens are found.
 */
export function normalizeAndJoinPcds(raw: string): string | undefined {
  const parts = splitAndNormalizePcds(raw);
  if (parts.length === 0) return undefined;
  return parts.join(PCD_SEPARATOR);
}

/**
 * Build a PostgREST OR filter clause that matches a product whose `pcd`
 * column contains `pcdValue` as an individual slash-separated element.
 *
 * Covers all positions: single value, start, end, or middle of a multi-bolt string.
 *
 * @example
 * buildPcdOrClause("5X112")
 *   // → "pcd.eq.5X112,pcd.like.5X112/%,pcd.like.%/5X112,pcd.like.%/5X112/%"
 */
export function buildPcdOrClause(pcdValue: string): string {
  const v = pcdValue;
  const s = PCD_SEPARATOR; // "/"
  return [
    `pcd.eq.${v}`,          // exact single-bolt match
    `pcd.like.${v}${s}%`,   // starts multi-bolt: "5X112/..."
    `pcd.like.%${s}${v}`,   // ends multi-bolt:   ".../5X112"
    `pcd.like.%${s}${v}${s}%`, // middle of multi-bolt: ".../5X112/..."
  ].join(',');
}
