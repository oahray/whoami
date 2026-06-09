-- Maintenance windows: global player-facing freeze before content work.
-- Optional dataset_id scopes which dataset may be purged during the active phase.

CREATE TABLE IF NOT EXISTS public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  admin_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_ends_at
  ON public.maintenance_windows (ends_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_starts_at
  ON public.maintenance_windows (starts_at);
