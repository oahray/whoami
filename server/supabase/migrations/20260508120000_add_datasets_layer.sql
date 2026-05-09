-- Datasets layer: introduce datasets as owners of entities.
-- Adds a `datasets` table, scopes entities by `dataset_id`, and adds `aliases`
-- on entities for guess-matching support.
--
-- Following the `admin_users` convention: this migration only sets up schema.
-- Initial content (the first dataset and any backfill of existing entities) is
-- handled by `server/src/scripts/createDefaultDataset.ts` so production data
-- is created intentionally rather than implicitly through migrations.

-- 1. datasets table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT,
  description TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case-insensitive uniqueness on name (storage stays raw; the index normalises).
CREATE UNIQUE INDEX IF NOT EXISTS datasets_name_unique_ci
  ON public.datasets ((lower(name)));

-- updated_at trigger uses the shared function defined in the initial migration.
DROP TRIGGER IF EXISTS update_datasets_updated_at ON public.datasets;
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. entities: dataset_id + aliases -------------------------------------------
-- dataset_id stays nullable in the schema; application code is responsible for
-- supplying it on every insert. The bootstrap script backfills any pre-existing
-- rows so they are usable. A future migration can promote dataset_id to NOT NULL
-- once all environments have been backfilled.
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES public.datasets(id) ON DELETE RESTRICT;

ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

-- 3. Uniqueness rules ---------------------------------------------------------
-- Names are unique per dataset, case-insensitive. Same name can appear in
-- different datasets (e.g. "Peter" in Bible vs another dataset).
CREATE UNIQUE INDEX IF NOT EXISTS entities_dataset_name_unique
  ON public.entities (dataset_id, lower(name));

-- 4. Helpful index for dataset-scoped queries ---------------------------------
CREATE INDEX IF NOT EXISTS idx_entities_dataset
  ON public.entities (dataset_id);

-- 5. RLS lockdown to match the rest of the schema ------------------------------
ALTER TABLE public.datasets
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;

-- No policies: only the backend (service_role) can read/write.
