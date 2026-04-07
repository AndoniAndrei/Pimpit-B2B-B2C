import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parseFeedBuffer, FeedFormat } from '@/lib/feedParser';

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
  const { feed_url, url: urlAlt, format, delimiter, auth_method, api_key, token, customer_id } = body;
  const url = feed_url || urlAlt;

  if (!url) return NextResponse.json({ error: 'URL-ul este obligatoriu' }, { status: 400 });

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,application/json,*/*;q=0.8',
  };
  let fetchUrl = url;

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
    const res = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Feed-ul a returnat ${res.status} ${res.statusText}` }, { status: 422 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const rows = parseFeedBuffer(buffer, (format || 'csv') as FeedFormat, delimiter);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Feed-ul nu conține date sau formatul este greșit' }, { status: 422 });
    }

    const columns = Object.keys(rows[0]);
    return NextResponse.json({ columns, rows: rows.slice(0, 5), totalRows: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
}
