import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ImportActions from './ImportActions';

export const revalidate = 0;

export default async function ImporturiPage() {
  const supabase = createClient();

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, feed_url, format, is_active, driver_config, last_sync_at, last_product_count')
    .order('id');

  const { data: recentLogs } = await supabase
    .from('sync_logs')
    .select('supplier_id, status, products_fetched, products_inserted, duration_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const lastLogBySupplier = new Map<number, any>();
  for (const log of recentLogs || []) {
    if (!lastLogBySupplier.has(log.supplier_id)) {
      lastLogBySupplier.set(log.supplier_id, log);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Surse de produse</h1>
          <p className="text-muted-foreground mt-1">Gestionează feed-urile și importă produse</p>
        </div>
        <Link
          href="/admin/importuri/nou"
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm self-start sm:self-auto shrink-0"
        >
          + Adaugă sursă nouă
        </Link>
      </div>

      <div className="grid gap-4">
        {suppliers?.length === 0 && (
          <div className="bg-card border rounded-xl p-12 text-center">
            <p className="text-muted-foreground mb-4">Nu există surse configurate.</p>
            <Link href="/admin/importuri/nou" className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold">
              Adaugă prima sursă
            </Link>
          </div>
        )}

        {suppliers?.map(supplier => {
          const lastLog = lastLogBySupplier.get(supplier.id);
          const hasMappings = !!supplier.driver_config?.field_mappings;

          return (
            <div key={supplier.id} className="bg-card border rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-bold text-lg">{supplier.name}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {supplier.is_active ? 'ACTIV' : 'INACTIV'}
                    </span>
                    {!hasMappings && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        NECONFIGURAT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{supplier.feed_url}</p>

                  {lastLog && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className={`font-medium ${lastLog.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {lastLog.status === 'success' ? '✓' : '✗'} {lastLog.status}
                      </span>
                      <span>{lastLog.products_inserted?.toLocaleString() || 0} produse importate</span>
                      <span>{new Date(lastLog.created_at).toLocaleString('ro-RO')}</span>
                    </div>
                  )}

                  {!lastLog && (
                    <p className="text-xs text-muted-foreground mt-2">Nu a fost rulat niciodată</p>
                  )}
                </div>

                <ImportActions supplierId={supplier.id} hasMappings={hasMappings} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
