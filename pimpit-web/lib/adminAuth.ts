/**
 * Helper partajat pentru rutele admin (folosit de API-urile import-v2).
 * Rutele v1 își păstrează copiile locale; la un refactor viitor se mută aici.
 */
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export function makeAdminClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  ) as unknown as SupabaseClient;
}

/** Returnează user id-ul dacă utilizatorul curent e admin, altfel null. */
export async function checkAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = makeAdminClient();
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return null;
  return user.id;
}
