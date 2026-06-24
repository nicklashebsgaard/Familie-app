-- Composite index for calendar range queries (family + date range)
CREATE INDEX IF NOT EXISTS idx_events_family_start
  ON public.events (family_id, start_at);

-- Index for recurring series edits/deletes
CREATE INDEX IF NOT EXISTS idx_events_recurring_group
  ON public.events (recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;

-- Index for push notification delivery per user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);
