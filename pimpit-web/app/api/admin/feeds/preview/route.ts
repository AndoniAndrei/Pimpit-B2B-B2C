import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  // Auth check
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
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { feed_url, url: urlAlt, format, delimiter, auth_method, api_key, token, customer_id } = body;
  const url = feed_url || urlAlt;

  if (!url) return NextResponse.json({ error: 'URL-ul este obligatoriu' }, { status: 400 });

  // Build headers
  const headers: Record<string, string> = {};
  let fetchUrl = url;

  if (auth_method === 'api_key' && api_key) {
    fetchUrl = fetchUrl.replace('{API_KEY}', api_key);
    if (!fetchUrl.includes(api_key)) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + `api_key=${api_key}`;
    }
  }
  if (token && fetchUrl.includes('{TOKEN}')) {
    fetchUrl = fetchUrl.replace('{TOKEN}', token);
  }
  if (auth_method === 'basic_auth' && customer_id && token) {
    const b64 = Buffer.from(`${customer_id}:${token}`).toString('base64');
    headers['Authorization'] = `Basic ${b64}`;
  }

  try {
    const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Feed-ul a returnat ${res.status} ${res.statusText}` }, { status: 422 });
    }

    const text = await res.text();
    let rows: Record<string, any>[] = [];

    if (format === 'json') {
      const json = JSON.parse(text);
      rows = Array.isArray(json) ? json : (Object.values(json).find(Array.isArray) as any[]) || [];
    } else {
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter || ',',
        preview: 10,
      });
      rows = parsed.data;
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Feed-ul nu conține date sau formatul este greșit' }, { status: 422 });
    }

    const columns = Object.keys(rows[0]);
    const previewRows = rows.slice(0, 5);

    return NextResponse.json({ columns, rows: previewRows, totalRows: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
