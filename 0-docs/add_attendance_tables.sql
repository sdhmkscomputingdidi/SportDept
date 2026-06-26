-- ============================================================
-- ATTENDANCE MODULE — Run this in Supabase SQL Editor
-- ============================================================
-- Adds attendance tracking tables for coaches and students.
-- Follows existing schema conventions (UUID PKs, UTC timestamps,
-- FK cascades, check constraints, indexing patterns).
--
-- Prerequisites: profiles, sports, players tables must exist.
-- ============================================================

-- 1. COACH ATTENDANCE
-- Records daily attendance of coaches at their assigned sports.
CREATE TABLE IF NOT EXISTS public.coach_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT coach_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT coach_attendance_coach_id_fkey FOREIGN KEY (coach_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,
  CONSTRAINT coach_attendance_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE,
  -- Prevent duplicate attendance records for the same coach/sport/day
  CONSTRAINT coach_attendance_unique UNIQUE (coach_id, sport_id, date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_coach_attendance_coach_date
  ON public.coach_attendance(coach_id, date);
CREATE INDEX IF NOT EXISTS idx_coach_attendance_sport_date
  ON public.coach_attendance(sport_id, date);
CREATE INDEX IF NOT EXISTS idx_coach_attendance_status
  ON public.coach_attendance(status);


-- 2. STUDENT ATTENDANCE
-- Records daily attendance of students (players) at their assigned sports.
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT student_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT student_attendance_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id)
    ON DELETE CASCADE,
  CONSTRAINT student_attendance_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE,
  -- Prevent duplicate attendance records for the same player/sport/day
  CONSTRAINT student_attendance_unique UNIQUE (player_id, sport_id, date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_student_attendance_player_date
  ON public.student_attendance(player_id, date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_sport_date
  ON public.student_attendance(sport_id, date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_status
  ON public.student_attendance(status);


-- 3. ROW LEVEL SECURITY (RLS)

-- Enable RLS on the tables
ALTER TABLE public.coach_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: head_coach has full access to coach_attendance
--         coaches can see and manage their own records
CREATE POLICY "coach_attendance_access"
  ON public.coach_attendance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'head_coach'
    )
    OR
    coach_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'head_coach'
    )
    OR
    coach_id = auth.uid()
  );

-- Policy: head_coach has full access to student_attendance
--         coaches can manage students in their assigned sports
CREATE POLICY "student_attendance_access"
  ON public.student_attendance
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
