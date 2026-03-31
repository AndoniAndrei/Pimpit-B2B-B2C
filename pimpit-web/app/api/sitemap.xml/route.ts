import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pimpit.ro'

  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('is_active', true)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${siteUrl}</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${siteUrl}/jante</loc>
        <changefreq>hourly</changefreq>
        <priority>0.9</priority>
      </url>
      ${products?.map(p => `
        <url>
          <loc>${siteUrl}/jante/${p.slug}</loc>
          <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.8</priority>
        </url>
      `).join('')}
    </urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=86400, stale-while-revalidate'
    }
  })
}
