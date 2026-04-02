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

async function checkAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const db = makeAdminClient();
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = makeAdminClient();
  const { data, error } = await db.from('suppliers').select('*').eq('id', params.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Furnizorul nu a fost găsit' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, feed_url, format, auth_method, delimiter, api_key, token, customer_id, field_mappings, is_active } = body;

  const db = makeAdminClient();
  const { data: existing } = await db.from('suppliers').select('driver_config').eq('id', params.id).maybeSingle();
  const driver_config = { ...(existing?.driver_config || {}) };

  if (field_mappings !== undefined) driver_config.field_mappings = field_mappings;
  if (delimiter !== undefined) driver_config.csv_delimiter = delimiter;
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

  const { data, error } = await db.from('suppliers').update(updates).eq('id', params.id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Furnizorul nu a fost găsit sau actualizarea a eșuat' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = makeAdminClient();
  const { error } = await db.from('suppliers').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
