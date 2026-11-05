import React, { useEffect, useRef, useState } from 'react';
import { 
  LogIn, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Key,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { BARANGAY_LOGO_URL, BARANGAY_LOGO_FALLBACK, SYSTEM_NAME } from '../constants';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dbAddNotification, dbGetUserById } from '../lib/supabaseDb';
import { ResidentRegistrationForm, ResidentRegistrationSubmission } from './ResidentRegistrationForm';
import { apiUrl } from '../lib/api';
import { checkProfileCompletion } from '../lib/profileUtils';

interface AuthProps {
  onAuthSuccess: (user: any, profile: any) => void;
  registrationUser?: any;
  existingProfile?: any;
  pendingApprovalEmail?: string;
  passwordRecovery?: boolean;
  onPasswordRecoveryExit?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'complete-profile' | 'update-password';

function getOAuthCallbackError() {
  if (typeof window === 'undefined') return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorCode = query.get('error') || hash.get('error') || query.get('error_code') || hash.get('error_code');
  if (!errorCode) return null;
  if (errorCode === 'otp_expired') {
    return 'This password reset link has expired or was already used. Request a new reset link.';
  }
  return errorCode === 'access_denied'
    ? 'Social sign-in was cancelled. You can try again.'
    : 'Social sign-in could not be completed. Check the provider setup and try again.';
}

const IntroBackground = () => (
  <div className="auth-background absolute inset-0 overflow-hidden">
    <div className="auth-ambient absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/30 blur-[100px]"></div>
    <div className="auth-ambient absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/30 blur-[100px]"></div>
    <div className="auth-ambient absolute top-[20%] right-[20%] w-[20%] h-[20%] rounded-full bg-indigo-300/20 blur-[80px]"></div>
  </div>
);

const IntroForeground = ({
  onGetStarted,
  prefersReducedMotion,
  isTransitioning
}: {
  onGetStarted: () => void;
  prefersReducedMotion: boolean;
  isTransitioning: boolean;
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      {/* LOGO */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.84 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.68, ease: [0.22, 0.72, 0.18, 1] }}
        className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mb-8 flex-shrink-0 relative"
      >
        <div className="absolute inset-[-18px] rounded-full bg-blue-400/15 blur-xl"></div>
        <img
          src={BARANGAY_LOGO_URL}
          alt="Barangay Pupua Logo"
          className="welcome-logo-rotation w-full h-full object-cover rounded-full shadow-2xl relative z-10 border border-white/10"
          style={{ filter: 'drop-shadow(0 8px 18px rgba(18, 46, 117, 0.24))' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = BARANGAY_LOGO_FALLBACK;
          }}
        />
      </motion.div>

      {/* TEXT & BUTTON */}
      <div className="flex flex-col items-center text-center">
        <motion.h1
          animate={{ opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.72, duration: prefersReducedMotion ? 0 : 0.42, ease: 'easeOut' }}
          className="text-xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-2 whitespace-nowrap"
        >
          {SYSTEM_NAME}
        </motion.h1>

        <motion.h2
          animate={{ opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.9, duration: prefersReducedMotion ? 0 : 0.42, ease: 'easeOut' }}
          className="text-[11px] md:text-xs font-bold tracking-[0.25em] text-blue-300 uppercase mb-6 whitespace-nowrap"
        >
          SMART PUBLIC SERVICE PORTAL
        </motion.h2>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          transition={{ delay: prefersReducedMotion ? 0 : 1.08, duration: prefersReducedMotion ? 0 : 0.44, ease: 'easeOut' }}
          className="text-sm md:text-base text-blue-100/90 font-medium leading-relaxed max-w-[320px] mb-10"
        >
          Making barangay services simpler, faster, and more accessible for every resident.
        </motion.p>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          transition={{ delay: prefersReducedMotion ? 0 : 1.32, duration: prefersReducedMotion ? 0 : 0.44, ease: 'easeOut' }}
          className="pointer-events-auto"
        >
          <button
            onClick={onGetStarted}
            disabled={isTransitioning}
            className="h-12 px-8 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-full font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300 hover:-translate-y-1 flex items-center justify-center gap-2 border border-blue-400/30"
          >
            <span>GET STARTED</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
    <path fill="#4285F4" d="M23.49 12.27c0-.78-.07-1.53-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v2.95h3.87c2.27-2.09 3.57-5.17 3.57-8.8Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.26v3.09A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.25 14.25a7.22 7.22 0 0 1 0-4.5V6.66H1.26a12 12 0 0 0 0 10.68l3.99-3.09Z" />
    <path fill="#EA4335" d="M12 4.78c1.77 0 3.35.61 4.6 1.8l3.45-3.45A11.58 11.58 0 0 0 12 0 12 12 0 0 0 1.26 6.66l3.99 3.09C6.2 6.9 8.86 4.78 12 4.78Z" />
  </svg>
);

const GoogleSignInButton = ({
  isLoading,
  isAvailable,
  onClick
}: {
  isLoading: boolean;
  isAvailable: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={isLoading || !isAvailable}
    onClick={onClick}
    title={isAvailable ? 'Continue with Google' : 'Google sign-in is not configured'}
    className="auth-google-button w-full min-h-[50px] rounded-xl border border-slate-300 font-semibold text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
  >
    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />}
    <span>Continue with Google</span>
  </button>
);

export function Auth({
  onAuthSuccess,
  registrationUser,
  existingProfile,
  pendingApprovalEmail,
  passwordRecovery = false,
  onPasswordRecoveryExit
}: AuthProps) {
  const prefersReducedMotion = useReducedMotion();
  const googleOAuthAvailable = isSupabaseConfigured;
  const transitionStarted = useRef(false);
  const [flipDirection, setFlipDirection] = useState(1);
  const [mode, setMode] = useState<AuthMode>(() => {
    if (passwordRecovery) {
      return getOAuthCallbackError() ? 'forgot-password' : 'update-password';
    }
    if (registrationUser) return 'complete-profile';
    if (pendingApprovalEmail) return 'login';
    if (typeof window === 'undefined') return 'login';
    return Boolean(window.sessionStorage.getItem('resident-oauth-error')) || new URLSearchParams(window.location.search).get('auth_mode') === 'signup'
      ? 'signup'
      : 'login';
  });
  const [currentScreen, setCurrentScreen] = useState<'intro' | 'transitioning' | 'auth'>(() => {
    if (passwordRecovery) return 'auth';
    if (registrationUser) return 'auth';
    if (pendingApprovalEmail) return 'auth';
    if (typeof window === 'undefined') return 'intro';
    return Boolean(window.sessionStorage.getItem('resident-oauth-error') || getOAuthCallbackError()) || new URLSearchParams(window.location.search).get('auth_mode') === 'signup'
      ? 'auth'
      : 'intro';
  });
  
  const handleGetStarted = () => {
    if (transitionStarted.current) return;
    transitionStarted.current = true;
    setCurrentScreen('transitioning');
    setTimeout(() => {
      setCurrentScreen('auth');
    }, prefersReducedMotion ? 0 : 420);
  };

  // States
  const [email, setEmail] = useState(pendingApprovalEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedError = window.sessionStorage.getItem('resident-oauth-error');
    if (storedError) window.sessionStorage.removeItem('resident-oauth-error');
    return storedError || getOAuthCallbackError();
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const registrationInProgress = useRef(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has('auth_mode')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (passwordRecovery) {
      setCurrentScreen('auth');
      setMode(getOAuthCallbackError() ? 'forgot-password' : 'update-password');
      setError(getOAuthCallbackError());
      setSuccessMessage(null);
      return;
    }
    if (mode === 'update-password') setMode('login');
  }, [passwordRecovery]);

  useEffect(() => {
    if (registrationUser) {
      setCurrentScreen('auth');
      setMode('complete-profile');
      setEmail(registrationUser.email || '');
    }
  }, [registrationUser?.id]);

  useEffect(() => {
    if (pendingApprovalEmail) {
      setCurrentScreen('auth');
      setMode('login');
      setEmail(pendingApprovalEmail);
      setPassword('');
      setError(null);
      setSuccessMessage('Your registration is complete and is waiting for administrator approval. You can sign in after your account has been approved.');
    }
  }, [pendingApprovalEmail]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password
      });

      if (signInErr) throw signInErr;
      const authUser = data.user;
      if (!authUser) throw new Error('Authentication failed.');

      const mappedUser = {
        uid: authUser.id,
        email: authUser.email,
        displayName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.display_name || email.split('@')[0],
        photoURL: authUser.user_metadata?.photoURL || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        user_metadata: authUser.user_metadata
      };

      let profile = await dbGetUserById(authUser.id);
      if (!profile) {
        profile = {
          uid: authUser.id,
          id: authUser.id,
          email: authUser.email,
          displayName: mappedUser.displayName,
          role: 'resident',
          status: 'pending',
          lastLoginAt: new Date().toISOString()
        };
      }

      const profileIsComplete = profile.role !== 'admin'
        && checkProfileCompletion(profile, authUser.email).isComplete;
      const isAwaitingApproval = profileIsComplete
        && !(
          ['approved', 'active'].includes(String(profile.status || '').toLowerCase())
          && String(profile.verification_status || '').toLowerCase() === 'approved'
        );
      if (isAwaitingApproval) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('[Resident Login] Could not sign out a resident awaiting approval:', signOutError.message);
        }
        setMode('login');
        setCurrentScreen('auth');
        setEmail(authUser.email || String(email || '').trim());
        setPassword('');
        setSuccessMessage('Your registration is complete and is waiting for administrator approval. You can sign in after your account has been approved.');
        if (signOutError) {
          setError('Your account is still pending approval. We could not end this session automatically; refresh the page and wait for administrator approval.');
        }
        return;
      }

      onAuthSuccess(mappedUser, profile);
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (submission: ResidentRegistrationSubmission) => {
    if (registrationInProgress.current) return;
    registrationInProgress.current = true;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    const uploadedPaths: string[] = [];
    try {
      const { data: currentSession } = await supabase.auth.getSession();
      let authUser = currentSession.session?.user;
      if (authUser && authUser.email?.toLowerCase() !== submission.email.toLowerCase()) {
        throw new Error('A different account is already signed in. Sign out before creating a resident account.');
      }
      if (!authUser) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: submission.email,
          password: submission.password,
          options: {
            data: {
              full_name: submission.fullName,
              display_name: submission.fullName
            }
          }
        });
        if (signUpErr) {
          console.error('[Resident Registration] Supabase Auth account creation failed:', signUpErr.message);
          if (/database error saving new user/i.test(signUpErr.message)) {
            throw new Error('Supabase could not create the initial pending resident profile. Run the updated database_resident_registration.sql migration in the Supabase SQL Editor, then try again. If the error continues, check Supabase Postgres Logs for a failing auth.users trigger.');
          }
          throw signUpErr;
        }
        authUser = data.user;
        if (!authUser) throw new Error('Account creation failed.');
        if (!data.session) {
          setEmail(submission.email);
          setPassword('');
          setMode('login');
          setSuccessMessage('Your account was created. Verify your email, then sign in to finish your resident information and identity documents. Your account will remain pending until an administrator approves it.');
          return;
        }
      }
      if (!authUser) throw new Error('Account creation failed.');

      const uploadImage = async (file: File | null, label: string) => {
        if (!file) return null;
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${authUser!.id}/${label}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('resident-verification')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          if (/bucket not found|resident-verification/i.test(uploadError.message)) {
            throw new Error('Private identity storage is not configured. An administrator must run database_resident_registration.sql in the Supabase SQL Editor.');
          }
          throw new Error(`Could not securely upload ${label.replaceAll('-', ' ')}: ${uploadError.message}`);
        }
        uploadedPaths.push(path);
        return path;
      };

      const newFrontPath = await uploadImage(submission.idFrontFile, 'id-front');
      const newBackPath = await uploadImage(submission.idBackFile, 'id-back');
      const newFacePath = submission.faceRegistrationMethod === 'in_person'
        ? null
        : await uploadImage(submission.faceFile, 'face');
      const frontPath = newFrontPath || existingProfile?.id_front_path || null;
      const backPath = newBackPath || existingProfile?.id_back_path || null;
      const facePath = submission.faceRegistrationMethod === 'in_person'
        ? null
        : newFacePath || existingProfile?.face_photo_path || null;
      const replacedPaths = [
        newFrontPath ? existingProfile?.id_front_path : null,
        newBackPath ? existingProfile?.id_back_path : null,
        (newFacePath || submission.faceRegistrationMethod === 'in_person') ? existingProfile?.face_photo_path : null
      ].filter((path): path is string => typeof path === 'string' && path.startsWith(`${authUser!.id}/`));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your sign-in session is missing. Sign in again to securely finish registration.');
      }
      const validationResponse = await fetch(apiUrl('/api/resident-registration/validate-uploads'), {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          identity: {
            idFrontPath: frontPath,
            idBackPath: backPath,
            facePhotoPath: facePath,
            faceRegistrationMethod: submission.faceRegistrationMethod
          }
        })
      });
      const validationResult = await validationResponse.json().catch(() => ({}));
      if (!validationResponse.ok || !validationResult.valid) {
        throw new Error(validationResult.error || `Identity image validation failed with HTTP ${validationResponse.status}.`);
      }

      const houseStreet = submission.houseStreet.trim();
      const address = [
        houseStreet,
        submission.purokSitio,
        submission.barangay,
        submission.municipalityCity,
        submission.province
      ].filter(Boolean).join(', ');

      const registrationProfile = {
        id: authUser.id,
        email: authUser.email,
        display_name: submission.fullName,
        role: 'resident',
        status: 'pending',
        verification_status: 'pending',
        date_of_birth: submission.dateOfBirth,
        age: submission.age,
        gender: submission.gender,
        civil_status: submission.civilStatus,
        contact_number: submission.mobileNumber,
        address,
        house_street: houseStreet || null,
        purok_sitio: submission.purokSitio,
        barangay: submission.barangay,
        municipality_city: submission.municipalityCity,
        province: submission.province,
        id_type: submission.idType,
        id_type_other: submission.idTypeOther || null,
        id_front_path: frontPath,
        id_back_path: backPath,
        face_photo_path: facePath,
        face_registration_method: submission.faceRegistrationMethod,
        privacy_consent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('users')
        .upsert(registrationProfile, { onConflict: 'id' })
        .select('*')
        .single();
      if (profileError) {
        throw new Error(/column .* does not exist|schema cache/i.test(profileError.message)
          ? 'Resident registration fields are not installed in Supabase. Run database_resident_registration.sql, then try again.'
          : profileError.message);
      }

      if (replacedPaths.length > 0) {
        const { error: oldFileCleanupError } = await supabase.storage.from('resident-verification').remove(replacedPaths);
        if (oldFileCleanupError) {
          console.error('Resident registration succeeded, but superseded private images could not be removed:', oldFileCleanupError.message);
        }
      }

      try {
        await dbAddNotification({
          userId: 'admin',
          title: 'New Resident Registration',
          message: `${submission.fullName} has completed registration and is pending manual verification.`,
          type: 'info'
        });
      } catch (notificationError) {
        console.error('Unable to notify administrators about the new resident:', notificationError);
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('[Resident Registration] Registration was saved, but sign-out failed:', signOutError.message);
      }
      setMode('login');
      setCurrentScreen('auth');
      setEmail(submission.email);
      setPassword('');
      setSuccessMessage('Your registration has been submitted and is waiting for administrator approval. You are now signed out. Please sign in after your account has been approved.');
      if (signOutError) {
        setError('Your registration was saved, but we could not end this session automatically. Refresh the page; your account will remain unavailable until an administrator approves it.');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from('resident-verification').remove(uploadedPaths);
        if (cleanupError) {
          console.error('Failed to clean up incomplete resident verification uploads:', cleanupError.message);
          setError(`${err.message || 'Failed to complete registration.'} Some uploaded files could not be cleaned up. Contact the barangay administrator before retrying.`);
        } else {
          setError(err.message || 'Failed to complete registration. Your uploaded files were removed; please retry.');
        }
      } else {
        setError(err.message || 'Failed to complete registration.');
      }
    } finally {
      registrationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/?auth_mode=signup`
        }
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Could not start Google sign-in.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), {
        redirectTo: `${window.location.origin}/?auth_mode=recovery`
      });
      if (error) throw error;
      setSuccessMessage('If an account exists for that email, password reset instructions will arrive shortly. Check your inbox and spam folder.');
    } catch (err: any) {
      console.error('[Password Recovery] Could not request a reset email:', err?.message || 'unknown error');
      setError('We could not send password reset instructions right now. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (/session.*missing|jwt.*expired|token.*expired|refresh token/i.test(updateError.message)) {
          throw new Error('This password reset link is invalid or has expired. Request a new reset link.');
        }
        throw updateError;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('[Password Recovery] Password changed but sign-out failed:', signOutError.message);
        setSuccessMessage('Your password has been updated. Sign in with your new password to continue.');
      } else {
        setSuccessMessage('Your password has been updated. Sign in with your new password to continue.');
      }
      setPassword('');
      setConfirmPassword('');
      setMode('login');
      onPasswordRecoveryExit?.();
    } catch (err: any) {
      console.error('[Password Recovery] Could not update password:', err?.message || 'unknown error');
      setError(err instanceof Error && /password reset link/i.test(err.message)
        ? err.message
        : 'We could not update your password. The reset link may have expired; request a new one and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitPasswordRecovery = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setPassword('');
      setConfirmPassword('');
      setMode('login');
      setSuccessMessage(null);
      onPasswordRecoveryExit?.();
    } catch (err: any) {
      console.error('[Password Recovery] Could not end the recovery session:', err?.message || 'unknown error');
      setError('We could not safely end the reset session. Please refresh the page and request a new reset link if needed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen w-full relative flex items-center justify-center overflow-x-hidden font-sans">
      <IntroBackground />
      {currentScreen !== 'auth' && (
        <motion.div
          initial={false}
          animate={currentScreen === 'transitioning'
            ? { opacity: 0, scale: 0.985, y: -8 }
            : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: [0.22, 0.72, 0.18, 1] }}
          className="absolute inset-0"
        >
          <IntroForeground
            onGetStarted={handleGetStarted}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            isTransitioning={currentScreen === 'transitioning'}
          />
        </motion.div>
      )}

      {currentScreen === 'auth' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
          className="auth-scene relative z-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, rotateY: prefersReducedMotion ? 0 : -flipDirection * 55 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: flipDirection * 55 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.58, ease: [0.42, 0, 0.58, 1] }}
              style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              className="auth-card p-5 sm:p-8"
            >
          {/* HEADER */}
          <div className="auth-header flex flex-col items-center text-center mb-6 sm:mb-7">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }}
              className="auth-logo w-[72px] h-[72px] sm:w-[76px] sm:h-[76px] mb-3 sm:mb-4 rounded-full bg-white border border-blue-100 flex items-center justify-center shadow-md shadow-blue-900/10"
            >
              <img
                src={BARANGAY_LOGO_URL}
                alt="Barangay Pupua seal"
                className="w-[64px] h-[64px] sm:w-[68px] sm:h-[68px] rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BARANGAY_LOGO_FALLBACK;
                }}
              />
            </motion.div>
            <h2 className="text-[26px] sm:text-[28px] font-bold leading-tight text-slate-900 tracking-tight">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Create Resident Account'}
              {mode === 'forgot-password' && 'Reset Password'}
              {mode === 'update-password' && 'Choose a New Password'}
              {mode === 'complete-profile' && 'Complete Resident Registration'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login' && 'Sign in to access your barangay portal'}
              {mode === 'signup' && 'Register as a resident of Barangay Pupua'}
              {mode === 'forgot-password' && 'Enter your email to receive recovery instructions'}
              {mode === 'update-password' && 'Enter and confirm your new account password'}
              {mode === 'complete-profile' && 'Finish your profile and identity verification for administrator review'}
            </p>
            {mode === 'login' && (
              <span className="auth-role mt-2 text-[13px] font-medium text-slate-500">
                For Residents and Administrators
              </span>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{typeof error === 'string' ? error : 'An error occurred'}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="auth-login-form space-y-3.5 sm:space-y-4">
              <div>
              <label htmlFor="login-email" className="block text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-[50px] pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-[13px] font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot-password'); setError(null); setSuccessMessage(null); }}
                    className="min-h-[44px] px-1 text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[50px] pl-10 pr-12 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 rounded-lg"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex min-h-[44px] items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-600 text-sm">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-primary-button w-full min-h-[50px] bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Sign In</span>
              </button>

              <div className="auth-login-options flex flex-col items-center gap-3 pt-3 border-t border-slate-100">
                <div className="flex w-full items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-500">OR</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <GoogleSignInButton isLoading={isLoading} isAvailable={googleOAuthAvailable} onClick={handleSocialSignIn} />
                <p className="text-sm text-slate-600 text-center">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setFlipDirection(1); setMode('signup'); resetForm(); }}
                    className="min-h-[44px] font-bold text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    Register as Resident
                  </button>
                </p>
              </div>
            </form>
          )}

          {(mode === 'signup' || mode === 'complete-profile') && (
            <ResidentRegistrationForm
              existingUser={registrationUser}
              existingProfile={existingProfile}
              isLoading={isLoading}
              error={typeof error === 'string' ? error : null}
              successMessage={successMessage}
              onSubmit={handleSignup}
              onGoogleSignIn={handleSocialSignIn}
              onSignIn={() => {
                if (registrationUser) {
                  void supabase.auth.signOut();
                  return;
                }
                setFlipDirection(-1);
                setMode('login');
                resetForm();
              }}
            />
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="recovery-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>Send Reset Link</span>
              </button>

              <div className="text-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (passwordRecovery) {
                      void handleExitPasswordRecovery();
                    } else {
                      setMode('login');
                      resetForm();
                    }
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}

          {mode === 'update-password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Enter your new password again"
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>Update Password</span>
              </button>
              <div className="text-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleExitPasswordRecovery()}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 mx-auto disabled:opacity-60"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
