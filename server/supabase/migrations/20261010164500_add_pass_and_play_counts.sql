-- Pass & play daily totals. Counts only: games started, and characters whose card was loaded.

ALTER TABLE public.play_count_days
  ADD COLUMN pass_and_play_started INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pass_and_play_characters_loaded INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT play_count_days_pass_and_play_nonnegative CHECK (
    pass_and_play_started >= 0
    AND pass_and_play_characters_loaded >= 0
  );
