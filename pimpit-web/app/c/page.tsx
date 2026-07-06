import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';

export const revalidate = 3600;

export const metadata = {
  title: 'Categorii | Pimpit',
  description: 'Jante, anvelope, suspensii, iluminat, frâne și accesorii auto premium.',
};

function makeClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function CategoriesPage() {
  const db = makeClient();
  const { data: categories } = await db
    .from('categories')
    .select('id, parent_id, slug, name, position')
    .eq('is_active', true)
    .order('position');

  const roots = (categories ?? []).filter(c => !c.parent_id);
  const childrenOf = (id: number) => (categories ?? []).filter(c => c.parent_id === id);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black">Categorii</h1>
        <p className="text-muted-foreground mt-1">Tot ce ai nevoie pentru mașina ta, de la jante la body kit.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roots.map(root => (
          <div key={root.id} className="rounded-xl border p-5 space-y-2 hover:shadow-md transition-shadow">
            <Link href={`/c/${root.slug}`} className="font-bold text-lg hover:text-primary">
              {root.name} →
            </Link>
            {childrenOf(root.id).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {childrenOf(root.id).map(ch => (
                  <Link key={ch.id} href={`/c/${ch.slug}`}
                    className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors">
                    {ch.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
