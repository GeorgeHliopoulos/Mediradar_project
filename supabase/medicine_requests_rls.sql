-- Security policies for medicine_requests table to restrict pharmacy access
alter table if exists public.medicine_requests
  enable row level security;

alter table if exists public.medicine_requests
  force row level security;

-- Policy: allow pharmacies to read only their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medicine_requests'
      AND policyname = 'Pharmacies can view their own requests'
  ) THEN
    CREATE POLICY "Pharmacies can view their own requests"
      ON public.medicine_requests
      FOR SELECT
      USING (
        coalesce(auth.jwt() ->> 'role', '') = 'pharmacy'
        AND auth.uid() = pharmacy_id
      );
  END IF;
END
$$;

-- Policy: allow pharmacies to update only their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medicine_requests'
      AND policyname = 'Pharmacies can update their own requests'
  ) THEN
    CREATE POLICY "Pharmacies can update their own requests"
      ON public.medicine_requests
      FOR UPDATE
      USING (
        coalesce(auth.jwt() ->> 'role', '') = 'pharmacy'
        AND auth.uid() = pharmacy_id
      )
      WITH CHECK (
        coalesce(auth.jwt() ->> 'role', '') = 'pharmacy'
        AND auth.uid() = pharmacy_id
      );
  END IF;
END
$$;
