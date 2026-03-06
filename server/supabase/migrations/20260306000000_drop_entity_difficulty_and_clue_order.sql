-- Remove entity.difficulty and clue.order to reduce confusion

-- Entities: drop index that includes difficulty, then drop column
DROP INDEX IF EXISTS idx_entities_published;
ALTER TABLE public.entities DROP COLUMN IF EXISTS difficulty;

-- Recreate index on is_published only (for filtering published entities)
CREATE INDEX IF NOT EXISTS idx_entities_published ON public.entities(is_published);

-- Clues: drop unique constraint and index that use "order", then drop column
ALTER TABLE public.clues DROP CONSTRAINT IF EXISTS clues_entity_id_order_key;
DROP INDEX IF EXISTS idx_clues_entity;
ALTER TABLE public.clues DROP COLUMN IF EXISTS "order";

-- Order clues by created_at for consistent display
CREATE INDEX IF NOT EXISTS idx_clues_entity_created ON public.clues(entity_id, created_at);
