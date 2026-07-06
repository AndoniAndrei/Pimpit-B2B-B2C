/**
 * CRUD minimal pentru supplier_feeds (mai multe feed-uri per furnizor).
 * GET  /api/admin/import-v2/feeds?supplier_id=…
 * POST /api/admin/import-v2/feeds { supplier_id, name, feed_url?, format?, auth_method?, csv_delimiter?, config? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdmin, makeAdminClient } from '@/lib/adminAuth';

const createFeedSchema = z.object({
  supplier_id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  feed_url: z.string().url().max(1000).nullable().optional(),
  format: z.enum(['csv', 'json', 'xml', 'xlsx']).default('csv'),
  auth_method: z.enum(['none', 'api_key', 'basic_auth', 'oauth']).default('none'),
  csv_delimiter: z.string().max(5).optional(),
  config: z.record(z.unknown()).default({}),
  schedule_cron: z.string().max(100).nullable().optional(),
});

export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = makeAdminClient();
  const supplierId = req.nextUrl.searchParams.get('supplier_id');
  let query = db.from('supplier_feeds').select('*').order('id');
  if (supplierId) query = query.eq('supplier_id', Number(supplierId));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = createFeedSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Date invalide', details: parsed.error.flatten() }, { status: 400 });
  }
  const db = makeAdminClient();
  const { data, error } = await db.from('supplier_feeds').insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
