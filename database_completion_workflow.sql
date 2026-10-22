ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS completion_action VARCHAR(20),
  ADD COLUMN IF NOT EXISTS completion_email_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS completion_email_error TEXT,
  ADD COLUMN IF NOT EXISTS completion_notification_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS completion_notification_error TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_service_request_completion_idx
  ON notifications (service_request_id)
  WHERE service_request_id IS NOT NULL;

DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public insert notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public notifications access" ON notifications;
DROP POLICY IF EXISTS "Allow public read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow public update notifications" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
  USING (
    user_id = auth.uid()::text OR
    (user_id = 'admin' AND EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  );
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (
    user_id = auth.uid()::text OR
    (user_id = 'admin' AND EXISTS (SELECT 1 FROM users me WHERE me.id = auth.uid()::text AND me.role = 'admin'))
  );
CREATE POLICY "Users can create own notifications" ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Admins can create notifications" ON notifications FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users me
    WHERE me.id = auth.uid()::text AND me.role = 'admin'
  ));
