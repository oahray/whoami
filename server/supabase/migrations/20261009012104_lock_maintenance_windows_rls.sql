-- Lock maintenance_windows the same way as the other tables.
-- No policies: the anon and authenticated keys cannot read or write.
-- The backend service_role key bypasses RLS and keeps working.

ALTER TABLE public.maintenance_windows
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;
