/**
 * Sursă de date pentru wizard-ul de mapare: coloane + rânduri de probă.
 *
 * Două moduri:
 *  1. multipart/form-data cu `file` — fișier urcat manual. Se salvează în
 *     Storage (feed-snapshots/uploads/…) ca snapshot re-folosibil de job,
 *     apoi se parsează și se întorc coloanele + primele rânduri.
 *  2. JSON { feed_id } — descarcă feed-ul configurat (cu auth-ul furnizorului)
 *     și întoarce coloanele + primele rânduri, fără a salva snapshot.
 *
 * Răspuns: { snapshot_path?, format, delimiter, columns[], sample_rows[], row_count }
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';
import { parseFeedBuffer } from '@/lib/feedParser';
import { detectFormatFromName, detectCsvDelimiter } from '@/lib/import/detect';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SAMPLE_ROWS = 20;

function sampleResponse(
  buffer: Buffer,
  format: 'csv' | 'json' | 'xlsx',
  extra: Record<string, unknown> = {}
) {
  let delimiter = ',';
  if (format === 'csv') {
    delimiter = detectCsvDelimiter(buffer.subarray(0, 64 * 1024).toString('utf-8'));
  }
  const rows = parseFeedBuffer(buffer, format, delimiter);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Fișierul nu conține rânduri sau formatul e greșit.' }, { status: 400 });
  }
  const columns = Object.keys(rows[0]);
  return NextResponse.json({
    format,
    delimiter,
    columns,
    sample_rows: rows.slice(0, SAMPLE_ROWS),
    row_count: rows.length,
    ...extra,
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();

  const contentType = req.headers.get('content-type') ?? '';

  // ── Mod 1: fișier urcat ───────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Lipsește fișierul (câmpul "file")' }, { status: 400 });
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fișier prea mare (max 100MB)' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const format = detectFormatFromName(file.name);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const snapshotPath = `uploads/${Date.now()}-${safeName}`;
    const { error: upErr } = await db.storage
      .from('feed-snapshots')
      .upload(snapshotPath, buffer, { contentType: 'application/octet-stream', upsert: true });
    if (upErr) {
      return NextResponse.json({ error: `Salvarea fișierului a eșuat: ${upErr.message}` }, { status: 500 });
    }

    try {
      return sampleResponse(buffer, format, { snapshot_path: snapshotPath });
    } catch (e) {
      return NextResponse.json(
        { error: `Parsarea a eșuat: ${e instanceof Error ? e.message : e}` },
        { status: 400 }
      );
    }
  }

  // ── Mod 2: feed configurat ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const feedId = Number(body?.feed_id);
  if (!Number.isFinite(feedId)) {
    return NextResponse.json({ error: 'Trimite feed_id sau un fișier multipart' }, { status: 400 });
  }

  const { data: feed } = await db
    .from('supplier_feeds')
    .select('supplier_id, feed_url, format, auth_method, csv_delimiter')
    .eq('id', feedId)
    .maybeSingle();
  if (!feed?.feed_url) {
    return NextResponse.json({ error: `Feed #${feedId} inexistent sau fără URL` }, { status: 404 });
  }

  const { data: supplier } = await db
    .from('suppliers')
    .select('auth_method, api_key_ref, token_ref, customer_id_ref, driver_config')
    .eq('id', feed.supplier_id)
    .maybeSingle();

  // Fetch cu aceeași semantică de auth ca pipeline-ul
  let url = feed.feed_url as string;
  const dc = (supplier?.driver_config ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  const apiKey = (supplier?.api_key_ref ? process.env[supplier.api_key_ref as string] : null) || dc.api_key || '';
  const token = (supplier?.token_ref ? process.env[supplier.token_ref as string] : null) || dc.token || '';
  if (apiKey && url.includes('{API_KEY}')) url = url.replace('{API_KEY}', apiKey);
  if (token && url.includes('{TOKEN}')) url = url.replace('{TOKEN}', token);
  if (feed.auth_method === 'basic_auth') {
    const user = (supplier?.customer_id_ref ? process.env[supplier.customer_id_ref as string] : null) || dc.customer_id || '';
    if (user && token) headers['Authorization'] = `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ error: `Feed HTTP ${res.status} ${res.statusText}` }, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const format = (feed.format as 'csv' | 'json' | 'xlsx') || detectFormatFromName(url);
    return sampleResponse(buffer, format === ('xml' as never) ? 'csv' : format);
  } catch (e) {
    return NextResponse.json(
      { error: `Descărcarea a eșuat: ${e instanceof Error ? e.message : e}` },
      { status: 502 }
    );
  }
}
