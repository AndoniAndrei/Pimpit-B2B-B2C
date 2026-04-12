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
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
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
  const { name, feed_url, format, auth_method, delimiter, api_key, token, customer_id, field_mappings,
    secondary_feed_url, secondary_feed_format, secondary_feed_delimiter, secondary_join_key, primary_join_key,
    image_api_url_template,
    driver, statusfalgar_base_url, statusfalgar_include_alloy_rims, statusfalgar_include_steel_rims, statusfalgar_include_accessories,
  } = body;

  if (!name || (!feed_url && driver !== 'statusfalgar')) {
    return NextResponse.json({ error: 'Câmpurile obligatorii lipsesc' }, { status: 400 });
  }

  const db = makeAdminClient();

  // suppliers.id is SMALLINT with no sequence — must assign manually
  const { data: maxRow } = await db
    .from('suppliers')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextId = ((maxRow?.id as number) || 0) + 1;

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  const driver_config: Record<string, any> = {};
  if (field_mappings) driver_config.field_mappings = field_mappings;
  if (delimiter) driver_config.csv_delimiter = delimiter;
  if (api_key) driver_config.api_key = api_key;
  if (token) driver_config.token = token;
  if (customer_id) driver_config.customer_id = customer_id;
  if (secondary_feed_url) driver_config.secondary_feed_url = secondary_feed_url;
  if (secondary_feed_format) driver_config.secondary_feed_format = secondary_feed_format;
  if (secondary_feed_delimiter) driver_config.secondary_feed_delimiter = secondary_feed_delimiter;
  if (secondary_join_key) driver_config.secondary_join_key = secondary_join_key;
  if (primary_join_key) driver_config.primary_join_key = primary_join_key;
  if (image_api_url_template) driver_config.image_api_url_template = image_api_url_template;
  if (driver) driver_config.driver = driver;
  if (statusfalgar_base_url) driver_config.statusfalgar_base_url = statusfalgar_base_url;
  if (statusfalgar_include_alloy_rims !== undefined) driver_config.statusfalgar_include_alloy_rims = statusfalgar_include_alloy_rims;
  if (statusfalgar_include_steel_rims !== undefined) driver_config.statusfalgar_include_steel_rims = statusfalgar_include_steel_rims;
  if (statusfalgar_include_accessories !== undefined) driver_config.statusfalgar_include_accessories = statusfalgar_include_accessories;

  const { data, error } = await db.from('suppliers').insert({
    id: nextId,
    name,
    slug,
    feed_url,
    format: format || 'csv',
    auth_method: auth_method || 'none',
    csv_delimiter: delimiter || ',',
    driver_config,
    is_active: true,
  }).select().maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Inserarea a eșuat — verifică constrângerile tabelului' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
