-- ============================================================================
-- 020 — vehicle_fitments: eliminăm citirea publică
-- Tabela conține URL-urile sursă ale setup-urilor (date brute de import) și nu
-- trebuie expuse prin API-ul public Supabase (anon key). Paginile publice
-- (/fitment) citesc datele exclusiv server-side cu service role, care nu e
-- afectat de RLS. Adminii păstrează acces de citire.
-- ============================================================================

DROP POLICY IF EXISTS vehicle_fitments_public_read ON vehicle_fitments;

DO $$ BEGIN
  CREATE POLICY vehicle_fitments_admin_read ON vehicle_fitments
    FOR SELECT USING (get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
