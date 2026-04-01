import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function checkAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return supabase;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase.from('suppliers').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, feed_url, format, auth_method, delimiter, api_key, token, customer_id, field_mappings, is_active } = body;

  const { data: existing } = await supabase.from('suppliers').select('driver_config').eq('id', params.id).single();
  const driver_config = { ...(existing?.driver_config || {}) };

  if (field_mappings !== undefined) driver_config.field_mappings = field_mappings;
  if (delimiter) driver_config.csv_delimiter = delimiter;
  if (api_key !== undefined) driver_config.api_key = api_key;
  if (token !== undefined) driver_config.token = token;
  if (customer_id !== undefined) driver_config.customer_id = customer_id;

  const updates: Record<string, any> = { driver_config };
  if (name) updates.name = name;
  if (feed_url) updates.feed_url = feed_url;
  if (format) updates.format = format;
  if (auth_method) updates.auth_method = auth_method;
  if (delimiter) updates.csv_delimiter = delimiter;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase.from('suppliers').update(updates).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase.from('suppliers').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
