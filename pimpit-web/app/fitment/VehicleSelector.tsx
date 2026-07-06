'use client';

/**
 * Selector cascadă Marcă → Model → An → Trim (stil Fitment Industries).
 * La „Vezi ce se potrivește" navighează la /fitment cu parametrii aleși.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Opt { slug?: string; name?: string; trim?: string; id?: number }
interface VehicleResponse {
  makes?: Opt[];
  models?: Opt[];
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
  const [models, setModels] = useState<Opt[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [trims, setTrims] = useState<Opt[]>([]);
  const [makesLoaded, setMakesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [make, setMake] = useState(initial?.marca ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.an ?? '');
  const [trim, setTrim] = useState(initial?.trim ?? '');

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

  useEffect(() => {
    setModels([]); setYears([]); setTrims([]);
    if (!make) return;
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams({ make });
    fetchVehicles(`/api/vehicles?${params.toString()}`)
      .then(d => { if (!cancelled) setModels(d.models ?? []); })
      .catch(e => {
        if (!cancelled) {
          setModels([]);
          setError(`Nu am putut incarca modelele: ${errorMessage(e)}`);
        }
      });
    return () => { cancelled = true; };
  }, [make]);

  useEffect(() => {
    setYears([]); setTrims([]);
    if (!make || !model) return;
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams({ make, model });
    fetchVehicles(`/api/vehicles?${params.toString()}`)
      .then(d => { if (!cancelled) setYears(d.years ?? []); })
      .catch(e => {
        if (!cancelled) {
          setYears([]);
          setError(`Nu am putut incarca anii: ${errorMessage(e)}`);
        }
      });
    return () => { cancelled = true; };
  }, [make, model]);

  useEffect(() => {
    setTrims([]);
    if (!make || !model || !year) return;
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams({ make, model, year });
    fetchVehicles(`/api/vehicles?${params.toString()}`)
      .then(d => { if (!cancelled) setTrims(d.trims ?? []); })
      .catch(e => {
        if (!cancelled) {
          setTrims([]);
          setError(`Nu am putut incarca versiunile: ${errorMessage(e)}`);
        }
      });
    return () => { cancelled = true; };
  }, [make, model, year]);

  function go() {
    if (!make || !model) return;
    const params = new URLSearchParams({ marca: make, model });
    if (year) params.set('an', year);
    if (trim) params.set('trim', trim);
    router.push(`/fitment?${params.toString()}`);
  }

  const sel = 'border rounded-md px-3 py-2.5 text-sm w-full bg-background disabled:opacity-50';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <select className={sel} value={make} onChange={e => { setMake(e.target.value); setModel(''); setYear(''); setTrim(''); }}>
        <option value="">Marca</option>
        {makes.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
      </select>
      <select className={sel} value={model} disabled={!make}
        onChange={e => { setModel(e.target.value); setYear(''); setTrim(''); }}>
        <option value="">Modelul</option>
        {models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
      </select>
      <select className={sel} value={year} disabled={!model}
        onChange={e => { setYear(e.target.value); setTrim(''); }}>
        <option value="">Anul (opțional)</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className={sel} value={trim} disabled={!year} onChange={e => setTrim(e.target.value)}>
        <option value="">Versiunea (opțional)</option>
        {trims.map(t => <option key={t.trim} value={t.trim}>{t.trim}</option>)}
      </select>
      <button onClick={go} disabled={!make || !model}
        className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 disabled:opacity-50">
        Vezi ce se potrivește
      </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && makesLoaded && makes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nu exista marci de vehicule in baza de date. Verifica importul din /admin/vehicule.
        </p>
      )}
    </div>
  );
}
