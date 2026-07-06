import { createServerClient } from '@supabase/ssr';
import FitmentImportClient from './FitmentImportClient';

export const dynamic = 'force-dynamic';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function VehiculePage() {
  const db = makeAdminClient();

  const [makes, models, vehicles, fitments] = await Promise.all([
    db.from('vehicle_makes').select('id', { count: 'exact', head: true }),
    db.from('vehicle_models').select('id', { count: 'exact', head: true }),
    db.from('vehicles').select('id', { count: 'exact', head: true }),
    db.from('vehicle_fitments').select('id', { count: 'exact', head: true }),
  ]);

  const counts = {
    makes: makes.count ?? 0,
    models: models.count ?? 0,
    vehicles: vehicles.count ?? 0,
    fitments: fitments.count ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vehicule & Fitment</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Baza de date de vehicule și setup-uri reale (galeria Fitment Industries).
          Alimentează selectorul An/Marcă/Model și recomandările „ce se potrivește pe mașina mea”.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Mărci', value: counts.makes },
          { label: 'Modele', value: counts.models },
          { label: 'Vehicule (an/model/trim)', value: counts.vehicles },
          { label: 'Fitmenturi', value: counts.fitments },
        ].map(s => (
          <div key={s.label} className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{s.value.toLocaleString('ro-RO')}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <FitmentImportClient hasData={counts.fitments > 0} />
    </div>
  );
}
