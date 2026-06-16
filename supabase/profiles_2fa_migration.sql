-- SQL Migration: Add User Profile CRUD and 2FA Support
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Alter public.profiles to add new fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Verify or add RLS policies for Profiles
-- Ensure SELECT is public or authenticated
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" 
    ON public.profiles FOR SELECT 
    USING (true);

-- Ensure individual users can update their own profile fields
DROP POLICY IF EXISTS "Allow individual users to update their profile" ON public.profiles;
CREATE POLICY "Allow individual users to update their profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Ensure insert is permitted during signup trigger
-- Note: Trigger function handle_new_user() runs as SECURITY DEFINER, 
-- but in case of manual insert, allow authenticated or anonymous user insertion:
DROP POLICY IF EXISTS "Allow individual insert own profile" ON public.profiles;
CREATE POLICY "Allow individual insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 3. Create public bucket for presets and avatars if needed
-- Users can save public image URLs directly to 'avatar_url' in the database.
