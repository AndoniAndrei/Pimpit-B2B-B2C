/**
 * Import engine v2 — maparea unui rând brut de feed în payload canonic
 * (familie / variantă / atribute / ofertă / media), pe baza unui
 * supplier_mapping_profile + validare tipizată vs category_attribute_definitions.
 *
 * Pure functions (fără DB) — pipeline.ts furnizează contextul încărcat din DB.
 */
import { resolveTemplate } from '../../genericParser';
import { evaluateFormula } from '../../formulaEvaluator';
import { parseSmartNumber } from '../../priceParser';
import { parseEtRange } from '../../etRangeParser';
import { splitAndNormalizePcds } from '../../pcdUtils';
import { toRon, resolveBrand, type CurrencyRates } from '../normalizers';
import { applyTransformChain, passesRowFilter, type RowFilterConfig } from './transforms';
import type { ValueTransform, AttributeDataType, MappingTargetKind } from '../../catalog/types';

// ── Context (încărcat de pipeline din DB) ────────────────────────────────────

export interface FieldMappingLite {
  target_kind: MappingTargetKind;
  target_code: string;
  source_expression: string;
  transform: ValueTransform[];
  required: boolean;
  default_value: string | null;
  position: number;
}

export interface TransformRuleLite {
  rule_type: string;
  config: Record<string, unknown>;
  position: number;
}

export interface AttributeDefLite {
  id: number;
  code: string;
  data_type: AttributeDataType;
  enum_options: string[] | null;
  is_required: boolean;
  validation: { min?: number; max?: number; regex?: string } | null;
}

export interface BrandLookupWithId {
  id: number;
  name: string;
  slug: string;
  aliases: string[];
}

export interface MappingContext {
  supplierId: number;
  fieldMappings: FieldMappingLite[];
  rules: TransformRuleLite[];
  attributeDefs: AttributeDefLite[];
  brands: BrandLookupWithId[];
  rates: CurrencyRates;
}

// ── Rezultat ─────────────────────────────────────────────────────────────────

export interface MapIssue {
  code: string;
  message: string;
  field?: string;
}

export interface MappedRow {
  /** Setat când rândul e sărit intenționat (row_filter) — nu e eroare. */
  skipped?: string;
  core: {
    partNumber: string;
    brandName: string;
    brandId: number | null;
    name: string;
    familyName: string;
    nameSuffix: string | null;
    ean: string | null;
    description: string | null;
  };
  /** Valori tipizate per cod de atribut (number | string | boolean | string[] | {min,max}). */
  attributes: Record<string, unknown>;
  offer: {
    rawPrice: number | null;
    currency: string;
    price: number | null;
    priceB2b: number | null;
    stock: number;
    stockIncoming: number;
    supplierSku: string | null;
    leadTimeDays: number | null;
  };
  media: string[];
  errors: MapIssue[];
  warnings: MapIssue[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveSource(expr: string, row: Record<string, unknown>): string {
  if (expr.includes('{')) return resolveTemplate(expr, row as Record<string, string>);
  const v = row[expr];
  return v === null || v === undefined ? '' : String(v).trim();
}

function coerceBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'da' || v === 'tak' || v === 't' || v === 'x';
}

/** Coerce o valoare string la tipul definiției de atribut. null = valoare invalidă. */
export function coerceAttributeValue(
  raw: string,
  def: AttributeDefLite
): unknown | null {
  const s = raw.trim();
  if (!s) return null;
  switch (def.data_type) {
    case 'text':
    case 'enum':
      return s;
    case 'number': {
      const n = parseSmartNumber(s);
      return n === null ? null : n;
    }
    case 'integer': {
      const n = parseSmartNumber(s);
      return n === null ? null : Math.round(n);
    }
    case 'boolean':
      return coerceBool(s);
    case 'multi_enum': {
      // bolt_pattern primește normalizarea PCD dedicată; restul: split simplu
      const parts = def.code === 'bolt_pattern'
        ? splitAndNormalizePcds(s)
        : s.split(/[\/,;|]+/).map(p => p.trim()).filter(Boolean);
      return parts.length ? parts : null;
    }
    case 'range': {
      const r = parseEtRange(s);
      return r ? { min: r.min, max: r.max } : null;
    }
    default:
      return s;
  }
}

/** Validează o valoare deja coerce-uită vs definiția atributului. */
export function validateAttributeValue(
  value: unknown,
  def: AttributeDefLite
): MapIssue | null {
  const v = def.validation;
  const numCheck = (n: number): MapIssue | null => {
    if (v?.min !== undefined && n < v.min)
      return { code: 'OUT_OF_RANGE', field: def.code, message: `${def.code}: ${n} < min ${v.min}` };
    if (v?.max !== undefined && n > v.max)
      return { code: 'OUT_OF_RANGE', field: def.code, message: `${def.code}: ${n} > max ${v.max}` };
    return null;
  };
  if (typeof value === 'number') return numCheck(value);
  if (def.data_type === 'range' && value && typeof value === 'object') {
    const r = value as { min: number; max: number };
    return numCheck(r.min) ?? numCheck(r.max);
  }
  if (def.data_type === 'enum' && typeof value === 'string' && def.enum_options?.length) {
    const ok = def.enum_options.some(o => o.toLowerCase() === value.toLowerCase());
    if (!ok)
      return { code: 'UNKNOWN_ENUM_VALUE', field: def.code, message: `${def.code}: "${value}" nu e în opțiuni` };
  }
  if (typeof value === 'string' && v?.regex) {
    if (!new RegExp(v.regex).test(value))
      return { code: 'REGEX_MISMATCH', field: def.code, message: `${def.code}: "${value}" nu respectă formatul` };
  }
  return null;
}

// ── Maparea unui rând ────────────────────────────────────────────────────────

export function mapRow(row: Record<string, unknown>, ctx: MappingContext): MappedRow {
  const out: MappedRow = {
    core: {
      partNumber: '', brandName: '', brandId: null, name: '',
      familyName: '', nameSuffix: null, ean: null, description: null,
    },
    attributes: {},
    offer: {
      rawPrice: null, currency: 'RON', price: null, priceB2b: null,
      stock: 0, stockIncoming: 0, supplierSku: null, leadTimeDays: null,
    },
    media: [],
    errors: [],
    warnings: [],
  };

  const rules = [...ctx.rules].sort((a, b) => a.position - b.position);
  const defsByCode = new Map(ctx.attributeDefs.map(d => [d.code, d]));

  // 1) Filtre pe rând — toate trebuie să treacă
  for (const r of rules) {
    if (r.rule_type !== 'row_filter') continue;
    const cfg = r.config as unknown as RowFilterConfig;
    if (!passesRowFilter(row, cfg)) {
      out.skipped = `row_filter: ${cfg.column} ${cfg.op}`;
      return out;
    }
  }

  // 2) Mapările de câmpuri
  const mappings = [...ctx.fieldMappings].sort((a, b) => a.position - b.position);
  const rawAttributeValues: Record<string, string> = {};

  for (const m of mappings) {
    let value: string;
    try {
      value = applyTransformChain(resolveSource(m.source_expression, row), m.transform ?? []);
    } catch (e) {
      out.errors.push({
        code: 'TRANSFORM_ERROR', field: m.target_code,
        message: `${m.target_code}: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    if (!value && m.default_value !== null && m.default_value !== undefined) {
      value = m.default_value;
    }
    if (!value) {
      if (m.required) {
        out.errors.push({
          code: 'MISSING_REQUIRED', field: m.target_code,
          message: `Câmp obligatoriu gol: ${m.target_kind}:${m.target_code}`,
        });
      }
      continue;
    }

    switch (m.target_kind) {
      case 'core':
        switch (m.target_code) {
          case 'part_number': out.core.partNumber = value; break;
          case 'brand':       out.core.brandName = value; break;
          case 'name':        out.core.name = value; break;
          case 'family_name': out.core.familyName = value; break;
          case 'name_suffix': out.core.nameSuffix = value; break;
          case 'ean':         out.core.ean = value; break;
          case 'description': out.core.description = value; break;
          default:
            out.warnings.push({ code: 'UNKNOWN_TARGET', field: m.target_code, message: `core:${m.target_code} necunoscut` });
        }
        break;

      case 'offer':
        switch (m.target_code) {
          case 'raw_price':      out.offer.rawPrice = parseSmartNumber(value); break;
          case 'price_b2b':      out.offer.priceB2b = parseSmartNumber(value); break;
          case 'currency':       out.offer.currency = value.toUpperCase(); break;
          case 'stock':          out.offer.stock = Math.max(0, Math.round(parseSmartNumber(value) ?? 0)); break;
          case 'stock_incoming': out.offer.stockIncoming = Math.max(0, Math.round(parseSmartNumber(value) ?? 0)); break;
          case 'supplier_sku':   out.offer.supplierSku = value; break;
          case 'lead_time_days': out.offer.leadTimeDays = Math.round(parseSmartNumber(value) ?? 0) || null; break;
          default:
            out.warnings.push({ code: 'UNKNOWN_TARGET', field: m.target_code, message: `offer:${m.target_code} necunoscut` });
        }
        break;

      case 'attribute':
        rawAttributeValues[m.target_code] = value;
        break;

      case 'media':
        // orice target media cu URL http(s) devine un asset; ordinea = position
        if (/^https?:\/\//.test(value) || value.startsWith('//')) {
          out.media.push(value.startsWith('//') ? `https:${value}` : value);
        }
        break;

      case 'custom':
        // păstrat pentru extensii; ignorat de motorul de bază
        break;
    }
  }

  // 3) Reguli la nivel de profil
  for (const r of rules) {
    switch (r.rule_type) {
      case 'brand_normalize': {
        const cfg = r.config as { extra?: Record<string, string>; auto_create?: boolean };
        const extra = cfg.extra ?? {};
        const remapped = extra[out.core.brandName] ?? extra[out.core.brandName.toLowerCase()];
        if (remapped) out.core.brandName = remapped;
        const resolved = resolveBrand(out.core.brandName, ctx.brands);
        if (resolved) {
          out.core.brandName = resolved;
          out.core.brandId = ctx.brands.find(b => b.name === resolved)?.id ?? null;
        } else if (out.core.brandName && !cfg.auto_create) {
          out.errors.push({
            code: 'UNKNOWN_BRAND', field: 'brand',
            message: `Brand necunoscut: "${out.core.brandName}" (adaugă-l în brands/aliases sau activează auto_create)`,
          });
        }
        break;
      }
      case 'currency_convert': {
        const cfg = r.config as { currency?: string };
        if (cfg.currency) out.offer.currency = cfg.currency.toUpperCase();
        break;
      }
      case 'formula': {
        const cfg = r.config as { target?: string; expression?: string };
        if (!cfg.expression) break;
        try {
          const result = evaluateFormula(cfg.expression, row as Record<string, string>);
          if (cfg.target === 'offer:raw_price') out.offer.rawPrice = result;
          else if (cfg.target === 'offer:price_b2b') out.offer.priceB2b = result;
          else out.offer.price = result; // implicit: offer:price (RON final)
        } catch (e) {
          out.errors.push({
            code: 'FORMULA_ERROR', field: cfg.target ?? 'offer:price',
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      }
    }
  }

  // 4) Preț final: formula are prioritate; altfel raw_price convertit în RON
  if (out.offer.price === null && out.offer.rawPrice !== null) {
    try {
      out.offer.price = Math.round(toRon(out.offer.rawPrice, out.offer.currency, ctx.rates) * 100) / 100;
    } catch (e) {
      out.errors.push({
        code: 'CURRENCY_ERROR', field: 'currency',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 5) Atribute: coerce + validare tipizată
  for (const [code, raw] of Object.entries(rawAttributeValues)) {
    const def = defsByCode.get(code);
    if (!def) {
      out.warnings.push({ code: 'UNKNOWN_ATTRIBUTE', field: code, message: `Atribut fără definiție în categorie: ${code}` });
      continue;
    }
    const coerced = coerceAttributeValue(raw, def);
    if (coerced === null) {
      out.errors.push({ code: 'BAD_VALUE', field: code, message: `${code}: "${raw}" nu poate fi interpretat ca ${def.data_type}` });
      continue;
    }
    const issue = validateAttributeValue(coerced, def);
    if (issue) {
      out.errors.push(issue);
      continue;
    }
    out.attributes[code] = coerced;
  }

  // 6) Verificări finale obligatorii
  if (!out.core.partNumber) {
    out.errors.push({ code: 'MISSING_REQUIRED', field: 'part_number', message: 'part_number lipsește' });
  }
  if (!out.core.brandName) {
    out.errors.push({ code: 'MISSING_REQUIRED', field: 'brand', message: 'brand lipsește' });
  }
  if (!out.core.name) out.core.name = out.core.partNumber;
  if (!out.core.familyName) out.core.familyName = out.core.name;
  for (const def of ctx.attributeDefs) {
    if (def.is_required && out.attributes[def.code] === undefined) {
      out.errors.push({
        code: 'MISSING_REQUIRED_ATTRIBUTE', field: def.code,
        message: `Atribut obligatoriu lipsă: ${def.code}`,
      });
    }
  }

  return out;
}

/**
 * Dedup în interiorul feed-ului pe (brand, part_number) — aceeași semantică
 * ca v1: câștigă rândul cu cel mai mare preț valid (evită rândurile eronate
 * cu preț aproape de zero).
 */
export function dedupeMappedRows(rows: MappedRow[]): MappedRow[] {
  const map = new Map<string, MappedRow>();
  for (const r of rows) {
    if (r.skipped || r.errors.length) continue;
    const key = `${r.core.brandName.toLowerCase()}|${r.core.partNumber.toLowerCase()}`;
    const existing = map.get(key);
    const price = r.offer.price ?? 0;
    const existingPrice = existing?.offer.price ?? 0;
    if (!existing || (price > 0 && price > existingPrice)) map.set(key, r);
  }
  return Array.from(map.values());
}
