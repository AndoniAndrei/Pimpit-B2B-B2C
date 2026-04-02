import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function checkAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = makeAdminClient();
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user.id;
}

export async function GET() {
  const userId = await checkAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = makeAdminClient();
  const { data, error } = await db
    .from('suppliers')
    .select('id, name, slug, feed_url, format, auth_method, is_active, driver_config, last_sync_at, last_product_count')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await checkAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, feed_url, format, auth_method, delimiter, api_key, token, customer_id, field_mappings } = body;

  if (!name || !feed_url) {
    return NextResponse.json({ error: 'Câmpurile obligatorii lipsesc' }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const driver_config: Record<string, any> = {};
  if (field_mappings) driver_config.field_mappings = field_mappings;
  if (delimiter) driver_config.csv_delimiter = delimiter;
  if (api_key) driver_config.api_key = api_key;
  if (token) driver_config.token = token;
  if (customer_id) driver_config.customer_id = customer_id;

  const db = makeAdminClient();
  const { data, error } = await db.from('suppliers').insert({
    name,
    slug,
    feed_url,
    format: format || 'csv',
    auth_method: auth_method || 'none',
    csv_delimiter: delimiter || ',',
    driver_config,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
