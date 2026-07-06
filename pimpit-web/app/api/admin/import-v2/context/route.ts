/**
 * Context pentru wizard-ul de mapare (un singur fetch):
 * categorii (+ definițiile de atribute, cu moștenire de la părinte rezolvată),
 * branduri (pentru preview-ul de brand_normalize), cursuri valutare, furnizori.
 */
import { NextResponse } from 'next/server';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();

  const [categories, defs, brands, rates, suppliers] = await Promise.all([
    db.from('categories').select('id, parent_id, slug, name, position').eq('is_active', true).order('position'),
    db.from('category_attribute_definitions')
      .select('id, category_id, code, label, data_type, unit, enum_options, is_required, is_variant_defining, validation, position')
      .order('position'),
    db.from('brands').select('id, name, slug, aliases').eq('is_active', true).order('name'),
    db.from('currency_rates').select('code, rate_to_ron'),
    db.from('suppliers').select('id, name, slug, is_active, csv_delimiter, auth_method').order('id'),
  ]);

  for (const r of [categories, defs, brands, rates, suppliers]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  // Rezolvă moștenirea: atributele efective ale unei categorii = ale ei + ale strămoșilor
  const parentOf = new Map<number, number | null>();
  for (const c of categories.data ?? []) {
    parentOf.set(c.id as number, c.parent_id as number | null);
  }
  const defsByCategory = new Map<number, unknown[]>();
  for (const d of defs.data ?? []) {
    const arr = defsByCategory.get(d.category_id as number) ?? [];
    arr.push(d);
    defsByCategory.set(d.category_id as number, arr);
  }
  const effectiveAttrs: Record<number, unknown[]> = {};
  for (const c of categories.data ?? []) {
    const chain: unknown[] = [];
    let cursor: number | null = c.id as number;
    while (cursor !== null) {
      chain.push(...(defsByCategory.get(cursor) ?? []));
      cursor = parentOf.get(cursor) ?? null;
    }
    effectiveAttrs[c.id as number] = chain;
  }

  return NextResponse.json({
    categories: categories.data,
    attributes_by_category: effectiveAttrs,
    brands: brands.data,
    currency_rates: Object.fromEntries((rates.data ?? []).map(r => [r.code, Number(r.rate_to_ron)])),
    suppliers: suppliers.data,
  });
}
