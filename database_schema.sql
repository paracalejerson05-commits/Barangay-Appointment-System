-- ==========================================
-- BARANGAY PUPUA SMART APPOINTMENT SYSTEM
-- COMPREHENSIVE SUPABASE POSTGRESQL SCHEMA
-- Project ID: yvbiztjaxrtahsgzizdt
-- ==========================================

-- ----------------------------------------------------
-- 1. USERS & RESIDENTS
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY, -- Maps to Firebase Auth UID
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'resident', -- 'resident' or 'admin'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'deactivated'
    contact_number VARCHAR(50),
    age INT,
    date_of_birth DATE,
    gender VARCHAR(50),
    civil_status VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uidx
ON users (lower(btrim(email)));

-- Convenient alias view for resident queries
CREATE OR REPLACE VIEW residents AS
SELECT 
    id,
    display_name AS full_name,
    display_name,
    email,
    role,
    status,
    contact_number,
    age,
    gender,
    civil_status,
    address,
    created_at,
    updated_at
FROM users
WHERE role = 'resident' OR role IS NULL;

-- ----------------------------------------------------
-- 2. SERVICES CATALOG
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) DEFAULT 'General',
    fee DECIMAL(10, 2) DEFAULT 0.00,
    processing_time VARCHAR(100) DEFAULT '1-2 Working Days',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------
-- 3. SERVICE REQUESTS & APPOINTMENTS
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id VARCHAR(128) NOT NULL,
    resident_name VARCHAR(255),
    service_type VARCHAR(255) NOT NULL,
    purpose TEXT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'disapproved'
    queue_number INT,
    ai_recommendation TEXT,
    admin_notes TEXT,
    certificate_data JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by VARCHAR(255),
    completion_action VARCHAR(20),
    completion_email_status VARCHAR(20),
    completion_email_error TEXT,
    completion_notification_status VARCHAR(20),
    completion_notification_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Appointment capacity is configured per slot, so appointment times cannot be
-- globally unique. Availability is enforced by the server using that capacity.
CREATE INDEX IF NOT EXISTS service_requests_appointment_lookup_idx
ON service_requests (appointment_date, appointment_time, status);

ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS certificate_data JSONB;

-- Alias view for appointments
CREATE OR REPLACE VIEW appointments AS
SELECT 
    id,
    resident_id,
    resident_name,
    service_type,
    purpose,
    appointment_date,
    appointment_time,
    status,
    queue_number,
    admin_notes,
    created_at,
    updated_at
FROM service_requests;

-- Alias view for queue tracking
CREATE OR REPLACE VIEW queue AS
SELECT 
    id AS queue_id,
    queue_number,
    resident_id,
    resident_name,
    service_type,
    appointment_date,
    appointment_time,
    status,
    created_at
FROM service_requests
WHERE queue_number IS NOT NULL
ORDER BY appointment_date ASC, queue_number ASC;

-- ----------------------------------------------------
-- 4. ORDERS & TRANSACTIONS (BILLING LOGS)
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL,
    service_request_id UUID,
    service_type VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
    payment_method VARCHAR(100) DEFAULT 'Cash on Site',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    appointment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL
);

-- View for financial transactions
CREATE OR REPLACE VIEW transactions AS
SELECT 
    id AS transaction_id,
    user_id,
    service_type,
    amount,
    payment_method,
    status AS payment_status,
    appointment_date,
    created_at
FROM orders;

-- Combined reporting view
CREATE OR REPLACE VIEW reports AS
SELECT 
    s.id AS request_id,
    s.resident_name,
    s.service_type,
    s.status AS request_status,
    s.appointment_date,
    o.amount,
    o.payment_method,
    o.status AS payment_status,
    s.created_at
FROM service_requests s
LEFT JOIN orders o ON s.id = o.service_request_id;

-- ----------------------------------------------------
-- 5. ANNOUNCEMENTS
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    status VARCHAR(50) DEFAULT 'Published', -- 'Published', 'Draft', 'Archived'
    publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------
-- 6. NOTIFICATIONS
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL, -- User UID or 'admin'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_service_request_completion_idx
ON notifications (service_request_id)
WHERE service_request_id IS NOT NULL;

-- ----------------------------------------------------
-- 7. SPECIAL DATES & HOLIDAYS (SCHEDULE MANAGEMENT)
-- ----------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON settings FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS special_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date DATE NOT NULL,
    description TEXT,
    is_holiday BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------
-- 8. DEFAULT SERVICES SEED DATA
-- ----------------------------------------------------
INSERT INTO services (title, description, category, fee, processing_time, is_active)
VALUES 
    ('Barangay Clearance', 'Official clearance issued for employment, business, and official transactions.', 'General', 50.00, '1-2 Working Days', TRUE),
    ('Certificate of Indigency', 'Certification for low-income residents for medical, educational, or financial aid.', 'General', 0.00, '1-2 Working Days', TRUE),
    ('Certificate of Residency', 'Proof of residence within Barangay Pupua for legal or administrative needs.', 'General', 50.00, '1-2 Working Days', TRUE),
    ('Business Clearance', 'Barangay clearance for opening or renewing local business operations.', 'Business', 150.00, '2-3 Working Days', TRUE),
    ('Barangay ID', 'Official barangay identification card for verified residents.', 'Identification', 100.00, '1-2 Working Days', TRUE),
    ('First Time Jobseeker Assistance', 'Free certification under the First Time Jobseekers Assistance Act (RA 11261).', 'Assistance', 0.00, '1 Working Day', TRUE)
ON CONFLICT (title) DO NOTHING;

-- ----------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete users" ON users FOR DELETE USING (true);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read services" ON services FOR SELECT USING (true);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read service_requests" ON service_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert service_requests" ON service_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update service_requests" ON service_requests FOR UPDATE USING (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON orders FOR UPDATE USING (true);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY "Allow public insert announcements" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update announcements" ON announcements FOR UPDATE USING (true);
CREATE POLICY "Allow public delete announcements" ON announcements FOR DELETE USING (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update notifications" ON notifications FOR UPDATE USING (true);

ALTER TABLE special_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read special_dates" ON special_dates FOR SELECT USING (true);
CREATE POLICY "Allow public insert special_dates" ON special_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update special_dates" ON special_dates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete special_dates" ON special_dates FOR DELETE USING (true);
