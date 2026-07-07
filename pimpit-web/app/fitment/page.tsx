import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import VehicleSelector from './VehicleSelector';
import { getModelAlias } from '@/lib/fitment/vehicleAliases';
import { resolveGeneration } from '@/lib/fitment/vehicleGenerations';

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
  rear_tire_width: number | null;
  rear_tire_aspect: number | null;
  rear_tire_diameter: number | null;
  front_tire_raw: string | null;
  rear_tire_raw: string | null;
  rubbing: string | null;
  trimming: string | null;
  spacers_front: string | null;
  spacers_rear: string | null;
  stance: string | null;
  vehicle: { year: number; trim: string; model: { name: string } | null } | null;
}

interface WheelSetup {
  diameter: number;
  width: number;
  offset: number | null;
  count: number;
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

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.0$/, '');
}

function wheelLabel(setup: Pick<WheelSetup, 'diameter' | 'width' | 'offset'>): string {
  return `${fmtNumber(setup.diameter)}" x ${fmtNumber(setup.width)}J${
    setup.offset != null ? ` ET${fmtNumber(setup.offset)}` : ''
  }`;
}

function addWheelSetup(
  counts: Map<string, WheelSetup>,
  diameter: number | null,
  width: number | null,
  offset: number | null
) {
  if (!diameter || !width) return;
  const key = `${diameter}|${width}|${offset ?? ''}`;
  const current = counts.get(key);
  if (current) current.count += 1;
  else counts.set(key, { diameter, width, offset, count: 1 });
}

function topWheelSetups(items: Fitment[], top = 6): WheelSetup[] {
  const counts = new Map<string, WheelSetup>();
  for (const item of items) {
    addWheelSetup(counts, item.front_diameter, item.front_width, item.front_offset);
    if (item.is_staggered) addWheelSetup(counts, item.rear_diameter, item.rear_width, item.rear_offset);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, top);
}

function catalogHrefForSetup(setup: WheelSetup, pcds: string[]): string {
  const params = new URLSearchParams();
  params.set('diameter', String(setup.diameter));
  params.set('width', String(setup.width));
  if (setup.offset != null) {
    const center = Math.round(setup.offset);
    for (let et = center - 5; et <= center + 5; et += 1) {
      params.append('et', String(et));
    }
  }
  for (const pcd of pcds) params.append('pcd', pcd);
  return `/jante?${params.toString()}`;
}

function modificationSummary(fitment: Fitment): string {
  const parts = [
    fitment.trimming,
    fitment.spacers_front ? `dist. fata ${fitment.spacers_front}` : null,
    fitment.spacers_rear ? `dist. spate ${fitment.spacers_rear}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export default async function FitmentPage({ searchParams }: {
  searchParams: { marca?: string; model?: string; an?: string; trim?: string };
}) {
  const db = makeClient();
  const { marca, model, an, trim } = searchParams;

  let results: {
    makeName: string; modelName: string;
    fitments: Fitment[]; totalVehicles: number; pcds: string[];
  } | null = null;
  let notFound = false;

  if (marca && model) {
    const { data: makeRow } = await db.from('vehicle_makes').select('id, name').eq('slug', marca).maybeSingle();
    const alias = marca && model ? getModelAlias(marca, model) : null;

    if (makeRow) {
      let modelName = '';
      let modelIds: number[] = [];
      let pcds: string[] = [];

      if (alias) {
        const { data: modelRows } = await db.from('vehicle_models')
          .select('id')
          .eq('make_id', makeRow.id)
          .in('slug', alias.modelSlugs);
        modelIds = (modelRows ?? []).map(row => row.id);
        modelName = alias.name;
        pcds = alias.pcds ?? [];
      } else {
        const { data: modelRow } = await db.from('vehicle_models')
          .select('id, name')
          .eq('make_id', makeRow.id)
          .eq('slug', model)
          .maybeSingle();
        if (modelRow) {
          modelIds = [modelRow.id];
          modelName = modelRow.name;
        }
      }

      if (!modelIds.length) {
        notFound = true;
      } else {
        let vq = db.from('vehicles').select('id').in('model_id', modelIds);
        if (alias?.yearFrom) vq = vq.gte('year', alias.yearFrom);
        if (alias?.yearTo) vq = vq.lte('year', alias.yearTo);
        if (an) vq = vq.eq('year', Number(an));
        if (trim) vq = vq.eq('trim', trim);
        const { data: vehicles } = await vq.limit(500);
        const ids = (vehicles ?? []).map(v => v.id);

        let fitments: Fitment[] = [];
        if (ids.length) {
          const { data } = await db
            .from('vehicle_fitments')
            .select('front_diameter, front_width, front_offset, rear_diameter, rear_width, rear_offset, is_staggered, front_tire_width, front_tire_aspect, front_tire_diameter, rear_tire_width, rear_tire_aspect, rear_tire_diameter, front_tire_raw, rear_tire_raw, rubbing, trimming, spacers_front, spacers_rear, stance, vehicle:vehicles(year, trim, model:vehicle_models(name))')
            .in('vehicle_id', ids)
            .limit(2000);
          fitments = ((data ?? []) as unknown[] as (Omit<Fitment, 'vehicle'> & {
            vehicle: (
              { year: number; trim: string; model: { name: string }[] | { name: string } | null }[] |
              { year: number; trim: string; model: { name: string }[] | { name: string } | null } |
              null
            );
          })[]).map(f => {
            const vehicle = Array.isArray(f.vehicle) ? (f.vehicle[0] ?? null) : f.vehicle;
            const modelRel = Array.isArray(vehicle?.model) ? (vehicle.model[0] ?? null) : (vehicle?.model ?? null);
            return { ...f, vehicle: vehicle ? { ...vehicle, model: modelRel } : null };
          });
        }
        results = { makeName: makeRow.name, modelName, fitments, totalVehicles: ids.length, pcds };
      }
    } else {
      notFound = true;
    }
  }

  const f = results?.fitments ?? [];
  const wheelSetups = topWheelSetups(f, 6);
  const diameters = topCounts(f, x => (x.front_diameter ? String(x.front_diameter) : null), 4);
  const tires = topCounts(f, x =>
    x.front_tire_width && x.front_tire_aspect && x.front_tire_diameter
      ? `${x.front_tire_width}/${x.front_tire_aspect}R${x.front_tire_diameter}`
      : null, 6);
  const noRubbing = f.filter(x => (x.rubbing ?? '').toLowerCase().includes('no rubbing')).length;
  const staggered = f.filter(x => x.is_staggered).length;

  // Generația (șasiul) rezolvată din (marcă, model, an) — protecție împotriva
  // amestecului de generații cu prinderi diferite sub același nume comercial
  const generation = marca && model && an
    ? resolveGeneration(marca, model, Number(an))
    : null;
  const effectivePcds = results?.pcds.length
    ? results.pcds
    : (generation?.pcd ? [generation.pcd] : []);
  // Interval de ani acoperit de rezultate — pentru avertismentul „fără an"
  const resultYears = f.map(x => x.vehicle?.year).filter((y): y is number => !!y);
  const yearSpread = resultYears.length
    ? Math.max(...resultYears) - Math.min(...resultYears)
    : 0;

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
          <div className="space-y-2">
            <h2 className="text-xl font-bold">
              {results.makeName} {results.modelName}
              {an ? ` (${an})` : ''}{trim ? ` ${trim}` : ''} —{' '}
              {f.length.toLocaleString('ro-RO')} setup-uri reale
            </h2>

            {/* Badge de generație — cheia împotriva confuziei între șasiuri */}
            {generation && (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                <span className="font-semibold">
                  Generația: {generation.code} ({generation.yearFrom}–{generation.yearTo ?? 'prezent'})
                </span>
                {generation.pcd && <span className="font-mono">· Prindere {generation.pcd.replace('X', 'x')}</span>}
                {generation.centerBore && <span className="font-mono">· Alezaj {generation.centerBore}mm</span>}
              </div>
            )}
            {generation?.note && (
              <p className="text-sm text-amber-700">⚠ {generation.note}</p>
            )}

            {/* Fără an ales → rezultatele pot amesteca generații */}
            {!an && f.length > 0 && yearSpread >= 8 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3">
                <b>Atenție:</b> rezultatele acoperă anii {Math.min(...resultYears)}–{Math.max(...resultYears)},
                adică mai multe generații care pot avea prinderi (PCD) diferite.
                Alege <b>anul fabricației</b> din selector ca să vezi doar setup-urile
                generației mașinii tale.
              </div>
            )}
          </div>

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
                    {wheelSetups.map(setup => (
                      <li key={`${setup.diameter}-${setup.width}-${setup.offset ?? 'x'}`} className="flex justify-between gap-3">
                        <span className="font-mono">{wheelLabel(setup)}</span>
                        <span className="text-muted-foreground">{setup.count} mașini</span>
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
              {wheelSetups.length > 0 && (
                <div className="rounded-xl border bg-primary/5 p-6 space-y-3">
                  <h3 className="font-semibold">Găsește jante pentru mașina ta</h3>
                  <p className="text-sm text-muted-foreground">
                    Linkurile de mai jos filtrează catalogul după diametru, lățime și ET apropiat de setup-urile reale
                    {effectivePcds.length ? ` și după PCD ${effectivePcds.join(', ')}` : ''}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {wheelSetups.map(setup => (
                      <Link key={`${setup.diameter}-${setup.width}-${setup.offset ?? 'x'}`}
                        href={catalogHrefForSetup(setup, effectivePcds)}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                        Jante {wheelLabel(setup)} →
                      </Link>
                    ))}
                  </div>
                  {!effectivePcds.length && (
                    <p className="text-xs text-muted-foreground">
                      Nu avem încă PCD OEM pentru această selecție, deci verifică prinderea înainte de comandă.
                    </p>
                  )}
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
                      <th className="p-3">Modificări</th>
                      <th className="p-3">Stance</th>
                      <th className="p-3">Frecări</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.slice(0, 30).map((x, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-3 whitespace-nowrap">
                          {x.vehicle
                            ? `${x.vehicle.year} ${x.vehicle.model?.name ? `${x.vehicle.model.name} ` : ''}${x.vehicle.trim}`
                            : '—'}
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap">
                          {x.front_diameter && x.front_width ? wheelLabel({
                            diameter: x.front_diameter,
                            width: x.front_width,
                            offset: x.front_offset,
                          }) : '—'}
                        </td>
                        <td className="p-3 font-mono whitespace-nowrap">
                          {x.is_staggered && x.rear_diameter && x.rear_width
                            ? wheelLabel({
                                diameter: x.rear_diameter,
                                width: x.rear_width,
                                offset: x.rear_offset,
                              })
                            : '='}
                        </td>
                        <td className="p-3 text-xs max-w-72">
                          <div className="truncate" title={x.front_tire_raw ?? ''}>
                            față: {x.front_tire_raw ?? '—'}
                          </div>
                          {x.rear_tire_raw && x.rear_tire_raw !== x.front_tire_raw && (
                            <div className="truncate" title={x.rear_tire_raw}>
                              spate: {x.rear_tire_raw}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-xs max-w-52">{modificationSummary(x)}</td>
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
