import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { feed_url, format, delimiter, auth_method, api_key, token, customer_id, column } = body;

  if (!feed_url) return NextResponse.json({ error: 'URL-ul este obligatoriu' }, { status: 400 });
  if (!column)   return NextResponse.json({ error: 'Coloana este obligatorie' }, { status: 400 });

  // Build fetch URL + headers (same auth logic as preview endpoint)
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,application/json,*/*;q=0.8',
  };
  let fetchUrl = feed_url;

  if (auth_method === 'api_key' && api_key) {
    fetchUrl = fetchUrl.replace('{API_KEY}', api_key);
    if (!fetchUrl.includes(api_key)) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + `api_key=${api_key}`;
    }
  }
  if (token && fetchUrl.includes('{TOKEN}')) fetchUrl = fetchUrl.replace('{TOKEN}', token);
  if (auth_method === 'basic_auth' && customer_id && token) {
    headers['Authorization'] = `Basic ${Buffer.from(`${customer_id}:${token}`).toString('base64')}`;
  }

  try {
    const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Feed-ul a returnat ${res.status} ${res.statusText}` }, { status: 422 });
    }

    const text = await res.text();
    const seen = new Set<string>();

    if (format === 'json') {
      const json = JSON.parse(text);
      const rows: any[] = Array.isArray(json) ? json : (Object.values(json).find(Array.isArray) as any[]) || [];
      for (const row of rows) {
        const val = row[column];
        if (val !== undefined && val !== null && String(val).trim()) {
          seen.add(String(val).trim());
        }
      }
    } else {
      // Stream-parse CSV without loading all rows into memory
      Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter || ',',
        step: (result) => {
          const val = result.data[column];
          if (val !== undefined && val !== null && String(val).trim()) {
            seen.add(String(val).trim());
          }
        },
      });
    }

    const values = Array.from(seen).sort((a, b) => a.localeCompare(b, 'ro'));
    return NextResponse.json({ values, total: values.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
