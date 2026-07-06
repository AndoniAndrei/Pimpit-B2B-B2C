/**
 * Catalog V2 — pagină generică de categorie, condusă de category_filter_definitions.
 * Un singur cod pentru toate categoriile (jante, anvelope, suspensii, …).
 *
 * MVP: familiile + variantele se încarcă (cap 500 familii) și fațetele/filtrarea
 * se aplică în server component. La volume mari se mută într-un RPC fațetat —
 * notat în APP_STATE §7.9.
 */
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

function makeClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const PAGE_SIZE = 24;

interface Variant {
  id: string;
  price: number | null;
  stock: number;
  attrs: Record<string, unknown>;
}

interface Family {
  id: string;
  slug: string;
  name: string;
  brand: { name: string } | { name: string }[] | null;
  variants: Variant[];
}

interface FilterDef {
  position: number;
  widget: string;
  attribute: {
    code: string;
    label: string;
    unit: string | null;
    data_type: string;
  } | null;
}

function brandName(f: Family): string {
  const b = Array.isArray(f.brand) ? f.brand[0] : f.brand;
  return b?.name ?? '';
}

/** Valoarea unui atribut ca listă de string-uri comparabile. */
function attrValues(v: Variant, code: string): string[] {
  const raw = v.attrs?.[code];
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'object') return []; // range — nefiltrabil în MVP
  return [String(raw)];
}

export default async function CategoryPage({ params, searchParams }: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const db = makeClient();

  const { data: category } = await db
    .from('categories')
    .select('id, name, description, parent_id')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!category) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-2xl font-bold">Categorie inexistentă</h1>
        <Link className="text-primary underline" href="/c">Vezi toate categoriile</Link>
      </div>
    );
  }

  // Categoria + copiii ei
  const { data: children } = await db
    .from('categories').select('id').eq('parent_id', category.id).eq('is_active', true);
  const catIds = [category.id, ...(children ?? []).map(c => c.id)];

  // Fațetele configurate (categoria + părintele, pentru moștenire)
  const filterCatIds = category.parent_id ? [...catIds, category.parent_id] : catIds;
  const { data: filterDefs } = await db
    .from('category_filter_definitions')
    .select('position, widget, attribute:category_attribute_definitions(code, label, unit, data_type)')
    .in('category_id', filterCatIds)
    .eq('is_active', true)
    .order('position');

  // Familiile + variantele active
  const { data: familiesRaw } = await db
    .from('catalog_products')
    .select('id, slug, name, brand:brands(name), variants:product_variants(id, price, stock, attrs)')
    .in('category_id', catIds)
    .eq('is_active', true)
    .limit(500);

  let families = ((familiesRaw ?? []) as unknown as Family[])
    .map(f => ({ ...f, variants: (f.variants ?? []).filter(v => v.price != null && v.price > 0) }))
    .filter(f => f.variants.length > 0);

  // Filtre active din URL: ?f_diameter_inch=19&f_diameter_inch=20&brand=…
  const activeFilters: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(searchParams)) {
    if (!key.startsWith('f_') || !val) continue;
    activeFilters[key.slice(2)] = Array.isArray(val) ? val : [val];
  }
  const brandFilter = searchParams.brand
    ? (Array.isArray(searchParams.brand) ? searchParams.brand : [searchParams.brand])
    : [];

  // Fațete: valori distincte + contoare (din TOATE familiile, înainte de filtrare)
  const dedupedDefs = new Map<string, FilterDef>();
  for (const fd of (filterDefs ?? []) as unknown as FilterDef[]) {
    const attr = Array.isArray(fd.attribute) ? (fd.attribute as unknown[])[0] as FilterDef['attribute'] : fd.attribute;
    if (attr && !dedupedDefs.has(attr.code)) dedupedDefs.set(attr.code, { ...fd, attribute: attr });
  }
  const facets = Array.from(dedupedDefs.values())
    .filter(fd => fd.attribute && fd.attribute.data_type !== 'range')
    .map(fd => {
      const counts = new Map<string, number>();
      for (const fam of families) {
        const seen = new Set<string>();
        for (const v of fam.variants) {
          for (const val of attrValues(v, fd.attribute!.code)) seen.add(val);
        }
        for (const val of Array.from(seen)) counts.set(val, (counts.get(val) ?? 0) + 1);
      }
      const options = Array.from(counts.entries())
        .sort((a, b) => {
          const na = parseFloat(a[0]); const nb = parseFloat(b[0]);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a[0].localeCompare(b[0]);
        });
      return { code: fd.attribute!.code, label: fd.attribute!.label, unit: fd.attribute!.unit, options };
    })
    .filter(f => f.options.length > 1);

  const brandFacet = (() => {
    const counts = new Map<string, number>();
    for (const fam of families) {
      const b = brandName(fam);
      if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  // Aplică filtrele: o familie rămâne dacă are ≥1 variantă care satisface TOATE filtrele
  if (Object.keys(activeFilters).length || brandFilter.length) {
    families = families.filter(fam => {
      if (brandFilter.length && !brandFilter.includes(brandName(fam))) return false;
      return fam.variants.some(v =>
        Object.entries(activeFilters).every(([code, wanted]) =>
          attrValues(v, code).some(val => wanted.includes(val))
        )
      );
    });
  }

  // Sortare + paginare
  const sort = String(searchParams.sort ?? 'stock');
  const minPrice = (f: Family) => Math.min(...f.variants.map(v => v.price ?? Infinity));
  const totalStock = (f: Family) => f.variants.reduce((a, v) => a + v.stock, 0);
  families.sort((a, b) =>
    sort === 'price_asc' ? minPrice(a) - minPrice(b) :
    sort === 'price_desc' ? minPrice(b) - minPrice(a) :
    totalStock(b) - totalStock(a)
  );
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const totalPages = Math.max(1, Math.ceil(families.length / PAGE_SIZE));
  const pageFamilies = families.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Imagini: primul asset per familie
  const famIds = pageFamilies.map(f => f.id);
  const { data: media } = famIds.length
    ? await db.from('media_assets').select('product_id, url, position')
        .in('product_id', famIds).eq('kind', 'image').order('position')
    : { data: [] };
  const imageOf = new Map<string, string>();
  for (const m of media ?? []) {
    if (m.product_id && !imageOf.has(m.product_id)) imageOf.set(m.product_id, m.url);
  }

  // Helper URL pentru toggle de filtre
  const buildUrl = (patch: Record<string, string[] | string | null>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined || k === 'page') continue;
      for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
    }
    for (const [k, v] of Object.entries(patch)) {
      sp.delete(k);
      if (v === null) continue;
      for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
    }
    const qs = sp.toString();
    return `/c/${params.slug}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="text-sm text-muted-foreground"><Link href="/c" className="hover:underline">Categorii</Link> / {category.name}</div>
        <h1 className="text-3xl font-black mt-1">{category.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {families.length.toLocaleString('ro-RO')} produse
          {families.length === 0 && ' — catalogul acestei categorii se populează prin Import V2'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        {/* Fațete */}
        <aside className="space-y-6">
          {brandFacet.length > 1 && (
            <FacetBlock title="Brand">
              {brandFacet.map(([val, n]) => {
                const active = brandFilter.includes(val);
                return (
                  <FacetLink key={val} href={buildUrl({ brand: active ? brandFilter.filter(x => x !== val) : [...brandFilter, val] })}
                    active={active} label={val} count={n} />
                );
              })}
            </FacetBlock>
          )}
          {facets.map(f => {
            const current = activeFilters[f.code] ?? [];
            return (
              <FacetBlock key={f.code} title={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}>
                {f.options.slice(0, 14).map(([val, n]) => {
                  const active = current.includes(val);
                  return (
                    <FacetLink key={val}
                      href={buildUrl({ [`f_${f.code}`]: active ? current.filter(x => x !== val) : [...current, val] })}
                      active={active} label={val} count={n} />
                  );
                })}
              </FacetBlock>
            );
          })}
        </aside>

        {/* Grid produse */}
        <div className="space-y-6">
          <div className="flex justify-end gap-2 text-sm">
            {[['stock', 'Stoc'], ['price_asc', 'Preț ↑'], ['price_desc', 'Preț ↓']].map(([key, label]) => (
              <Link key={key} href={buildUrl({ sort: key })}
                className={`px-3 py-1.5 rounded-md border ${sort === key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                {label}
              </Link>
            ))}
          </div>

          {pageFamilies.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              Niciun produs în această categorie{Object.keys(activeFilters).length ? ' cu filtrele alese' : ' încă'}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageFamilies.map(f => {
                const prices = f.variants.map(v => v.price!).sort((a, b) => a - b);
                const inStock = f.variants.some(v => v.stock > 0);
                const img = imageOf.get(f.id);
                return (
                  <Link key={f.id} href={`/p/${f.slug}`}
                    className="rounded-xl border overflow-hidden hover:shadow-md transition-shadow bg-background">
                    <div className="aspect-square bg-muted/40 relative">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={f.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">fără imagine</div>
                      )}
                    </div>
                    <div className="p-4 space-y-1">
                      <div className="text-xs text-muted-foreground">{brandName(f)}</div>
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {f.variants.length === 1 ? '1 variantă' : `${f.variants.length} variante`}
                        {' · '}
                        <span className={inStock ? 'text-green-600' : 'text-red-500'}>
                          {inStock ? 'în stoc' : 'stoc epuizat'}
                        </span>
                      </div>
                      <div className="font-bold">
                        {prices[0] === prices[prices.length - 1]
                          ? `${prices[0].toLocaleString('ro-RO')} lei`
                          : `de la ${prices[0].toLocaleString('ro-RO')} lei`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 text-sm">
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 10).map(p => (
                <Link key={p} href={buildUrl({ page: String(p) })}
                  className={`px-3 py-1.5 rounded-md border ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FacetBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FacetLink({ href, active, label, count }: {
  href: string; active: boolean; label: string; count: number;
}) {
  return (
    <Link href={href} className={`flex justify-between text-sm px-2 py-1 rounded-md ${
      active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
    }`}>
      <span>{active ? '✓ ' : ''}{label}</span>
      <span className="text-muted-foreground">{count}</span>
    </Link>
  );
}
