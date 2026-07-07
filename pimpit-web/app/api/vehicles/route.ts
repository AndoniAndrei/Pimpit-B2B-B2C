/**
 * API public pentru selectorul de vehicul (cascade Marcă → Model → An → Trim).
 * GET /api/vehicles                          → mărci
 * GET /api/vehicles?make=bmw                 → modele
 * GET /api/vehicles?make=bmw&model=seria-3   → ani
 * GET /api/vehicles?make=bmw&model=seria-3&year=2020 → trims
 * Cache 1h (datele se schimbă doar la re-import).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const revalidate = 3600;

function makeClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Cache DOAR răspunsurile cu date — o listă goală (înainte de importul
// fitmenturilor) nu trebuie să rămână blocată în CDN o oră.
function withCache(payload: Record<string, unknown[]>): NextResponse {
  const hasData = Object.values(payload).some(arr => arr.length > 0);
  return NextResponse.json(payload, hasData
    ? { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    : { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const db = makeClient();
  const sp = req.nextUrl.searchParams;
  const make = sp.get('make');
  const model = sp.get('model');
  const year = sp.get('year');

  try {
    if (!make) {
      const { data, error } = await db.from('vehicle_makes')
        .select('slug, name').eq('is_active', true).order('name');
      if (error) throw error;
      return withCache({ makes: data ?? [] });
    }

    const { data: makeRow } = await db.from('vehicle_makes').select('id').eq('slug', make).maybeSingle();
    if (!makeRow) return NextResponse.json({ error: 'Marcă necunoscută' }, { status: 404 });

    if (!model) {
      const { data, error } = await db.from('vehicle_models')
        .select('slug, name').eq('make_id', makeRow.id).order('name');
      if (error) throw error;
      return withCache({ models: data ?? [] });
    }

    const { data: modelRow } = await db.from('vehicle_models')
      .select('id').eq('make_id', makeRow.id).eq('slug', model).maybeSingle();
    if (!modelRow) return NextResponse.json({ error: 'Model necunoscut' }, { status: 404 });

    if (!year) {
      const { data, error } = await db.from('vehicles')
        .select('year').eq('model_id', modelRow.id).order('year', { ascending: false });
      if (error) throw error;
      const years = Array.from(new Set((data ?? []).map(v => v.year)));
      return withCache({ years });
    }

    const { data, error } = await db.from('vehicles')
      .select('id, trim').eq('model_id', modelRow.id).eq('year', Number(year)).order('trim');
    if (error) throw error;
    return withCache({ trims: (data ?? []).map(v => ({ id: v.id, trim: v.trim || 'Standard' })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
