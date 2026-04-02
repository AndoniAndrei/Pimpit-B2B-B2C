import { createServerClient } from '@supabase/ssr';
import { notFound } from 'next/navigation';
import ImportWizard from '@/components/admin/ImportWizard';

export default async function EditFeedPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!supplier) notFound();

  const dc = supplier.driver_config || {};
  const initialConfig = {
    name: supplier.name,
    feed_url: supplier.feed_url,
    format: supplier.format,
    delimiter: dc.csv_delimiter || supplier.csv_delimiter || ',',
    auth_method: supplier.auth_method,
    api_key: dc.api_key || '',
    token: dc.token || '',
    customer_id: dc.customer_id || '',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Editează sursă: {supplier.name}</h1>
        <p className="text-muted-foreground mt-1">Modifică configurația sau remapează câmpurile.</p>
      </div>
      <ImportWizard
        supplierId={supplier.id}
        initialConfig={initialConfig}
        initialMappings={dc.field_mappings}
      />
    </div>
  );
}
