/**
 * Import engine v2 — lanțul de transformări pe valori și regulile pe rând.
 * Corespund cu supplier_field_mappings.transform și supplier_transform_rules.
 * Pure functions — testate în tests/engine-transforms.test.ts.
 */
import { parseSmartNumber } from '../../priceParser';
import { convertUnit } from '../normalizers';
import type { ValueTransform } from '../../catalog/types';

// ── Transformări pe valoare (per câmp mapat) ─────────────────────────────────

export function applyTransformChain(raw: string, chain: ValueTransform[]): string {
  let value = raw;
  for (const t of chain) {
    switch (t.type) {
      case 'trim':
        value = value.trim();
        break;
      case 'uppercase':
        value = value.toUpperCase();
        break;
      case 'lowercase':
        value = value.toLowerCase();
        break;
      case 'number_locale': {
        const n = parseSmartNumber(value);
        value = n === null ? '' : String(n);
        break;
      }
      case 'unit_convert': {
        const n = parseSmartNumber(value);
        value = n === null ? '' : String(convertUnit(n, t.from, t.to));
        break;
      }
      case 'regex_extract': {
        const m = value.match(new RegExp(t.pattern));
        value = m ? (m[t.group ?? 1] ?? m[0] ?? '') : '';
        break;
      }
      case 'value_remap': {
        const mapped = t.map[value] ?? t.map[value.toLowerCase()];
        if (mapped !== undefined) value = mapped;
        break;
      }
      default:
        throw new Error(`Transformare necunoscută: ${(t as { type: string }).type}`);
    }
  }
  return value;
}

// ── Reguli pe rând (row_filter) ──────────────────────────────────────────────

export interface RowFilterConfig {
  column: string;
  op: 'in' | 'not_in' | 'equals' | 'not_equals' | 'not_empty' | 'regex';
  values?: string[];
  value?: string;
}

/** true = rândul trece filtrul; false = rândul se sare. */
export function passesRowFilter(row: Record<string, unknown>, cfg: RowFilterConfig): boolean {
  const raw = String(row[cfg.column] ?? '').trim();
  const rawLower = raw.toLowerCase();
  const values = (cfg.values ?? []).map(v => v.trim().toLowerCase());
  switch (cfg.op) {
    case 'in':         return values.includes(rawLower);
    case 'not_in':     return !values.includes(rawLower);
    case 'equals':     return rawLower === (cfg.value ?? '').trim().toLowerCase();
    case 'not_equals': return rawLower !== (cfg.value ?? '').trim().toLowerCase();
    case 'not_empty':  return raw !== '';
    case 'regex':      return cfg.value ? new RegExp(cfg.value, 'i').test(raw) : true;
    default:           return true;
  }
}
