import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@/lib/supabase/server';
import { runImport } from '@/lib/importRunner';

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

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await runImport(Number(params.id));
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
