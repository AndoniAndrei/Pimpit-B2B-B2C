import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import VehicleSelector from './VehicleSelector';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ce jante se potrivesc pe mașina ta? | Pimpit',
  description:
    'Vezi setup-uri reale de jante și anvelope montate de alți șoferi pe mașina ta: dimensiuni, offset, anvelope, fără frecări.',
};

function makeClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

interface Fitment {
  front_diameter: number | null;
  front_width: number | null;
  front_offset: number | null;
  rear_diameter: number | null;
  rear_width: number | null;
  rear_offset: number | null;
  is_staggered: boolean;
  front_tire_width: number | null;
  front_tire_aspect: number | null;
  front_tire_diameter: number | null;
  front_tire_raw: string | null;
  rear_tire_raw: string | null;
  rubbing: string | null;
  stance: string | null;
  vehicle: { year: number; trim: string } | null;
}

function topCounts<T>(items: T[], key: (t: T) => string | null, top = 5): [string, number][] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, top);
}

export default async function FitmentPage({ searchParams }: {
  searchParams: { marca?: string; model?: string; an?: string; trim?: string };
}) {
  const db = makeClient();
  const { marca, model, an, trim } = searchParams;

  let results: {
    makeName: string; modelName: string;
    fitments: Fitment[]; totalVehicles: number;
  } | null = null;
  let notFound = false;

  if (marca && model) {
    const { data: makeRow } = await db.from('vehicle_makes').select('id, name').eq('slug', marca).maybeSingle();
    const { data: modelRow } = makeRow
      ? await db.from('vehicle_models').select('id, name').eq('make_id', makeRow.id).eq('slug', model).maybeSingle()
      : { data: null };

    if (makeRow && modelRow) {
      let vq = db.from('vehicles').select('id').eq('model_id', modelRow.id);
      if (an) vq = vq.eq('year', Number(an));
      if (trim) vq = vq.eq('trim', trim);
      const { data: vehicles } = await vq.limit(500);
      const ids = (vehicles ?? []).map(v => v.id);

      let fitments: Fitment[] = [];
      if (ids.length) {
        const { data } = await db
          .from('vehicle_fitments')
          .select('front_diameter, front_width, front_offset, rear_diameter, rear_width, rear_offset, is_staggered, front_tire_width, front_tire_aspect, front_tire_diameter, front_tire_raw, rear_tire_raw, rubbing, stance, vehicle:vehicles(year, trim)')
          .in('vehicle_id', ids)
          .limit(2000);
        fitments = ((data ?? []) as unknown[] as (Omit<Fitment, 'vehicle'> & { vehicle: { year: number; trim: string }[] | { year: number; trim: string } | null })[])
          .map(f => ({ ...f, vehicle: Array.isArray(f.vehicle) ? (f.vehicle[0] ?? null) : f.vehicle }));
      }
      results = { makeName: makeRow.name, modelName: modelRow.name, fitments, totalVehicles: ids.length };
    } else {
      notFound = true;
    }
  }

  const f = results?.fitments ?? [];
  const wheelSetups = topCounts(f, x =>
    x.front_diameter && x.front_width
      ? `${x.front_diameter}" × ${x.front_width}J${x.front_offset != null ? ` ET${x.front_offset}` : ''}`
      : null, 6);
  const diameters = topCounts(f, x => (x.front_diameter ? String(x.front_diameter) : null), 4);
  const tires = topCounts(f, x =>
    x.front_tire_width && x.front_tire_aspect && x.front_tire_diameter
      ? `${x.front_tire_width}/${x.front_tire_aspect}R${x.front_tire_diameter}`
      : null, 6);
  const noRubbing = f.filter(x => (x.rubbing ?? '').toLowerCase().includes('no rubbing')).length;
  const staggered = f.filter(x => x.is_staggered).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-black">Ce se potrivește pe mașina ta?</h1>
        <p className="text-muted-foreground">
          Setup-uri reale montate de alți șoferi — dimensiuni de jante, offset și anvelope
          verificate în practică, nu doar pe hârtie.
        </p>
      </div>

      <div className="rounded-xl border p-4 md:p-6 bg-muted/30">
        <VehicleSelector initial={{ marca, model, an, trim }} />
      </div>

      {notFound && (
        <p className="text-muted-foreground">Nu am găsit vehiculul căutat.</p>
      )}

      {results && (
        <div className="space-y-8">
          <h2 className="text-xl font-bold">
            {results.makeName} {results.modelName}
            {an ? ` (${an})` : ''}{trim ? ` ${trim}` : ''} —{' '}
            {f.length.toLocaleString('ro-RO')} setup-uri reale
          </h2>

          {f.length === 0 ? (
            <p className="text-muted-foreground">
              Încă nu avem setup-uri pentru această selecție. Încearcă fără an/versiune.
            </p>
          ) : (
            <>
              {/* Statistici */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Fără frecări (no rubbing)" value={`${Math.round((noRubbing / f.length) * 100)}%`} />
                <StatCard label="Setup-uri staggered" value={`${Math.round((staggered / f.length) * 100)}%`} />
                <StatCard label="Cel mai popular diametru" value={diameters[0] ? `${diameters[0][0]}"` : '—'} />
                <StatCard label="Cea mai populară anvelopă" value={tires[0]?.[0] ?? '—'} />
              </div>

              {/* Top setup-uri jante */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Dimensiuni de jante populare</h3>
                  <ul className="space-y-2 text-sm">
                    {wheelSetups.map(([setup, n]) => (
                      <li key={setup} className="flex justify-between">
                        <span className="font-mono">{setup}</span>
                        <span className="text-muted-foreground">{n} mașini</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-3">Anvelope populare (față)</h3>
                  <ul className="space-y-2 text-sm">
                    {tires.map(([t, n]) => (
                      <li key={t} className="flex justify-between">
                        <span className="font-mono">{t}</span>
                        <span className="text-muted-foreground">{n} mașini</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* CTA spre catalog */}
              {diameters.length > 0 && (
                <div className="rounded-xl border bg-primary/5 p-6 space-y-3">
                  <h3 className="font-semibold">Găsește jante pentru mașina ta</h3>
                  <div className="flex flex-wrap gap-3">
                    {diameters.map(([d]) => (
                      <Link key={d} href={`/jante?diameter=${d}`}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                        Jante pe {d}" →
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Listă setup-uri */}
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-muted/50">
                      <th className="p-3">An / Versiune</th>
                      <th className="p-3">Jante față</th>
                      <th className="p-3">Jante spate</th>
                      <th className="p-3">Anvelope</th>
                      <th className="p-3">Stance</th>
                      <th className="p-3">Frecări</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.slice(0, 30).map((x, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-3 whitespace-nowrap">
                          {x.vehicle ? `${x.vehicle.year} ${x.vehicle.trim}` : '—'}
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap">
                          {x.front_diameter ? `${x.front_diameter}"×${x.front_width}J ET${x.front_offset ?? '—'}` : '—'}
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap">
                          {x.is_staggered && x.rear_diameter
                            ? `${x.rear_diameter}"×${x.rear_width}J ET${x.rear_offset ?? '—'}`
                            : '='}
                        </td>
                        <td className="p-3 text-xs max-w-56 truncate" title={x.front_tire_raw ?? ''}>
                          {x.front_tire_raw ?? '—'}
                        </td>
                        <td className="p-3">{x.stance ?? '—'}</td>
                        <td className="p-3">
                          {(x.rubbing ?? '').toLowerCase().includes('no rubbing')
                            ? <span className="text-green-600">fără ✓</span>
                            : <span className="text-amber-600">{x.rubbing ?? '?'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {f.length > 30 && (
                  <div className="p-3 text-xs text-muted-foreground">
                    + încă {(f.length - 30).toLocaleString('ro-RO')} setup-uri. Alege anul/versiunea pentru rezultate mai precise.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!results && !notFound && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Alege marca și modelul mașinii tale de mai sus.</p>
          <p className="text-sm mt-2">Avem zeci de mii de setup-uri reale din comunitate.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
