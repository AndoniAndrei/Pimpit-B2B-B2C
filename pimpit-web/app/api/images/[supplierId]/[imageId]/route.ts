import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Proxy pentru imaginile furnizorilor cu API REST autentificat (ex: Statusfalgar).
 * Citește config-ul furnizorului din DB, adaugă Basic Auth și streamează imaginea.
 * Cache 1h în browser + CDN.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { supplierId: string; imageId: string } }
) {
  const { supplierId, imageId } = params;

  if (!supplierId || !imageId) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Load supplier config (service role — no auth check needed for public images)
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: supplier } = await db
    .from('suppliers')
    .select('auth_method, driver_config')
    .eq('id', supplierId)
    .maybeSingle();

  const dc = supplier?.driver_config || {};
  const urlTemplate: string = dc.image_api_url_template || '';

  if (!urlTemplate) {
    return new NextResponse('No image API configured for this supplier', { status: 404 });
  }

  const imageUrl = urlTemplate
    .replace('{id}', imageId)
    .replace('{Id}', imageId)
    .replace('{ID}', imageId);

  // Build auth header
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (supplier?.auth_method === 'basic_auth') {
    const user = dc.customer_id || '';
    const pass = dc.token || '';
    if (user && pass) {
      headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    }
  }

  try {
    const res = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const data = await res.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Length': String(data.byteLength),
      },
    });
  } catch (e: any) {
    return new NextResponse(`Fetch error: ${e.message}`, { status: 502 });
  }
}
