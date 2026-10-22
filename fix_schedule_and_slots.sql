-- Paste this entire script into Supabase SQL Editor, then click Run.
-- It fixes schedule persistence and resident appointment availability.

-- The original schema used a partial unique index, which allowed only one
-- resident per time even when maxCapacityPerSlot was greater than one.
DROP INDEX IF EXISTS public.service_requests_active_appointment_idx;
CREATE INDEX IF NOT EXISTS public.service_requests_appointment_lookup_idx
ON public.service_requests (appointment_date, appointment_time, status);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text
      AND role = 'admin'
      AND status <> 'deactivated'
  );
$$;

DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public insert settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public update settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;

CREATE POLICY "Authenticated users can read settings" ON public.settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP FUNCTION IF EXISTS public.get_appointment_bookings(date);
DROP FUNCTION IF EXISTS public.get_appointment_bookings(text);

CREATE FUNCTION public.get_appointment_bookings(target_date text)
RETURNS TABLE (
  appointment_date text,
  appointment_time text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    request.appointment_date::text,
    request.appointment_time::text,
    request.status::text
  FROM public.service_requests AS request
  WHERE request.appointment_date::text = target_date
    AND request.status IN ('pending', 'approved');
$$;

REVOKE ALL ON FUNCTION public.get_appointment_bookings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_bookings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_bookings(text) TO service_role;
