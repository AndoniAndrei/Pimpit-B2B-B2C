/**
 * Smart price parser that handles all common numeric formats:
 *
 * European format (period = thousands, comma = decimal):
 *   "14.000,00"      → 14000.00
 *   "1.431 lei"      → 1431      ← strips text suffix before parsing
 *   "1.234.567,89"   → 1234567.89
 *   "14,5"           → 14.5
 *
 * US/Standard format (comma = thousands, period = decimal):
 *   "14,000.00"      → 14000.00
 *   "1,234,567.89"   → 1234567.89
 *   "14.5"           → 14.5
 *
 * Plain numbers:
 *   "14000"          → 14000
 *   14000            → 14000
 *
 * With any text suffix/prefix (stripped completely):
 *   "14.000,00 RON"  → 14000.00
 *   "€ 1.234,56"     → 1234.56
 *   "1.431 lei"      → 1431
 *   "250 kg"         → 250
 */
export function parseSmartNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  // Strip EVERYTHING except digits, period, comma, and minus sign.
  // This handles any currency suffix/prefix: "lei", "RON", "EUR", "$", "€", "kg", etc.
  // Critical: "1.431 lei" → "1.431" → correctly detected as European thousands → 1431
  const cleaned = String(value)
    .trim()
    .replace(/[^0-9.,-]/g, '')
    .trim();

  if (cleaned === '' || cleaned === '-') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');
  const commaCount = (cleaned.match(/,/g) || []).length;
  const periodCount = (cleaned.match(/\./g) || []).length;

  let normalized = cleaned;

  if (lastComma !== -1 && lastPeriod !== -1) {
    // Both separators present — determine which is decimal
    if (lastComma > lastPeriod) {
      // European: 14.000,00 — period = thousands, comma = decimal
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 14,000.00 — comma = thousands, period = decimal
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma present
    const afterComma = cleaned.substring(lastComma + 1);
    if (commaCount === 1 && afterComma.length !== 3) {
      // Single comma with 1-2 digits after → decimal separator: 14,5 or 14,50
      normalized = cleaned.replace(',', '.');
    } else {
      // Thousands separator: 14,000 or 1,234,567
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastPeriod !== -1) {
    // Only period present
    const afterPeriod = cleaned.substring(lastPeriod + 1);
    if (periodCount > 1) {
      // Multiple periods → thousands separators: 1.234.567
      normalized = cleaned.replace(/\./g, '');
    } else if (afterPeriod.length === 3 && periodCount === 1) {
      // Ambiguous: 14.000 or 1.431 — treat as thousands separator
      // Safe choice: avoids 1431 → 1.43 disaster
      normalized = cleaned.replace('.', '');
    }
    // else: standard decimal 14.5, 14.50 — no change
  }

  const result = parseFloat(normalized);
  if (isNaN(result)) return null;
  return result;
}

/**
 * Detect if a string value looks like a price with ambiguous format
 * Returns a warning message if ambiguous, null if clear
 */
export function detectPriceAmbiguity(value: string): string | null {
  const cleaned = String(value).replace(/[^0-9.,-]/g, '').trim();
  const lastPeriod = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  // Ambiguous: single period with exactly 3 decimal digits and no comma
  if (lastPeriod !== -1 && lastComma === -1) {
    const after = cleaned.substring(lastPeriod + 1);
    if (after.length === 3 && (cleaned.match(/\./g) || []).length === 1) {
      return `"${value}" poate fi ${parseSmartNumber(value)?.toLocaleString()} (mii) — verifică formatul`;
    }
  }
  return null;
}

/**
 * Format a number for display as price in RON
 */
export function formatPrice(value: number): string {
  return value.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
