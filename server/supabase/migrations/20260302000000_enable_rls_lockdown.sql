-- Enable Row Level Security so only the backend (service_role)
-- and database superusers can access these tables.

ALTER TABLE public.entities
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;

ALTER TABLE public.clues
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;

ALTER TABLE public.admin_users
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;

-- No policies are defined for anon/authenticated roles.
-- With RLS enabled and no policies, calls made with the anon key
-- cannot read or write these tables. The Supabase service_role key,
-- which the backend uses, bypasses RLS and continues to work normally.

