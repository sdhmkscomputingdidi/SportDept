-- Run this in your Supabase dashboard SQL editor
-- Adds an email column to the profiles table for displaying coach emails

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Optional: backfill existing emails from auth.users (requires service_role)
-- UPDATE public.profiles p
-- SET email = u.email
-- FROM auth.users u
-- WHERE p.id = u.id AND p.email IS NULL;
