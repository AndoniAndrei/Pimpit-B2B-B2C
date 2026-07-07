/**
 * API public pentru selectorul de vehicul.
 * Cascadă: Marcă → An fabricație → Model → Versiune.
 *   GET /api/vehicles                                → mărci
 *   GET /api/vehicles?make=bmw                       → ani (toți anii mărcii)
 *   GET /api/vehicles?make=bmw&year=2008             → modele disponibile în acel an
 *   GET /api/vehicles?make=bmw&year=2008&model=e60   → versiuni (trims)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getModelAlias } from '@/lib/fitment/vehicleAliases';
import { groupModels, resolveModelParam } from '@/lib/fitment/modelFamilies';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }

  return createServerClient(
    url,
    key,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const cacheHeaders = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const make = sp.get('make');
  const model = sp.get('model');
  const year = sp.get('year');

  try {
    const db = makeClient();

    if (!make) {
      const { data, error } = await db.from('vehicle_makes')
        .select('slug, name').eq('is_active', true).order('name');
      if (error) throw error;
      return NextResponse.json({ makes: data ?? [] }, { headers: cacheHeaders });
    }

    const { data: makeRow } = await db.from('vehicle_makes').select('id').eq('slug', make).maybeSingle();
    if (!makeRow) return NextResponse.json({ error: 'Marcă necunoscută' }, { status: 404 });

    // Toate modelele mărcii — folosite de toate ramurile de mai jos
    const { data: allModels, error: mErr } = await db.from('vehicle_models')
      .select('id, slug, name').eq('make_id', makeRow.id);
    if (mErr) throw mErr;
    const allModelIds = (allModels ?? []).map(m => m.id);
    if (!allModelIds.length) return NextResponse.json({ years: [], models: [] }, { headers: cacheHeaders });

    // ── Pasul 2: anii de fabricație ai mărcii ────────────────────────────────
    if (!year && !model) {
      const { data, error } = await db.from('vehicles')
        .select('year')
        .in('model_id', allModelIds)
        .order('year', { ascending: false });
      if (error) throw error;
      const years = Array.from(new Set((data ?? []).map(v => v.year)));
      return NextResponse.json({ years }, { headers: cacheHeaders });
    }

    // ── Pasul 3: modelele disponibile în anul ales ───────────────────────────
    if (year && !model) {
      const y = Number(year);
      const { data, error } = await db.from('vehicles')
        .select('model_id')
        .in('model_id', allModelIds)
        .eq('year', y);
      if (error) throw error;
      const presentIds = new Set((data ?? []).map(v => v.model_id));
      const presentModels = (allModels ?? [])
        .filter(m => presentIds.has(m.id))
        .map(m => ({ slug: m.slug as string, name: m.name as string }));

      // Grupare pe familii (Seria 5, Clasa C…) cu generația/șasiul rezolvat pe an
      const groups = groupModels(make, presentModels, y);
      return NextResponse.json({ groups }, { headers: cacheHeaders });
    }

    // ── Pasul 4: versiunile (trims) pentru model (+ an, dacă e ales) ─────────
    const alias = getModelAlias(make, model!);
    let modelIds: number[] = [];
    if (model!.startsWith('fam-')) {
      const fam = resolveModelParam(make, model!, (allModels ?? []) as { slug: string; name: string }[]);
      if (fam) {
        const famSlugs = new Set(fam.slugs);
        modelIds = (allModels ?? []).filter(m => famSlugs.has(m.slug as string)).map(m => m.id);
      }
    } else if (alias) {
      modelIds = (allModels ?? [])
        .filter(m => alias.modelSlugs.includes(m.slug))
        .map(m => m.id);
    } else {
      const row = (allModels ?? []).find(m => m.slug === model);
      if (row) modelIds = [row.id];
    }
    if (!modelIds.length) return NextResponse.json({ error: 'Model necunoscut' }, { status: 404 });

    let q = db.from('vehicles')
      .select('id, trim')
      .in('model_id', modelIds)
      .order('trim');
    if (year) q = q.eq('year', Number(year));
    if (alias?.yearFrom) q = q.gte('year', alias.yearFrom);
    if (alias?.yearTo) q = q.lte('year', alias.yearTo);
    const { data, error } = await q;
    if (error) throw error;
    const trimsByName = new Map<string, { id: number; trim: string }>();
    for (const v of data ?? []) {
      const label = v.trim || 'Standard';
      if (!trimsByName.has(label)) trimsByName.set(label, { id: v.id, trim: label });
    }
    return NextResponse.json(
      { trims: Array.from(trimsByName.values()) },
      { headers: cacheHeaders }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
