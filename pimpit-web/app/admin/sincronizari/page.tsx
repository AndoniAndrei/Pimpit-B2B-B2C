import { createClient } from '@/lib/supabase/server'
import SyncTrigger from './SyncTrigger'

export const revalidate = 0

export default async function SyncLogsPage() {
  const supabase = createClient()
  
  const { data: logs } = await supabase
    .from('sync_logs')
    .select('*, suppliers(name)')
    .order('finished_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Istoric Sincronizări ETL</h1>
        <SyncTrigger />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Furnizor</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Produse</th>
              <th className="px-6 py-3 font-medium">Durată</th>
              <th className="px-6 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map(log => (
              <tr key={log.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 font-medium">{log.suppliers?.name || 'Global'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    log.status === 'success' ? 'bg-green-100 text-green-700' : 
                    log.status === 'running' ? 'bg-blue-100 text-blue-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {log.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">{log.products_fetched}</td>
                <td className="px-6 py-4">{(log.duration_ms / 1000).toFixed(1)}s</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {new Date(log.finished_at).toLocaleString('ro-RO')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
