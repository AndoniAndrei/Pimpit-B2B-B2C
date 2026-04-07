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

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const format = (formData.get('format') as string) || 'csv';
  const delimiter = (formData.get('delimiter') as string) || ',';

  if (!file) return NextResponse.json({ error: 'Fișierul lipsește' }, { status: 400 });

  const text = await file.text();
  let rows: Record<string, any>[] = [];

  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: `Eroare la parsarea fișierului: ${e.message}` }, { status: 422 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Fișierul nu conține date sau formatul este greșit' }, { status: 422 });
  }

  const columns = Object.keys(rows[0]);
  return NextResponse.json({ columns, rows: rows.slice(0, 5), totalRows: rows.length });
}
