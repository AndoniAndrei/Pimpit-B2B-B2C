/**
 * CRUD profiluri de mapare (import engine v2).
 * GET  /api/admin/import-v2/profiles?supplier_id=…  — listă
 * POST /api/admin/import-v2/profiles                — creare profil complet
 *      { supplier_id, category_id, name, feed_id?, notes?,
 *        field_mappings: [{target_kind,target_code,source_expression,transform?,required?,default_value?,position?}],
 *        transform_rules: [{rule_type,config,position?}] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';

const fieldMappingSchema = z.object({
  target_kind: z.enum(['core', 'attribute', 'offer', 'media', 'custom']),
  target_code: z.string().min(1).max(100),
  source_expression: z.string().min(1).max(500),
  transform: z.array(z.record(z.unknown())).default([]),
  required: z.boolean().default(false),
  default_value: z.string().max(500).nullable().optional(),
  position: z.number().int().default(0),
});

const transformRuleSchema = z.object({
  rule_type: z.enum([
    'value_remap', 'brand_normalize', 'unit_convert', 'currency_convert',
    'formula', 'row_filter', 'regex_extract', 'template',
  ]),
  config: z.record(z.unknown()).default({}),
  position: z.number().int().default(0),
});

const createProfileSchema = z.object({
  supplier_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  feed_id: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  field_mappings: z.array(fieldMappingSchema).min(1),
  transform_rules: z.array(transformRuleSchema).default([]),
});

export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();

  const supplierId = req.nextUrl.searchParams.get('supplier_id');
  let query = db
    .from('supplier_mapping_profiles')
    .select('*, supplier_field_mappings(*), supplier_transform_rules(*)')
    .order('id', { ascending: false });
  if (supplierId) query = query.eq('supplier_id', Number(supplierId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = createProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const db = makeAdminClient();

  const { data: profile, error: pErr } = await db
    .from('supplier_mapping_profiles')
    .insert({
      supplier_id: body.supplier_id,
      category_id: body.category_id,
      name: body.name,
      feed_id: body.feed_id ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { error: mErr } = await db.from('supplier_field_mappings').insert(
    body.field_mappings.map(m => ({ ...m, profile_id: profile.id }))
  );
  if (mErr) {
    await db.from('supplier_mapping_profiles').delete().eq('id', profile.id);
    return NextResponse.json({ error: `field_mappings: ${mErr.message}` }, { status: 500 });
  }

  if (body.transform_rules.length) {
    const { error: rErr } = await db.from('supplier_transform_rules').insert(
      body.transform_rules.map(r => ({ ...r, profile_id: profile.id }))
    );
    if (rErr) {
      await db.from('supplier_mapping_profiles').delete().eq('id', profile.id);
      return NextResponse.json({ error: `transform_rules: ${rErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ id: profile.id }, { status: 201 });
}
