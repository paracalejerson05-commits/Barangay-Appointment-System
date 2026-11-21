CREATE TABLE IF NOT EXISTS public.paper_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,
  request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  resident_id VARCHAR(128) REFERENCES public.users(id) ON DELETE SET NULL,
  resident_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(255) NOT NULL,
  document_type VARCHAR(255) NOT NULL,
  pages_printed INTEGER NOT NULL CHECK (pages_printed BETWEEN 1 AND 100),
  sheets_used INTEGER NOT NULL CHECK (
    sheets_used = pages_printed
    OR sheets_used = CEIL(pages_printed::NUMERIC / 2)::INTEGER
  ),
  admin_user_id VARCHAR(128) REFERENCES public.users(id) ON DELETE SET NULL,
  admin_name VARCHAR(255) NOT NULL,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS paper_usage_records_printed_at_idx
  ON public.paper_usage_records (printed_at);
CREATE INDEX IF NOT EXISTS paper_usage_records_service_printed_at_idx
  ON public.paper_usage_records (service_type, printed_at);
CREATE INDEX IF NOT EXISTS paper_usage_records_request_id_idx
  ON public.paper_usage_records (request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.paper_usage_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paper_usage_records FROM PUBLIC, anon;
REVOKE UPDATE, DELETE ON public.paper_usage_records FROM authenticated;
GRANT SELECT, INSERT ON public.paper_usage_records TO authenticated;

DROP POLICY IF EXISTS "Admins can read paper usage records" ON public.paper_usage_records;
CREATE POLICY "Admins can read paper usage records" ON public.paper_usage_records
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can create paper usage records" ON public.paper_usage_records;
CREATE POLICY "Admins can create paper usage records" ON public.paper_usage_records
  FOR INSERT WITH CHECK (
    admin_user_id = auth.uid()::text
    AND public.is_admin()
  );
