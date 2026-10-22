-- Apply this migration in Supabase after confirming that Auth users map to users.id.
-- It replaces the development-only public policies in database_schema.sql.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_dates ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Allow public read users" ON users;
DROP POLICY IF EXISTS "Allow public insert users" ON users;
DROP POLICY IF EXISTS "Allow public update users" ON users;
DROP POLICY IF EXISTS "Allow public delete users" ON users;
DROP POLICY IF EXISTS "Allow public read service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow public insert service_requests" ON service_requests;
DROP POLICY IF EXISTS "Allow public update service_requests" ON service_requests;
DROP POLICY IF EXISTS "Residents can delete own pending requests" ON service_requests;
DROP POLICY IF EXISTS "Allow public read orders" ON orders;
DROP POLICY IF EXISTS "Allow public insert orders" ON orders;
DROP POLICY IF EXISTS "Allow public update orders" ON orders;
DROP POLICY IF EXISTS "Allow public read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public insert announcements" ON announcements;
DROP POLICY IF EXISTS "Allow public update announcements" ON announcements;
DROP POLICY IF EXISTS "Allow public delete announcements" ON announcements;
DROP POLICY IF EXISTS "Allow public update settings" ON settings;
DROP POLICY IF EXISTS "Allow public insert settings" ON settings;
DROP POLICY IF EXISTS "Allow public insert special_dates" ON special_dates;
DROP POLICY IF EXISTS "Allow public update special_dates" ON special_dates;
DROP POLICY IF EXISTS "Allow public delete special_dates" ON special_dates;

CREATE POLICY "Residents can read own profile" ON users FOR SELECT
  USING (id = auth.uid()::text OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
CREATE POLICY "Residents can create own profile" ON users FOR INSERT
  WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Residents can update own profile" ON users FOR UPDATE
  USING (id = auth.uid()::text OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  WITH CHECK (id = auth.uid()::text OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
CREATE POLICY "Admins can delete profiles" ON users FOR DELETE
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));

CREATE POLICY "Residents can read own requests" ON service_requests FOR SELECT
  USING (resident_id = auth.uid()::text OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
CREATE POLICY "Residents can delete own pending requests" ON service_requests FOR DELETE
  USING (resident_id = auth.uid()::text AND status = 'pending');
CREATE POLICY "Residents can create own requests" ON service_requests FOR INSERT
  WITH CHECK (resident_id = auth.uid()::text);
CREATE POLICY "Admins can update requests" ON service_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));

CREATE POLICY "Users can read own orders" ON orders FOR SELECT
  USING (user_id = auth.uid()::text OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
CREATE POLICY "Users can create own orders" ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Admins can update orders" ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));

CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid()::text OR (user_id = 'admin' AND EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin')));
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid()::text OR (user_id = 'admin' AND EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin')));

CREATE POLICY "Public can read published announcements" ON announcements FOR SELECT
  USING (status = 'Published' OR EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));

CREATE POLICY "Authenticated users can read settings" ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage settings" ON settings FOR ALL
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));

CREATE POLICY "Authenticated users can read special dates" ON special_dates FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage special dates" ON special_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'));
