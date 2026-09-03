import React, { useState } from 'react';
import { auth, db, firebaseConfig } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { 
  LogIn, 
  UserPlus, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Key,
  User as UserIcon,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { BARANGAY_LOGO_URL, BARANGAY_LOGO_FALLBACK, SYSTEM_NAME } from '../constants';

interface AuthProps {
  onAuthSuccess: (user: any, profile: any) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'complete-profile';

export function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tempUser, setTempUser] = useState<any>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setError(null);
    setSuccessMessage(null);
    setIsPendingApproval(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        if (user.email === 'paracalejerson05@gmail.com') {
          const profile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'System Admin',
            role: 'admin',
            status: 'approved',
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'users', user.uid), profile);
          onAuthSuccess(user, profile);
          return;
        }
        
        setTempUser(user);
        setMode('complete-profile');
        return;
      }
      
      const profile = userDoc.data();

      if (profile.role === 'resident' && profile.status !== 'approved') {
        if (profile.status === 'pending') {
          setIsPendingApproval(true);
          await auth.signOut();
          return;
        } else if (profile.status === 'disapproved') {
          await auth.signOut();
          throw new Error('Your account registration was disapproved. Please contact the Barangay Hall for clarification.');
        } else if (profile.status === 'inactive') {
          await auth.signOut();
          throw new Error('Your account is currently inactive. Please contact the barangay administrator.');
        }
      }
      
      await setDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp()
      }, { merge: true });

      onAuthSuccess(user, { ...profile, lastLoginAt: new Date() });
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.message || '';
      const errorCode = err.code || '';

      if (errorCode === 'auth/operation-not-allowed') {
        setError(
          `Email/Password authentication is not enabled for project "${firebaseConfig.projectId}". Please enable it in the Firebase Console.`
        );
      } else if (
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/invalid-email'
      ) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(errorMessage || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName });

      const profile = {
        uid: user.uid,
        email: user.email,
        displayName: fullName,
        age: 0,
        role: 'resident',
        status: 'pending',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), profile);

      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: 'New Resident Registration',
        message: `${fullName} has registered and is pending approval.`,
        type: 'info',
        read: false,
        createdAt: serverTimestamp(),
      });

      setMode('login');
      resetForm();
      setIsPendingApproval(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered.');
      } else {
        setError(err.message || 'Failed to create account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateProfile(tempUser, { displayName: fullName });

      const profile = {
        uid: tempUser.uid,
        email: tempUser.email,
        displayName: fullName,
        age: 0,
        role: 'resident',
        status: 'pending',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', tempUser.uid), profile);

      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: 'New Resident Registration',
        message: `${fullName} has registered and is pending approval.`,
        type: 'info',
        read: false,
        createdAt: serverTimestamp(),
      });
      
      setMode('login');
      resetForm();
      setIsPendingApproval(true);
    } catch (err: any) {
      console.error('Complete profile error:', err);
      setError(err.message || 'Failed to complete profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('Password reset link sent! Please check your email inbox.');
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('Failed to send reset email. Please ensure your email is correct.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1E293B]">Registration Pending</h2>
          <p className="text-sm text-[#64748B] leading-relaxed">
            Your account has been successfully created and is currently awaiting approval from the Barangay Administrator.
          </p>
          <div className="pt-4 border-t border-[#E2E8F0] mt-6">
            <p className="text-xs text-[#94A3B8] mb-4">
              You will be able to sign in once your account is verified.
            </p>
            <button
              onClick={() => setIsPendingApproval(false)}
              className="w-full py-2.5 bg-white border border-[#E2E8F0] text-[#1E293B] text-sm font-semibold rounded-[10px] hover:bg-[#F8FAFC] transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-[960px] relative mx-auto">
        
        {/* WHITE CARD (LEFT) */}
        <div className="z-20 w-full md:w-[460px] bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-8 md:p-10 flex-shrink-0 md:-mr-12 my-8 md:my-0 order-2 md:order-1 border border-[#F1F5F9] relative overflow-hidden">
          
          {/* Form Header */}
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="w-14 h-14 bg-[#F8FAFC] rounded-full flex items-center justify-center shadow-sm border border-[#E2E8F0] overflow-hidden">
              <UserIcon className="w-6 h-6 text-[#64748B]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#1E293B] inline-block border-b-2 border-gray-300 pb-1 px-2">
                {mode === 'login' ? 'Welcome Back!' : mode === 'signup' ? 'Create Account' : mode === 'forgot-password' ? 'Reset Password' : 'Complete Profile'}
              </h2>
              {mode === 'login' && (
                <p className="text-xs font-medium text-[#64748B] mt-2">
                  Sign in to continue
                </p>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-3 text-red-600 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-[10px] flex items-start gap-3 text-emerald-700 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={
            mode === 'login' ? handleLogin : 
            mode === 'signup' ? handleSignup : 
            mode === 'complete-profile' ? handleCompleteProfile :
            handleForgotPassword
          } className="space-y-4">
            
            {/* Extra Fields for Registration */}
            {(mode === 'signup' || mode === 'complete-profile') && (
              <div className="flex items-center w-full bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden relative shadow-sm h-11 focus-within:border-[#3B82F6] focus-within:ring-[3px] focus-within:ring-[#3B82F6]/20 transition-all duration-300">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#00126b] rounded-r-md"></div>
                <div className="pl-4 pr-3 text-[#94A3B8]">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="w-px h-5 bg-[#E2E8F0]"></div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="flex-1 py-2 px-3 outline-none text-sm text-[#1E293B] placeholder:text-[#94A3B8] bg-transparent"
                />
              </div>
            )}

            {/* Email Field */}
            {mode !== 'complete-profile' && (
              <div className="flex items-center w-full bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden relative shadow-sm h-11 focus-within:border-[#3B82F6] focus-within:ring-[3px] focus-within:ring-[#3B82F6]/20 transition-all duration-300">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#00126b] rounded-r-md"></div>
                <div className="pl-4 pr-3 text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="w-px h-5 bg-[#E2E8F0]"></div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 py-2 px-3 outline-none text-sm text-[#1E293B] placeholder:text-[#94A3B8] bg-transparent"
                />
              </div>
            )}

            {/* Password Field */}
            {mode !== 'forgot-password' && mode !== 'complete-profile' && (
              <div className="flex items-center w-full bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden relative shadow-sm h-11 focus-within:border-[#3B82F6] focus-within:ring-[3px] focus-within:ring-[#3B82F6]/20 transition-all duration-300">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#00126b] rounded-r-md"></div>
                <div className="pl-4 pr-3 text-[#94A3B8]">
                  <Key className="w-4 h-4" />
                </div>
                <div className="w-px h-5 bg-[#E2E8F0]"></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? "Enter your password" : "Create your password"}
                  className="flex-1 py-2 px-3 outline-none text-sm text-[#1E293B] placeholder:text-[#94A3B8] bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pr-3 text-[#94A3B8] hover:text-[#475569] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Confirm Password Field */}
            {mode === 'signup' && (
              <div className="flex items-center w-full bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden relative shadow-sm h-11 focus-within:border-[#3B82F6] focus-within:ring-[3px] focus-within:ring-[#3B82F6]/20 transition-all duration-300">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#00126b] rounded-r-md"></div>
                <div className="pl-4 pr-3 text-[#94A3B8]">
                  <Key className="w-4 h-4" />
                </div>
                <div className="w-px h-5 bg-[#E2E8F0]"></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="flex-1 py-2 px-3 outline-none text-sm text-[#1E293B] placeholder:text-[#94A3B8] bg-transparent"
                />
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            {mode === 'login' && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={cn(
                    "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors",
                    rememberMe ? "bg-[#00126b] border-[#00126b]" : "bg-white border-[#CBD5E1] group-hover:border-[#00126b]"
                  )}>
                    {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs text-[#64748B] font-medium">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot-password');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-medium text-[#64748B] hover:text-[#00126b] transition-colors"
                >
                  Forget password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-6 bg-[#00126b] hover:bg-[#000a42] text-white font-semibold text-sm rounded-[8px] transition-colors duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>LOG IN</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>SIGN UP</span>
                </>
              ) : mode === 'complete-profile' ? (
                <span>Complete Profile</span>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>
          </form>

          {/* Secondary Actions */}
          <div className="mt-6 text-center">
            {mode === 'login' ? (
              <p className="text-[11px] text-[#94A3B8] hidden md:block mt-6 pt-4 border-t border-[#F1F5F9]">
                Barangay Pupua Smart Appointment System © 2026
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00126b] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Already have an account? Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* BLUE PANEL (RIGHT) */}
        <div className="z-10 w-full md:flex-1 h-[620px] bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#3B82F6] rounded-[24px] shadow-2xl overflow-hidden relative md:flex flex-col items-center justify-center text-center p-10 md:pl-20 order-1 md:order-2 hidden">
          
          {/* Background SVG Blobs */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 500 500">
            {/* Top Left Organic Blob */}
            <path 
              d="M0,0 L280,0 C280,80 200,120 150,220 C100,320 0,250 0,250 Z" 
              fill="#1D4ED8" 
              opacity="0.8" 
              style={{ filter: 'drop-shadow(4px 8px 12px rgba(0,0,0,0.15))' }} 
            />
            
            {/* Bottom Right Curved Blob */}
            <path 
              d="M500,500 L500,200 C450,200 400,280 300,320 C200,360 250,500 250,500 Z" 
              fill="#1E40AF" 
              opacity="0.7" 
              style={{ filter: 'drop-shadow(-4px -8px 12px rgba(0,0,0,0.15))' }} 
            />

            {/* Bottom Left Small Blob */}
            <path 
              d="M0,500 L180,500 C180,450 140,400 80,420 C20,440 0,380 0,380 Z" 
              fill="#2563EB" 
              opacity="0.6" 
              style={{ filter: 'drop-shadow(2px -4px 8px rgba(0,0,0,0.1))' }} 
            />

            {/* Middle Right Edge Blob */}
            <path 
              d="M500,250 C480,250 440,280 440,320 C440,360 480,400 500,400 Z" 
              fill="#1E3A8A" 
              opacity="0.9" 
              style={{ filter: 'drop-shadow(-2px 0px 8px rgba(0,0,0,0.15))' }} 
            />
          </svg>

          {/* Content */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 text-white flex flex-col items-center max-w-sm ml-auto mr-12 text-center"
          >
            <img 
              src={BARANGAY_LOGO_URL} 
              alt="Barangay Pupua Logo" 
              className="w-[90px] h-[90px] object-cover rounded-full mb-6 shadow-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = BARANGAY_LOGO_FALLBACK;
              }}
            />
            <h2 className="text-2xl font-bold tracking-wider mb-2 drop-shadow-sm flex flex-col items-center gap-1">
              {mode === 'login' ? (
                <>
                  <span className="text-sm tracking-widest text-blue-200 font-semibold uppercase">WELCOME TO</span>
                  <span>BRGY. PUPUA</span>
                </>
              ) : 'WELCOME BACK!'}
            </h2>
            <p className="text-xs text-blue-100 mb-8 font-medium leading-relaxed">
              {mode === 'login' 
                ? 'Your gateway to faster and smarter barangay services.' 
                : 'To keep connected with us please login with your personal info'}
            </p>
            
            {mode === 'login' ? (
              <button 
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="px-10 py-2.5 bg-[#00126b] hover:bg-[#000a42] text-white rounded-[6px] font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                SIGNUP
              </button>
            ) : (
              <button 
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="px-10 py-2.5 bg-[#00126b] hover:bg-[#000a42] text-white rounded-[6px] font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                SIGN IN
              </button>
            )}
          </motion.div>
        </div>

        {/* Mobile View Toggle Button (Only visible on small screens) */}
        <div className="md:hidden w-full max-w-[460px] mt-4 z-20 order-3">
          <div className="bg-white rounded-[16px] shadow-sm border border-[#E2E8F0] p-6 text-center">
            <h3 className="text-[#1E293B] font-bold text-lg mb-2">
              {mode === 'login' ? 'New to the portal?' : 'Already have an account?'}
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              {mode === 'login' 
                ? 'Create a resident account to access barangay services online.' 
                : 'Sign in to manage your appointments and requests.'}
            </p>
            <button 
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setSuccessMessage(null);
              }}
              className="w-full py-2.5 bg-[#00126b] hover:bg-[#000a42] text-white rounded-[8px] font-semibold text-sm transition-all shadow-md"
            >
              {mode === 'login' ? 'SIGN UP NOW' : 'SIGN IN INSTEAD'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
