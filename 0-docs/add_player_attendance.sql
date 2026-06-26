-- ============================================================
-- PLAYER ATTENDANCE MODULE — Run in Supabase SQL Editor
-- ============================================================
-- Tracks daily attendance of players/students per sport.
-- Coaches can bulk-mark students as present/absent/late.
-- ============================================================

-- 1. PLAYER ATTENDANCE TABLE
-- Records daily attendance for each player per sport.
-- Coach who records the attendance is also tracked.
CREATE TABLE IF NOT EXISTS public.player_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  coach_id uuid,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT player_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT player_attendance_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id)
    ON DELETE CASCADE,
  CONSTRAINT player_attendance_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE,
  CONSTRAINT player_attendance_coach_id_fkey FOREIGN KEY (coach_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL,
  CONSTRAINT player_attendance_unique UNIQUE (player_id, sport_id, date)
);

CREATE INDEX IF NOT EXISTS idx_player_attendance_date
  ON public.player_attendance(date);
CREATE INDEX IF NOT EXISTS idx_player_attendance_sport_date
  ON public.player_attendance(sport_id, date);
CREATE INDEX IF NOT EXISTS idx_player_attendance_player
  ON public.player_attendance(player_id);

-- 2. ROW LEVEL SECURITY

ALTER TABLE public.player_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: head_coach full access to all player_attendance
--         coaches can access their assigned sports' attendance
CREATE POLICY "player_attendance_access"
  ON public.player_attendance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'head_coach'
    )
    OR
    sport_id IN (
      SELECT cs.sport_id FROM public.coaches_sports cs
      WHERE cs.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'head_coach'
    )
    OR
    sport_id IN (
      SELECT cs.sport_id FROM public.coaches_sports cs
      WHERE cs.coach_id = auth.uid()
    )
  );
