-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'coach'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.sports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_code bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.coaches_sports (
  coach_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT coaches_sports_pkey PRIMARY KEY (coach_id, sport_id),
  CONSTRAINT coaches_sports_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id),
  CONSTRAINT coaches_sports_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  date_of_birth date,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  sport_id uuid,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.players_sports (
  player_id uuid NOT NULL,
  sport_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT players_sports_pkey PRIMARY KEY (player_id, sport_id),
  CONSTRAINT players_sports_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT players_sports_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.assessment_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT assessment_categories_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_categories_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT skills_pkey PRIMARY KEY (id),
  CONSTRAINT skills_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.assessment_categories(id)
);
CREATE TABLE public.skill_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT skill_criteria_pkey PRIMARY KEY (id),
  CONSTRAINT skill_criteria_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.player_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  criteria_id uuid,
  coach_id uuid,
  score integer NOT NULL CHECK (score >= 1 AND score <= 10),
  assessment_month integer NOT NULL CHECK (assessment_month >= 1 AND assessment_month <= 12),
  assessment_year integer NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  assessed_at timestamp with time zone DEFAULT now(),
  skill_id uuid,
  CONSTRAINT player_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT player_assessments_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT player_assessments_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES public.skill_criteria(id),
  CONSTRAINT player_assessments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id),
  CONSTRAINT player_assessments_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.rubrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  skill_id uuid,
  criterion text NOT NULL,
  points integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rubrics_pkey PRIMARY KEY (id),
  CONSTRAINT rubrics_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL,
  name text NOT NULL,
  event_date date NOT NULL DEFAULT (timezone('utc'::text, now()))::date,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  notes text,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id)
);
CREATE TABLE public.players_events (
  player_id uuid NOT NULL,
  event_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT players_events_pkey PRIMARY KEY (player_id, event_id),
  CONSTRAINT players_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT players_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);