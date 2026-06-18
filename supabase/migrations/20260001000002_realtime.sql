-- Enable realtime for the events table so live calendar updates work across devices
alter publication supabase_realtime add table public.events;
