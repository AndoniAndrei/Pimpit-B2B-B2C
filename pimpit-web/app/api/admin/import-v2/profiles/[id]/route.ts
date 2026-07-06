/**
 * Profil de mapare individual.
 * GET    — profil + mappings + rules
 * PATCH  — actualizează metadatele și/sau înlocuiește integral mappings/rules
 *          (înlocuire completă = versiune simplă de editare; istoricul rămâne
 *          prin coloana version — incrementată la fiecare înlocuire)
 * DELETE — șterge profilul (cascade pe mappings/rules)
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();
  const { data, error } = await db
    .from('supplier_mapping_profiles')
    .select('*, supplier_field_mappings(*), supplier_transform_rules(*)')
    .eq('id', Number(params.id))
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json();
  const db = makeAdminClient();

  const meta: Record<string, unknown> = {};
  for (const k of ['name', 'category_id', 'feed_id', 'notes', 'is_active'] as const) {
    if (body[k] !== undefined) meta[k] = body[k];
  }

  if (Array.isArray(body.field_mappings)) {
    await db.from('supplier_field_mappings').delete().eq('profile_id', id);
    const { error } = await db.from('supplier_field_mappings').insert(
      body.field_mappings.map((m: Record<string, unknown>) => ({ ...m, profile_id: id }))
    );
    if (error) return NextResponse.json({ error: `field_mappings: ${error.message}` }, { status: 500 });
    const { data: current } = await db.from('supplier_mapping_profiles').select('version').eq('id', id).maybeSingle();
    meta.version = ((current?.version as number) ?? 1) + 1;
  }

  if (Array.isArray(body.transform_rules)) {
    await db.from('supplier_transform_rules').delete().eq('profile_id', id);
    if (body.transform_rules.length) {
      const { error } = await db.from('supplier_transform_rules').insert(
        body.transform_rules.map((r: Record<string, unknown>) => ({ ...r, profile_id: id }))
      );
      if (error) return NextResponse.json({ error: `transform_rules: ${error.message}` }, { status: 500 });
    }
  }

  if (Object.keys(meta).length) {
    const { error } = await db.from('supplier_mapping_profiles').update(meta).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();
  const { error } = await db.from('supplier_mapping_profiles').delete().eq('id', Number(params.id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
