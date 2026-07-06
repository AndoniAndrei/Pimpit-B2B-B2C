/**
 * Catalog V2 — pagina unei familii de produs (ex. modelul de jantă "JR11"):
 * o singură pagină, tabel cu toate variantele (mărimi/finisaje) și add-to-cart
 * per variantă. Stil CARiD: produs = familie, opțiunile = variante.
 */
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import VariantTable from './VariantTable';

export const dynamic = 'force-dynamic';

function makeClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function ProductFamilyPage({ params }: { params: { slug: string } }) {
  const db = makeClient();

  const { data: family } = await db
    .from('catalog_products')
    .select('id, name, description, category_id, brand:brands(name, slug), category:categories(name, slug, parent_id)')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!family) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-2xl font-bold">Produs inexistent</h1>
        <Link className="text-primary underline" href="/c">Vezi categoriile</Link>
      </div>
    );
  }

  const brand = Array.isArray(family.brand) ? family.brand[0] : family.brand;
  const category = Array.isArray(family.category) ? family.category[0] : family.category;

  const [{ data: variants }, { data: media }, { data: defs }] = await Promise.all([
    db.from('product_variants')
      .select('id, part_number, name_suffix, price, price_old, stock, stock_incoming, attrs')
      .eq('product_id', family.id)
      .eq('is_active', true)
      .order('price'),
    db.from('media_assets')
      .select('url, variant_id, position')
      .eq('kind', 'image')
      .eq('product_id', family.id)
      .order('position')
      .limit(12),
    db.from('category_attribute_definitions')
      .select('code, label, unit, data_type, position, category_id')
      .in('category_id', [family.category_id, ...(category?.parent_id ? [category.parent_id] : [])])
      .order('position'),
  ]);

  const images = Array.from(new Set((media ?? []).map(m => m.url)));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="text-sm text-muted-foreground">
        <Link href="/c" className="hover:underline">Categorii</Link>
        {category && <> / <Link href={`/c/${category.slug}`} className="hover:underline">{category.name}</Link></>}
        {' / '}{family.name}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Galerie */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl border bg-muted/40 relative overflow-hidden">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt={family.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">fără imagine</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.slice(1, 6).map(url => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="aspect-square rounded-lg border object-cover" />
              ))}
            </div>
          )}
        </div>

        {/* Informații */}
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">{brand?.name}</div>
            <h1 className="text-3xl font-black">{family.name}</h1>
          </div>
          {family.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{family.description}</p>
          )}
          <div className="text-sm text-muted-foreground">
            {(variants ?? []).length} {(variants ?? []).length === 1 ? 'variantă disponibilă' : 'variante disponibile'} —
            alege mărimea/versiunea din tabelul de mai jos.
          </div>
        </div>
      </div>

      {/* Tabel variante + add to cart */}
      <VariantTable
        variants={(variants ?? []) as never[]}
        attributeDefs={(defs ?? []) as never[]}
      />
    </div>
  );
}
