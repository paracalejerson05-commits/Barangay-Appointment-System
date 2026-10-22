-- Repair for database_security_hardening.sql.
-- The original policies queried users from inside users RLS policies, which
-- causes PostgreSQL RLS recursion errors during profile saves.

-- Prevent case-variant or whitespace-variant copies of the same email.
-- Resolve any existing collisions before applying this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uidx
ON public.users (lower(btrim(email)));

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

CREATE OR REPLACE FUNCTION public.is_approved_resident()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text
      AND (
        role = 'admin'
        OR lower(trim(coalesce(status, ''))) IN ('approved', 'active')
      )
  );
$$;

-- Availability needs booking counts, but residents must not be able to read
-- other residents' request details. This function returns only scheduling data.
DROP FUNCTION IF EXISTS public.get_appointment_bookings(date);
CREATE OR REPLACE FUNCTION public.get_appointment_bookings(target_date date)
RETURNS TABLE (appointment_date date, appointment_time text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT appointment_date, appointment_time, status
  FROM public.service_requests
  WHERE appointment_date = target_date
    AND status IN ('pending', 'approved');
$$;

REVOKE ALL ON FUNCTION public.get_appointment_bookings(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_bookings(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_bookings(date) TO service_role;

DROP POLICY IF EXISTS "Residents can read own profile" ON users;
DROP POLICY IF EXISTS "Allow public read users" ON users;
DROP POLICY IF EXISTS "Allow public insert users" ON users;
DROP POLICY IF EXISTS "Allow public update users" ON users;
DROP POLICY IF EXISTS "Allow public delete users" ON users;
DROP POLICY IF EXISTS "Residents can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can delete profiles" ON users;
DROP POLICY IF EXISTS "Residents can read own requests" ON service_requests;
DROP POLICY IF EXISTS "Residents can create own requests" ON service_requests;
DROP POLICY IF EXISTS "Residents can delete own pending requests" ON service_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON service_requests;
DROP POLICY IF EXISTS "Users can read own orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Public can read published announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;
DROP POLICY IF EXISTS "Admins can manage special dates" ON special_dates;

CREATE POLICY "Residents can read own profile" ON users FOR SELECT
  USING (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Residents can create own profile" ON users FOR INSERT
  WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Residents can update own profile" ON users FOR UPDATE
  USING (id = auth.uid()::text OR public.is_admin())
  WITH CHECK (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Admins can delete profiles" ON users FOR DELETE
  USING (public.is_admin());

CREATE POLICY "Residents can read own requests" ON service_requests FOR SELECT
  USING (resident_id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Approved residents can create own requests" ON service_requests FOR INSERT
  WITH CHECK (resident_id = auth.uid()::text AND public.is_approved_resident());
CREATE POLICY "Residents can delete own pending requests" ON service_requests FOR DELETE
  USING (resident_id = auth.uid()::text AND status = 'pending');
CREATE POLICY "Admins can update requests" ON service_requests FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Users can read own orders" ON orders FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Admins can update orders" ON orders FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid()::text OR (user_id = 'admin' AND public.is_admin()));
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid()::text OR (user_id = 'admin' AND public.is_admin()));

CREATE POLICY "Public can read published announcements" ON announcements FOR SELECT
  USING (status = 'Published' OR public.is_admin());
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage settings" ON settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage special dates" ON special_dates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
