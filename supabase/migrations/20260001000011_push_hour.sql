-- Add preferred notification hour per user (Danish local time, default 7 = 07:00 CEST)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_hour INTEGER NOT NULL DEFAULT 7;
