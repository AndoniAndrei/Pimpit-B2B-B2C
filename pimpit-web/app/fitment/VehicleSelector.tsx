'use client';

/**
 * Selector cascadă Marcă → Model → An → Trim.
 * La „Vezi ce se potrivește" navighează la /fitment cu parametrii aleși.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Opt { slug?: string; name?: string; trim?: string; id?: number }

export default function VehicleSelector({ initial }: {
  initial?: { marca?: string; model?: string; an?: string; trim?: string };
}) {
  const router = useRouter();
  const [makes, setMakes] = useState<Opt[]>([]);
  const [models, setModels] = useState<Opt[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [trims, setTrims] = useState<Opt[]>([]);

  const [make, setMake] = useState(initial?.marca ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.an ?? '');
  const [trim, setTrim] = useState(initial?.trim ?? '');
  const [makesLoaded, setMakesLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/vehicles', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setMakes(d.makes ?? []); setMakesLoaded(true); })
      .catch(() => setMakesLoaded(true));
  }, []);

  useEffect(() => {
    setModels([]); setYears([]); setTrims([]);
    if (!make) return;
    fetch(`/api/vehicles?make=${make}`).then(r => r.json()).then(d => setModels(d.models ?? []));
  }, [make]);

  useEffect(() => {
    setYears([]); setTrims([]);
    if (!make || !model) return;
    fetch(`/api/vehicles?make=${make}&model=${model}`).then(r => r.json()).then(d => setYears(d.years ?? []));
  }, [make, model]);

  useEffect(() => {
    setTrims([]);
    if (!make || !model || !year) return;
    fetch(`/api/vehicles?make=${make}&model=${model}&year=${year}`).then(r => r.json()).then(d => setTrims(d.trims ?? []));
  }, [make, model, year]);

  function go() {
    if (!make || !model) return;
    const params = new URLSearchParams({ marca: make, model });
    if (year) params.set('an', year);
    if (trim) params.set('trim', trim);
    router.push(`/fitment?${params.toString()}`);
  }

  const sel = 'border rounded-md px-3 py-2.5 text-sm w-full bg-background disabled:opacity-50';

  if (makesLoaded && makes.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-sm p-4">
        Baza de date de vehicule nu este încă populată. Un administrator trebuie să ruleze
        importul de fitmenturi din <b>Admin → Vehicule → „Importă fitmenturile"</b>, apoi
        selectorul se activează automat.
      </div>
    );
  }

  return (
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
  );
}
