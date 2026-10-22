-- Paste this entire script into Supabase SQL Editor and click Run.
-- It exposes only appointment availability data, not resident details.

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
