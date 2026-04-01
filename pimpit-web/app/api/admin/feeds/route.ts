import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, slug, feed_url, format, auth_method, is_active, driver_config, last_sync_at, last_product_count')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, feed_url, format, auth_method, delimiter, api_key, token, customer_id, field_mappings } = body;

  if (!name || !feed_url || !field_mappings) {
    return NextResponse.json({ error: 'Câmpurile obligatorii lipsesc' }, { status: 400 });
  }

  // Get next available ID
  const { data: maxRow } = await supabase.from('suppliers').select('id').order('id', { ascending: false }).limit(1).single();
  const nextId = ((maxRow?.id as number) || 0) + 1;

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  const driver_config: Record<string, any> = { field_mappings };
  if (delimiter) driver_config.csv_delimiter = delimiter;
  if (api_key) driver_config.api_key = api_key;
  if (token) driver_config.token = token;
  if (customer_id) driver_config.customer_id = customer_id;

  const { data, error } = await supabase.from('suppliers').insert({
    id: nextId,
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
