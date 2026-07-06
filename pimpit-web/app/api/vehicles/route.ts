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
      return NextResponse.json({ makes: data }, { headers: cacheHeaders });
    }

    const { data: makeRow } = await db.from('vehicle_makes').select('id').eq('slug', make).maybeSingle();
    if (!makeRow) return NextResponse.json({ error: 'Marcă necunoscută' }, { status: 404 });

    if (!model) {
      const { data, error } = await db.from('vehicle_models')
        .select('slug, name').eq('make_id', makeRow.id).order('name');
      if (error) throw error;
      return NextResponse.json({ models: data }, { headers: cacheHeaders });
    }

    const { data: modelRow } = await db.from('vehicle_models')
      .select('id').eq('make_id', makeRow.id).eq('slug', model).maybeSingle();
    if (!modelRow) return NextResponse.json({ error: 'Model necunoscut' }, { status: 404 });

    if (!year) {
      const { data, error } = await db.from('vehicles')
        .select('year').eq('model_id', modelRow.id).order('year', { ascending: false });
      if (error) throw error;
      const years = Array.from(new Set((data ?? []).map(v => v.year)));
      return NextResponse.json({ years }, { headers: cacheHeaders });
    }

    const { data, error } = await db.from('vehicles')
      .select('id, trim').eq('model_id', modelRow.id).eq('year', Number(year)).order('trim');
    if (error) throw error;
    return NextResponse.json(
      { trims: (data ?? []).map(v => ({ id: v.id, trim: v.trim || 'Standard' })) },
      { headers: cacheHeaders }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
