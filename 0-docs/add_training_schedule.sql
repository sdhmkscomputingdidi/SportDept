-- ============================================================
-- TRAINING SCHEDULE & HOLIDAYS MODULE — Run in Supabase SQL Editor
-- ============================================================
-- Adds recurring weekly training day definitions per sport
-- and a holiday calendar to mark non-training dates.
-- ============================================================

-- 1. SPORT TRAINING DAYS
-- Defines which days of the week each sport trains on (e.g. Mon & Wed).
-- day_of_week: 0=Sunday, 1=Monday ... 6=Saturday
CREATE TABLE IF NOT EXISTS public.sport_training_days (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT sport_training_days_pkey PRIMARY KEY (id),
  CONSTRAINT sport_training_days_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE,
  CONSTRAINT sport_training_days_unique UNIQUE (sport_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_sport_training_days_sport
  ON public.sport_training_days(sport_id);


-- 2. HOLIDAYS
-- Dates when training is cancelled.
-- sport_id = NULL means global holiday (all sports affected).
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_id uuid,
  date date NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT holidays_pkey PRIMARY KEY (id),
  CONSTRAINT holidays_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE,
  CONSTRAINT holidays_unique UNIQUE (sport_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_date
  ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_sport_date
  ON public.holidays(sport_id, date);


-- 3. ROW LEVEL SECURITY

ALTER TABLE public.sport_training_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Policy: head_coach full access to sport_training_days
--         coaches can view (read-only) their assigned sports' training days
CREATE POLICY "sport_training_days_access"
  ON public.sport_training_days
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
  );

-- Policy: head_coach full access to holidays
--         coaches can view holidays for their assigned sports + global holidays
CREATE POLICY "holidays_access"
  ON public.holidays
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'head_coach'
    )
    OR
    sport_id IS NULL
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
  );
