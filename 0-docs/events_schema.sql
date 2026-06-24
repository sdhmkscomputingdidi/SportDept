-- ============================================================
-- EVENTS MODULE — Run this in Supabase SQL Editor
-- ============================================================
-- Adds event management tables used by the new "Manage Events" section
-- in CoachLayout. Follows existing schema conventions (UUID PKs,
-- UTC timestamps, FK cascades, check constraints).

-- 1. Ensure the user_role enum exists (referenced by profiles but
--    not defined in the context SQL file).
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('coach', 'head_coach');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. EVENTS TABLE
-- Sport-scoped events that coaches can create and manage.
CREATE TABLE IF NOT EXISTS public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL,
  name text NOT NULL,
  event_date date NOT NULL DEFAULT timezone('utc'::text, now())::date,
  description text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_sport_id_fkey FOREIGN KEY (sport_id)
    REFERENCES public.sports(id)
    ON DELETE CASCADE
);

-- Optional: index for quick sport-scoped lookups
CREATE INDEX IF NOT EXISTS idx_events_sport_id ON public.events(sport_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);

-- 3. PLAYERS_EVENTS TABLE
-- Join table assigning players (students) to events.
-- Mirrors the style of coaches_sports and players_sports.
CREATE TABLE IF NOT EXISTS public.players_events (
  player_id uuid NOT NULL,
  event_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT players_events_pkey PRIMARY KEY (player_id, event_id),
  CONSTRAINT players_events_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id)
    ON DELETE CASCADE,
  CONSTRAINT players_events_event_id_fkey FOREIGN KEY (event_id)
    REFERENCES public.events(id)
    ON DELETE CASCADE
);

-- 4. ROW LEVEL SECURITY (RLS)
-- Unified policies: head_coach gets full access; coaches get scoped access.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_events ENABLE ROW LEVEL SECURITY;

-- EVENTS: head_coach = full access, coach = assigned sports only
CREATE POLICY "events_access"
  ON public.events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'head_coach'
    )
    OR
    sport_id IN (
      SELECT cs.sport_id
      FROM public.coaches_sports cs
      WHERE cs.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'head_coach'
    )
    OR
    sport_id IN (
      SELECT cs.sport_id
      FROM public.coaches_sports cs
      WHERE cs.coach_id = auth.uid()
    )
  );

-- PLAYERS_EVENTS: head_coach = full access, coach = events in assigned sports only
CREATE POLICY "players_events_access"
  ON public.players_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'head_coach'
    )
    OR
    event_id IN (
      SELECT e.id
      FROM public.events e
      JOIN public.coaches_sports cs ON e.sport_id = cs.sport_id
      WHERE cs.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'head_coach'
    )
    OR
    event_id IN (
      SELECT e.id
      FROM public.events e
      JOIN public.coaches_sports cs ON e.sport_id = cs.sport_id
      WHERE cs.coach_id = auth.uid()
    )
  );
