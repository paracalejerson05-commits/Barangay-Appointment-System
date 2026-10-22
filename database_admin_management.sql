-- Keyless, authenticated administrator invitations using the existing Supabase
-- Auth project and public.users table. Run once in the Supabase SQL editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  email text PRIMARY KEY,
  full_name text NOT NULL,
  invited_by text NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_invitations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_primary_admin_manager()
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
      AND lower(trim(email)) = 'paracalejerson05@gmail.com'
      AND role = 'admin'
      AND lower(trim(coalesce(status, ''))) IN ('active', 'approved')
  );
$$;

REVOKE ALL ON FUNCTION public.is_primary_admin_manager() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.list_admin_management()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_primary_admin_manager() THEN
    RAISE EXCEPTION 'Only the primary administrator may manage administrator accounts'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'admins', coalesce((
      SELECT jsonb_agg(to_jsonb(admin_row) ORDER BY admin_row.created_at DESC)
      FROM (
        SELECT u.id, u.email, u.display_name, u.role, u.status, u.created_at,
          u.date_of_birth, u.age, u.gender, u.civil_status,
          u.contact_number, u.address,
          coalesce(a.raw_user_meta_data ->> 'photoURL', a.raw_user_meta_data ->> 'avatar_url', a.raw_user_meta_data ->> 'picture') AS photo_url,
          (a.email_confirmed_at IS NOT NULL) AS email_verified,
          a.last_sign_in_at
        FROM public.users u
        LEFT JOIN auth.users a ON a.id::text = u.id
        WHERE u.role = 'admin'
      ) admin_row
    ), '[]'::jsonb),
    'invitations', coalesce((
      SELECT jsonb_agg(to_jsonb(invitation_row) ORDER BY invitation_row.created_at DESC)
      FROM (
        SELECT email, full_name AS display_name, 'admin'::text AS role,
          'invited'::text AS status, created_at
        FROM public.admin_invitations
      ) invitation_row
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_invitation(p_full_name text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_name text := trim(coalesce(p_full_name, ''));
  normalized_email text := lower(trim(coalesce(p_email, '')));
  invitation public.admin_invitations;
BEGIN
  IF NOT public.is_primary_admin_manager() THEN
    RAISE EXCEPTION 'Only the primary administrator may invite administrators'
      USING ERRCODE = '42501';
  END IF;
  IF normalized_name = '' OR length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Enter a full name with no more than 120 characters'
      USING ERRCODE = '22023';
  END IF;
  IF length(normalized_email) > 254
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address'
      USING ERRCODE = '22023';
  END IF;
  IF normalized_email = 'paracalejerson05@gmail.com' THEN
    RAISE EXCEPTION 'The primary administrator is already authorized'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE lower(trim(email)) = normalized_email
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'An administrator already uses this email address'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.admin_invitations (email, full_name, invited_by, created_at)
  VALUES (normalized_email, normalized_name, auth.uid()::text, now())
  ON CONFLICT (email) DO UPDATE
    SET full_name = excluded.full_name,
        invited_by = excluded.invited_by,
        created_at = excluded.created_at
  RETURNING * INTO invitation;

  RETURN jsonb_build_object(
    'email', invitation.email,
    'full_name', invitation.full_name,
    'created_at', invitation.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_admin_invitation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_account auth.users;
  invitation public.admin_invitations;
  existing_profile public.users;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO auth_account
  FROM auth.users
  WHERE id = auth.uid()
    AND email_confirmed_at IS NOT NULL;
  IF NOT FOUND OR auth_account.email IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO invitation
  FROM public.admin_invitations
  WHERE email = lower(trim(auth_account.email))
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.redeeming_admin_invitation', 'true', true);
  SELECT * INTO existing_profile
  FROM public.users
  WHERE id = auth.uid()::text
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.users
    SET email = lower(trim(auth_account.email)),
        display_name = invitation.full_name,
        role = 'admin',
        status = 'approved',
        updated_at = now()
    WHERE id = auth.uid()::text;
  ELSE
    INSERT INTO public.users (id, email, display_name, role, status, created_at, updated_at)
    VALUES (
      auth.uid()::text,
      lower(trim(auth_account.email)),
      invitation.full_name,
      'admin',
      'approved',
      now(),
      now()
    );
  END IF;

  DELETE FROM public.admin_invitations WHERE email = invitation.email;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_managed_admin(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.users;
  active_admin_count integer;
BEGIN
  IF NOT public.is_primary_admin_manager() THEN
    RAISE EXCEPTION 'Only the primary administrator may manage administrator accounts'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR target.role <> 'admin' THEN
    RAISE EXCEPTION 'Administrator account not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF lower(trim(target.email)) = 'paracalejerson05@gmail.com' THEN
    RAISE EXCEPTION 'The primary administrator account cannot be deactivated'
      USING ERRCODE = '42501';
  END IF;
  IF lower(trim(coalesce(target.status, ''))) = 'deactivated' THEN
    RAISE EXCEPTION 'This administrator is already deactivated'
      USING ERRCODE = '23505';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('admin-management'));
  SELECT count(*) INTO active_admin_count
  FROM public.users
  WHERE role = 'admin'
    AND lower(trim(coalesce(status, ''))) IN ('active', 'approved');
  IF active_admin_count <= 1 THEN
    RAISE EXCEPTION 'The last active administrator cannot be deactivated'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.users
  SET status = 'deactivated', updated_at = now()
  WHERE id = target.id
  RETURNING * INTO target;

  RETURN jsonb_build_object(
    'id', target.id,
    'email', target.email,
    'display_name', target.display_name,
    'role', target.role,
    'status', target.status,
    'created_at', target.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_user_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_role text := coalesce(auth.role(), '');
  verified_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  invitation_redemption boolean :=
    current_setting('app.redeeming_admin_invitation', true) = 'true';
BEGIN
  IF request_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'resident'
      AND NOT (
        invitation_redemption
        AND NEW.role = 'admin'
        AND auth.uid() IS NOT NULL
        AND NEW.id = auth.uid()::text
        AND lower(trim(coalesce(NEW.email, ''))) = verified_email
        AND EXISTS (
          SELECT 1 FROM public.admin_invitations
          WHERE email = verified_email
        )
      )
      AND NOT (
        NEW.role = 'admin'
        AND auth.uid() IS NOT NULL
        AND NEW.id = auth.uid()::text
        AND lower(trim(coalesce(NEW.email, ''))) = 'paracalejerson05@gmail.com'
        AND verified_email = 'paracalejerson05@gmail.com'
      ) THEN
      RAISE EXCEPTION 'Only an authorized administrator may create an administrator profile'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
    AND NOT (invitation_redemption AND NEW.role = 'admin') THEN
    RAISE EXCEPTION 'Administrator roles may only be changed by an authorized invitation'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_admin_role() FROM PUBLIC;
DROP TRIGGER IF EXISTS users_guard_admin_role ON public.users;
CREATE TRIGGER users_guard_admin_role
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_admin_role();

CREATE OR REPLACE FUNCTION public.sync_admin_auth_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = lower(trim(NEW.email)), updated_at = now()
    WHERE id = NEW.id::text AND role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_admin_auth_email_to_profile() FROM PUBLIC;
DROP TRIGGER IF EXISTS auth_user_admin_email_sync ON auth.users;
CREATE TRIGGER auth_user_admin_email_sync
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_auth_email_to_profile();

REVOKE ALL ON FUNCTION public.list_admin_management() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_admin_invitation(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_admin_invitation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_managed_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_management() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_invitation(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_admin_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_managed_admin(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
