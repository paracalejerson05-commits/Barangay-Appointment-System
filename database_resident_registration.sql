-- Run once in the Supabase SQL Editor to enable private resident identity uploads
-- and enforce the resident registration / approval requirements.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS house_street text,
  ADD COLUMN IF NOT EXISTS purok_sitio text,
  ADD COLUMN IF NOT EXISTS barangay text,
  ADD COLUMN IF NOT EXISTS municipality_city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_type_other text,
  ADD COLUMN IF NOT EXISTS id_front_path text,
  ADD COLUMN IF NOT EXISTS id_back_path text,
  ADD COLUMN IF NOT EXISTS face_photo_path text,
  ADD COLUMN IF NOT EXISTS face_registration_method text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;

-- Existing approved accounts retain their prior approval state. New residents
-- must be approved after manual review of the registration data and documents.
UPDATE public.users
SET verification_status = 'approved'
WHERE lower(trim(coalesce(status, ''))) IN ('approved', 'active')
  AND verification_status = 'pending';

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
      AND lower(trim(coalesce(status, ''))) <> 'deactivated'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_resident_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_authenticated_resident boolean := auth.uid() IS NOT NULL AND NOT public.is_admin();
  is_auth_provisioned_profile boolean := false;
  is_rejection_status_update boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    is_rejection_status_update :=
      NEW.status = 'inactive'
      AND NEW.status IS DISTINCT FROM OLD.status;
  END IF;

  is_auth_provisioned_profile :=
    TG_OP = 'INSERT'
    AND auth.uid() IS NULL
    AND auth.role() IS DISTINCT FROM 'anon';

  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Anonymous users cannot create or update resident profiles';
  END IF;

  -- Supabase Auth may create the initial public.users row from an auth.users
  -- trigger before the resident can submit the complete registration form.
  -- Keep that bootstrap row pending; the authenticated profile upsert below
  -- still passes through the complete resident validation.
  IF is_auth_provisioned_profile THEN
    NEW.role := 'resident';
    NEW.status := 'pending';
    NEW.verification_status := 'pending';
  END IF;

  IF is_authenticated_resident THEN
    IF NEW.id <> auth.uid()::text THEN
      RAISE EXCEPTION 'Residents may only save their own profile';
    END IF;

    IF TG_OP = 'INSERT' THEN
      NEW.role := 'resident';
      NEW.status := 'pending';
      NEW.verification_status := 'pending';
    ELSIF NEW.role IS DISTINCT FROM OLD.role
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending')
       OR (NEW.verification_status IS DISTINCT FROM OLD.verification_status AND NEW.verification_status <> 'pending') THEN
      RAISE EXCEPTION 'Residents cannot change their account or verification status';
    END IF;
  END IF;

  IF NEW.role = 'resident'
    AND NOT is_auth_provisioned_profile
    AND NOT is_rejection_status_update THEN
    IF coalesce(trim(NEW.display_name), '') = ''
      OR NEW.date_of_birth IS NULL
      OR NEW.date_of_birth > current_date
      OR NEW.age IS NULL
      OR NEW.age <> extract(year FROM age(current_date, NEW.date_of_birth))::integer
      OR coalesce(trim(NEW.gender), '') = ''
      OR coalesce(trim(NEW.civil_status), '') = ''
      OR coalesce(trim(NEW.email), '') = ''
      OR coalesce(NEW.contact_number, '') !~ '^09[0-9]{9}$'
      OR coalesce(trim(NEW.purok_sitio), '') = ''
      OR coalesce(trim(NEW.barangay), '') = ''
      OR coalesce(trim(NEW.municipality_city), '') = ''
      OR coalesce(trim(NEW.province), '') = ''
      OR coalesce(trim(NEW.address), '') = ''
      OR coalesce(trim(NEW.id_type), '') = ''
      OR coalesce(NEW.id_type, '') NOT IN (
        'PhilSys National ID',
        'Driver''s License',
        'Passport',
        'Voter''s ID',
        'Other Accepted ID'
      )
      OR coalesce(NEW.email, '') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      OR NEW.id_front_path IS NULL
      OR split_part(NEW.id_front_path, '/', 1) <> NEW.id
      OR array_length(string_to_array(NEW.id_front_path, '/'), 1) <> 2
      OR split_part(NEW.id_front_path, '/', 2) !~ '^[A-Za-z0-9-]+\.(jpg|png|webp)$'
      OR (
        NEW.id_back_path IS NOT NULL
        AND (
          split_part(NEW.id_back_path, '/', 1) <> NEW.id
          OR array_length(string_to_array(NEW.id_back_path, '/'), 1) <> 2
          OR split_part(NEW.id_back_path, '/', 2) !~ '^[A-Za-z0-9-]+\.(jpg|png|webp)$'
        )
      )
      OR (
        NEW.face_photo_path IS NOT NULL
        AND (
          split_part(NEW.face_photo_path, '/', 1) <> NEW.id
          OR array_length(string_to_array(NEW.face_photo_path, '/'), 1) <> 2
          OR split_part(NEW.face_photo_path, '/', 2) !~ '^[A-Za-z0-9-]+\.(jpg|png|webp)$'
        )
      )
      OR NEW.privacy_consent_at IS NULL
      OR coalesce(NEW.face_registration_method, '') NOT IN ('camera', 'upload', 'in_person')
      OR (NEW.face_registration_method IN ('camera', 'upload') AND NEW.face_photo_path IS NULL) THEN
      RAISE EXCEPTION 'Complete all required resident registration and identity fields before saving';
    END IF;
  END IF;

  IF NEW.role = 'resident'
    AND NOT is_auth_provisioned_profile
    AND lower(trim(coalesce(NEW.status, ''))) IN ('approved', 'active')
    AND (NEW.verification_status <> 'approved' OR NEW.id_front_path IS NULL OR NEW.privacy_consent_at IS NULL) THEN
    RAISE EXCEPTION 'Resident registration must be reviewed before approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_resident_registration ON public.users;
CREATE TRIGGER enforce_resident_registration
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_resident_registration();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete users" ON public.users;
DROP POLICY IF EXISTS "Residents can read own profile" ON public.users;
DROP POLICY IF EXISTS "Residents can create own profile" ON public.users;
DROP POLICY IF EXISTS "Residents can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.users;
DROP POLICY IF EXISTS "Restrict resident profile reads" ON public.users;
DROP POLICY IF EXISTS "Restrict resident profile creates" ON public.users;
DROP POLICY IF EXISTS "Restrict resident profile updates" ON public.users;
DROP POLICY IF EXISTS "Restrict resident profile deletes" ON public.users;

CREATE POLICY "Residents can read own profile" ON public.users FOR SELECT
  USING (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Residents can create own profile" ON public.users FOR INSERT
  WITH CHECK (id = auth.uid()::text);
CREATE POLICY "Residents can update own profile" ON public.users FOR UPDATE
  USING (id = auth.uid()::text OR public.is_admin())
  WITH CHECK (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Admins can delete profiles" ON public.users FOR DELETE
  USING (public.is_admin());

CREATE POLICY "Restrict resident profile reads" ON public.users AS RESTRICTIVE FOR SELECT TO public
  USING (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Restrict resident profile creates" ON public.users AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL AND (id = auth.uid()::text OR public.is_admin()));
CREATE POLICY "Restrict resident profile updates" ON public.users AS RESTRICTIVE FOR UPDATE TO public
  USING (id = auth.uid()::text OR public.is_admin())
  WITH CHECK (id = auth.uid()::text OR public.is_admin());
CREATE POLICY "Restrict resident profile deletes" ON public.users AS RESTRICTIVE FOR DELETE TO public
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.notify_admin_profile_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resident_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to send a profile update notification';
  END IF;

  SELECT display_name
  INTO resident_name
  FROM public.users
  WHERE id = auth.uid()::text
    AND role = 'resident'
    AND lower(trim(coalesce(status, ''))) <> 'deactivated';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active resident profile is required to send this notification';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
  VALUES (
    'admin',
    'Resident Profile Updated',
    format('%s updated their resident profile. Review the latest information in Residents.', coalesce(resident_name, 'A resident')),
    'info',
    false,
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admin_profile_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admin_profile_change() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_approved_resident()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()::text
      AND (
        role = 'admin'
        OR (
          role = 'resident'
          AND lower(trim(coalesce(status, ''))) IN ('approved', 'active')
          AND lower(trim(coalesce(verification_status, ''))) = 'approved'
          AND coalesce(trim(display_name), '') <> ''
          AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
          AND date_of_birth IS NOT NULL
          AND age = extract(year FROM age(current_date, date_of_birth))::integer
          AND coalesce(trim(gender), '') <> ''
          AND coalesce(trim(civil_status), '') <> ''
          AND contact_number ~ '^09[0-9]{9}$'
          AND coalesce(trim(address), '') <> ''
          AND coalesce(trim(purok_sitio), '') <> ''
          AND coalesce(trim(barangay), '') <> ''
          AND coalesce(trim(municipality_city), '') <> ''
          AND coalesce(trim(province), '') <> ''
          AND id_front_path IS NOT NULL
          AND privacy_consent_at IS NOT NULL
          AND face_registration_method IN ('camera', 'upload', 'in_person')
          AND (face_registration_method = 'in_person' OR face_photo_path IS NOT NULL)
        )
      )
  );
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resident-verification',
  'resident-verification',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Residents can access own verification files" ON storage.objects;
DROP POLICY IF EXISTS "Residents can upload own verification files" ON storage.objects;
DROP POLICY IF EXISTS "Residents can update own verification files" ON storage.objects;
DROP POLICY IF EXISTS "Residents and admins can delete verification files" ON storage.objects;

CREATE POLICY "Residents can access own verification files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resident-verification'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Residents can upload own verification files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resident-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Residents can update own verification files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resident-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'resident-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Residents and admins can delete verification files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resident-verification'
  AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
);

DROP POLICY IF EXISTS "Restrict resident verification reads" ON storage.objects;
DROP POLICY IF EXISTS "Restrict resident verification uploads" ON storage.objects;
DROP POLICY IF EXISTS "Restrict resident verification updates" ON storage.objects;
DROP POLICY IF EXISTS "Restrict resident verification deletes" ON storage.objects;

CREATE POLICY "Restrict resident verification reads"
ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (
  bucket_id <> 'resident-verification'
  OR public.is_admin()
  OR (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Restrict resident verification uploads"
ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (
  bucket_id <> 'resident-verification'
  OR (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Restrict resident verification updates"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (
  bucket_id <> 'resident-verification'
  OR public.is_admin()
  OR (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id <> 'resident-verification'
  OR (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Restrict resident verification deletes"
ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (
  bucket_id <> 'resident-verification'
  OR public.is_admin()
  OR (storage.foldername(name))[1] = auth.uid()::text
);
