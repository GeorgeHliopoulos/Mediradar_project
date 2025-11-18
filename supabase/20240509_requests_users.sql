-- Migration: extend requests table and add users with roles

-- Add optional image and barcode metadata to existing requests without affecting current RLS policies.
ALTER TABLE IF EXISTS public.requests
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS barcode_text text;

-- Ensure fast lookups when searching by barcode supplied with a request.
CREATE INDEX IF NOT EXISTS idx_requests_barcode_text
  ON public.requests (barcode_text);

-- Create a simple users table to manage roles for future authentication features.
CREATE TABLE IF NOT EXISTS public.users (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','pharmacy_professional','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS remains disabled for public.users; management will happen via the dashboard.

-- Facilitate queries by role (e.g., listing all pharmacy professionals).
CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users (role);
