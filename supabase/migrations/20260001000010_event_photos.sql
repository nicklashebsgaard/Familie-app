CREATE TABLE IF NOT EXISTS public.event_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_view_photos"
  ON public.event_photos FOR SELECT
  USING (family_id IN (SELECT family_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "family_insert_photos"
  ON public.event_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    family_id IN (SELECT family_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "owner_delete_photos"
  ON public.event_photos FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND family_id = event_photos.family_id
        AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON public.event_photos (event_id);
