-- One row per closed UTC day. Each column is a total, not an event.

CREATE TABLE IF NOT EXISTS public.play_count_days (
  day DATE PRIMARY KEY,
  multiplayer_rooms_created INTEGER NOT NULL DEFAULT 0,
  multiplayer_games_started INTEGER NOT NULL DEFAULT 0,
  multiplayer_games_completed INTEGER NOT NULL DEFAULT 0,
  multiplayer_abandoned_before_start INTEGER NOT NULL DEFAULT 0,
  multiplayer_player_connections INTEGER NOT NULL DEFAULT 0,
  solo_classic_started INTEGER NOT NULL DEFAULT 0,
  solo_classic_completed INTEGER NOT NULL DEFAULT 0,
  solo_daily_started INTEGER NOT NULL DEFAULT 0,
  solo_daily_completed INTEGER NOT NULL DEFAULT 0,
  solo_endurance_started INTEGER NOT NULL DEFAULT 0,
  solo_endurance_completed INTEGER NOT NULL DEFAULT 0,
  solo_review_started INTEGER NOT NULL DEFAULT 0,
  solo_review_completed INTEGER NOT NULL DEFAULT 0,
  CHECK (
    multiplayer_rooms_created >= 0
    AND multiplayer_games_started >= 0
    AND multiplayer_games_completed >= 0
    AND multiplayer_abandoned_before_start >= 0
    AND multiplayer_player_connections >= 0
    AND solo_classic_started >= 0
    AND solo_classic_completed >= 0
    AND solo_daily_started >= 0
    AND solo_daily_completed >= 0
    AND solo_endurance_started >= 0
    AND solo_endurance_completed >= 0
    AND solo_review_started >= 0
    AND solo_review_completed >= 0
  )
);

ALTER TABLE public.play_count_days
  ENABLE ROW LEVEL SECURITY,
  FORCE ROW LEVEL SECURITY;
