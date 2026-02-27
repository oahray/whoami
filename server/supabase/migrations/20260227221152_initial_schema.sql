-- WhoAmI Database Schema
-- Initial migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Entities table
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('character', 'place')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'nightmare')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clues table
CREATE TABLE IF NOT EXISTS clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  text TEXT NOT NULL,
  citations TEXT, -- Display-only Bible citations (e.g., "Exodus 2: 1; 3: 1 - 5, 21:1, 2.")
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'nightmare')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, "order")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entities_published ON entities(is_published, difficulty);
CREATE INDEX IF NOT EXISTS idx_clues_entity ON clues(entity_id, "order");

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clues_updated_at BEFORE UPDATE ON clues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Supabase Auth is handled separately
-- Admins will be added directly to auth.users table
-- You can create a custom function to check admin status if needed
