'use client';

/**
 * Selector cascadă: Marcă → An fabricație → Model (familie cu șasiu afișat,
 * ex. „Seria 5 — E60/E61") → Motorizarea (opțional, ex. 530i) → Versiunea.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Opt { slug?: string; name?: string; trim?: string; id?: number }
interface GenInfo { code: string; pcd?: string }
interface FamilyGroup { key: string; label: string; generation: GenInfo | null; models: Opt[] }
interface Groups { families: FamilyGroup[]; singles: (Opt & { generation: GenInfo | null })[] }
interface VehicleResponse {
  makes?: Opt[];
  groups?: Groups;
  years?: number[];
  trims?: Opt[];
  error?: string;
}

async function fetchVehicles(url: string): Promise<VehicleResponse> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({})) as VehicleResponse;
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function VehicleSelector({ initial }: {
  initial?: { marca?: string; model?: string; an?: string; trim?: string };
}) {
  const router = useRouter();
  const [makes, setMakes] = useState<Opt[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [groups, setGroups] = useState<Groups | null>(null);
  const [trims, setTrims] = useState<Opt[]>([]);
  const [makesLoaded, setMakesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [make, setMake] = useState(initial?.marca ?? '');
  const [year, setYear] = useState(initial?.an ?? '');
  const [model, setModel] = useState(initial?.model ?? '');   // fam-… sau slug simplu
  const [engine, setEngine] = useState('');                   // motorizarea (slug model comercial)
  const [trim, setTrim] = useState(initial?.trim ?? '');

  // 1) Mărci
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setMakesLoaded(false);
    fetchVehicles('/api/vehicles')
      .then(d => { if (!cancelled) setMakes(d.makes ?? []); })
      .catch(e => {
        if (!cancelled) {
          setMakes([]);
          setError(`Nu am putut incarca marcile: ${errorMessage(e)}`);
        }
      })
      .finally(() => { if (!cancelled) setMakesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // 2) Anii mărcii
  useEffect(() => {
    setYears([]); setGroups(null); setTrims([]);
    if (!make) return;
    let cancelled = false;
    setError(null);
    fetchVehicles(`/api/vehicles?${new URLSearchParams({ make })}`)
      .then(d => { if (!cancelled) setYears(d.years ?? []); })
      .catch(e => { if (!cancelled) { setYears([]); setError(`Nu am putut incarca anii: ${errorMessage(e)}`); } });
    return () => { cancelled = true; };
  }, [make]);

  // 3) Modelele (grupate pe familii) din anul ales
  useEffect(() => {
    setGroups(null); setTrims([]);
    if (!make || !year) return;
    let cancelled = false;
    setError(null);
    fetchVehicles(`/api/vehicles?${new URLSearchParams({ make, year })}`)
      .then(d => { if (!cancelled) setGroups(d.groups ?? { families: [], singles: [] }); })
      .catch(e => { if (!cancelled) { setGroups(null); setError(`Nu am putut incarca modelele: ${errorMessage(e)}`); } });
    return () => { cancelled = true; };
  }, [make, year]);

  // 4) Versiunile pentru selecția curentă (motorizarea, dacă e aleasă)
  useEffect(() => {
    setTrims([]);
    if (!make || !year || !model) return;
    let cancelled = false;
    setError(null);
    fetchVehicles(`/api/vehicles?${new URLSearchParams({ make, year, model: engine || model })}`)
      .then(d => { if (!cancelled) setTrims(d.trims ?? []); })
      .catch(e => { if (!cancelled) { setTrims([]); setError(`Nu am putut incarca versiunile: ${errorMessage(e)}`); } });
    return () => { cancelled = true; };
  }, [make, year, model, engine]);

  const selectedFamily = model.startsWith('fam-')
    ? groups?.families.find(f => f.key === model) ?? null
    : null;
  const showEngine = !!selectedFamily && selectedFamily.models.length > 1;

  function go() {
    if (!make || !year || !model) return;
    const params = new URLSearchParams({ marca: make, model: engine || model, an: year });
    if (trim) params.set('trim', trim);
    router.push(`/fitment?${params.toString()}`);
  }

  const sel = 'border rounded-md px-3 py-2.5 text-sm w-full bg-background disabled:opacity-50';

  return (
    <div className="space-y-2">
      <div className={`grid grid-cols-2 ${showEngine ? 'md:grid-cols-6' : 'md:grid-cols-5'} gap-3`}>
        <select className={sel} value={make}
          onChange={e => { setMake(e.target.value); setYear(''); setModel(''); setEngine(''); setTrim(''); }}>
          <option value="">Marca</option>
          {makes.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>

        <select className={sel} value={year} disabled={!make}
          onChange={e => { setYear(e.target.value); setModel(''); setEngine(''); setTrim(''); }}>
          <option value="">Anul fabricației</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className={sel} value={model} disabled={!year}
          onChange={e => { setModel(e.target.value); setEngine(''); setTrim(''); }}>
          <option value="">Modelul</option>
          {groups?.families.map(f => (
            <option key={f.key} value={f.key}>
              {f.label}{f.generation ? ` — ${f.generation.code}` : ''}
            </option>
          ))}
          {groups?.singles.map(m => (
            <option key={m.slug} value={m.slug}>
              {m.name}{m.generation ? ` — ${m.generation.code}` : ''}
            </option>
          ))}
        </select>

        {showEngine && (
          <select className={sel} value={engine} onChange={e => { setEngine(e.target.value); setTrim(''); }}>
            <option value="">Toate motorizările</option>
            {selectedFamily!.models.map(m => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
        )}

        <select className={sel} value={trim} disabled={!model} onChange={e => setTrim(e.target.value)}>
          <option value="">Versiunea (opțional)</option>
          {trims.map(t => <option key={t.trim} value={t.trim}>{t.trim}</option>)}
        </select>

        <button onClick={go} disabled={!make || !year || !model}
          className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 disabled:opacity-50">
          Vezi ce se potrivește
        </button>
      </div>

      {selectedFamily?.generation?.pcd && (
        <p className="text-xs text-muted-foreground">
          {selectedFamily.label} {selectedFamily.generation.code} — prindere {selectedFamily.generation.pcd.replace('X', 'x')}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && makesLoaded && makes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nu exista marci de vehicule in baza de date. Verifica importul din /admin/vehicule.
        </p>
      )}
    </div>
  );
}
