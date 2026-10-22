import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { AdminSettings } from './AdminSettings';
import { 
  User as UserIcon, 
  Lock, 
  Bell, 
  Sparkles, 
  Shield, 
  Camera, 
  Mail, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Loader2, 
  Calendar, 
  Laptop, 
  Download, 
  Trash2, 
  X,
  Building2,
  Check,
  Palette,
  Sun,
  Moon,
  Monitor,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { syncUserToSupabase } from '../lib/supabaseSync';
import { supabase } from '../lib/supabase';
import { checkProfileCompletion, getAccountStatus } from '../lib/profileUtils';

interface SettingsProps {
  user: any;
  profile: any;
}

type SettingsSection = 'profile' | 'appearance' | 'account' | 'notifications' | 'ai' | 'privacy';

const CONTACT_NUMBER_ERROR = 'Contact number must be 11 digits.';
const AGE_ERROR = 'Age must be between 1 and 99.';

const getContactNumberError = (value: string) => (/^\d{11}$/.test(value) ? '' : CONTACT_NUMBER_ERROR);
const getAgeError = (value: string) => (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99 ? '' : AGE_ERROR);

export function Settings({ user, profile }: SettingsProps) {
  const { theme: themeMode, setTheme } = useTheme();
  const isAdmin = profile?.role === 'admin' || user?.email === 'paracalejerson05@gmail.com';

  if (isAdmin) {
    return <AdminSettings user={user} profile={profile} />;
  }

  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Your settings have been updated successfully.');
  const [showPassword, setShowPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(profile?.photoURL || profile?.photo_url || user?.photoURL || user?.user_metadata?.photoURL || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    fullName: profile?.displayName || profile?.display_name || user?.displayName || '',
    email: user?.email || '',
    contactNumber: profile?.contactNumber || profile?.contact_number || '',
    address: profile?.address || '',
    barangay: profile?.barangay || 'Pupua',
    city: profile?.city || 'Catbalogan City',
    province: profile?.province || 'Samar',
    age: profile?.age !== undefined && profile?.age !== null ? String(profile?.age) : '',
    gender: profile?.gender || 'Male',
    civilStatus: profile?.civilStatus || 'Single'
  });

  const userMetadata = user?.user_metadata || {};

  // Keep form data synced
  useEffect(() => {
    if (profile) {
      setProfileData(prev => ({
        ...prev,
        fullName: profile.displayName || profile.display_name || user?.displayName || prev.fullName,
        email: user?.email || profile.email || prev.email,
        contactNumber: profile.contactNumber !== undefined ? profile.contactNumber : (profile.contact_number !== undefined ? profile.contact_number : prev.contactNumber),
        address: profile.address !== undefined ? profile.address : prev.address,
        barangay: profile.barangay !== undefined ? profile.barangay : prev.barangay,
        city: profile.city !== undefined ? profile.city : prev.city,
        province: profile.province !== undefined ? profile.province : prev.province,
        age: profile.age !== undefined && profile.age !== null ? String(profile.age) : prev.age,
        gender: profile.gender || prev.gender,
        civilStatus: profile.civilStatus || prev.civilStatus
      }));
      if (profile.photoURL !== undefined || profile.photo_url !== undefined || user?.photoURL !== undefined || userMetadata.photoURL !== undefined || userMetadata.avatar_url !== undefined || userMetadata.picture !== undefined) {
        setPreviewImage(profile.photoURL || profile.photo_url || user?.photoURL || userMetadata.photoURL || userMetadata.avatar_url || userMetadata.picture || null);
      }
      if (profile.notificationPrefs || userMetadata.notificationPrefs) {
        setNotifPrefs(prev => ({ ...prev, ...(profile.notificationPrefs || userMetadata.notificationPrefs) }));
      }
      if (profile.aiPrefs || userMetadata.aiPrefs) {
        setAiPrefs(prev => ({ ...prev, ...(profile.aiPrefs || userMetadata.aiPrefs) }));
      }
      if (profile.privacyPrefs || userMetadata.privacyPrefs) {
        setPrivacyPrefs(prev => ({ ...prev, ...(profile.privacyPrefs || userMetadata.privacyPrefs) }));
      }
    }
  }, [profile, user]);

  const completionStatus = checkProfileCompletion(profile || {
    displayName: profileData.fullName,
    email: profileData.email,
    contactNumber: profileData.contactNumber,
    address: profileData.address,
    age: profileData.age,
    gender: profileData.gender,
    civilStatus: profileData.civilStatus
  }, user?.email);

  // Calculate percentage dynamically from profileData state as well
  const fieldsFilled = [
    Boolean(String(profileData.fullName || '').trim()),
    Boolean(String(profileData.email || '').trim()),
    Boolean(String(profileData.contactNumber || '').trim()),
    Boolean(profileData.age && Number(profileData.age) > 0),
    Boolean(String(profileData.gender || '').trim()),
    Boolean(String(profileData.civilStatus || '').trim()),
    Boolean(String(profileData.address || '').trim())
  ].filter(Boolean).length;

  const completionPercentage = Math.round((fieldsFilled / 7) * 100);
  const isProfileFullyComplete = completionPercentage === 100;

  const accountStatus = getAccountStatus(profile, user?.email);

  // Security Form State
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState({
    appointmentReminders: true,
    statusUpdates: true,
    announcements: true,
    emailNotifications: true,
    aiQueueAlerts: true
  });

  // Smart Assistance State (formerly AI Preferences)
  const [aiPrefs, setAiPrefs] = useState({
    queueRecommendations: true,
    smartSuggestions: true,
    aiAssistance: true,
    preferredTime: 'Morning'
  });

  // Privacy State
  const [privacyPrefs, setPrivacyPrefs] = useState({
    visibility: true,
    dataConsent: true
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState({ contactNumber: '', age: '' });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSize = 512;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
          setPreviewImage(canvas.toDataURL('image/jpeg', 0.8));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = String(name || '').trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return String(name || '').slice(0, 2).toUpperCase();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const contactNumberError = getContactNumberError(String(profileData.contactNumber || ''));
    const ageError = getAgeError(String(profileData.age || ''));
    setProfileFieldErrors({ contactNumber: contactNumberError, age: ageError });
    if (contactNumberError || ageError) {
      setError(null);
      return;
    }
    if (!(e.currentTarget as HTMLFormElement).reportValidity()) return;

    setIsSaving(true);
    setError(null);
    setShowSuccess(false);

    try {
      const targetUid = user?.uid || user?.id;
      if (!targetUid) {
        throw new Error('User identifier not found. Please log in again.');
      }

      const synced = await syncUserToSupabase(
          { uid: targetUid, email: user?.email || profileData.email, displayName: profileData.fullName },
          {
            uid: targetUid,
            email: user?.email || profileData.email,
            displayName: profileData.fullName,
            contactNumber: profileData.contactNumber,
            address: profileData.address,
            barangay: profileData.barangay,
            city: profileData.city,
            province: profileData.province,
            age: profileData.age,
            gender: profileData.gender,
            civilStatus: profileData.civilStatus,
            role: profile?.role || 'resident',
            status: profile?.status || 'pending'
          }
        );
      if (!synced) throw new Error('Your profile could not be saved to the application database. Please try again.');

      await supabase.auth.updateUser({
        data: {
          full_name: profileData.fullName,
          display_name: profileData.fullName,
          photoURL: previewImage || null
        }
      });

      setSuccessMessage('Your profile has been updated successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowSuccess(false);

    if (securityData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: securityData.newPassword });
      if (error) throw error;

      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMessage('Your password has been changed successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err.message || 'Failed to update password. You may need to sign in again first.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const targetUid = user?.uid || user?.id;
      if (!targetUid) throw new Error('User ID not found');
      const { error: preferencesError } = await supabase.auth.updateUser({ data: { notificationPrefs: notifPrefs } });
      if (preferencesError) throw preferencesError;
      setSuccessMessage('Notification preferences saved successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save notification settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiPrefs = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const targetUid = user?.uid || user?.id;
      if (!targetUid) throw new Error('User ID not found');
      const { error: preferencesError } = await supabase.auth.updateUser({ data: { aiPrefs } });
      if (preferencesError) throw preferencesError;
      setSuccessMessage('Smart Assistance preferences saved successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save Smart Assistance preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const targetUid = user?.uid || user?.id;
      if (!targetUid) throw new Error('User ID not found');
      const { error: preferencesError } = await supabase.auth.updateUser({ data: { privacyPrefs } });
      if (preferencesError) throw preferencesError;
      setSuccessMessage('Privacy settings updated successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save privacy settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestData = () => {
    const targetUid = user?.uid || user?.id || 'resident';
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      user: {
        uid: targetUid,
        email: user?.email || '',
        displayName: profileData.fullName,
        contactNumber: profileData.contactNumber,
        address: profileData.address,
        barangay: profileData.barangay,
        city: profileData.city,
        province: profileData.province,
      },
      exportDate: new Date().toISOString()
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `barangay_resident_data_${targetUid.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Structured categories matching recommended mobile layout
  const settingsCategories = [
    {
      group: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile', desc: 'Manage your personal information', icon: UserIcon },
        { id: 'account', label: 'Account & Security', desc: 'Password and account security', icon: Lock },
      ]
    },
    {
      group: 'PREFERENCES',
      items: [
        { id: 'appearance', label: 'Appearance', desc: 'Theme and display', icon: Palette },
        { id: 'notifications', label: 'Notifications', desc: 'Notification preferences', icon: Bell },
        { id: 'ai', label: 'Smart Assistance', desc: 'AI and queue recommendations', icon: Sparkles },
      ]
    },
    {
      group: 'PRIVACY',
      items: [
        { id: 'privacy', label: 'Privacy', desc: 'Privacy preferences', icon: Shield },
      ]
    }
  ];

  // Modern Toggle Switch Component
  const Toggle = ({ enabled, onChange, id }: { enabled: boolean; onChange: () => void; id?: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      id={id}
      onClick={onChange}
      className={cn(
        "w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20",
        enabled ? "bg-[#2563EB]" : "bg-[#CBD5E1] dark:bg-slate-700"
      )}
    >
      <div
        className={cn(
          "bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-5 font-['Manrope',sans-serif]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[23px] sm:text-[30px] font-bold text-[#0F172A] dark:text-slate-100 tracking-tight">
            Settings
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5 font-medium">
            Manage your resident profile, security, appearance, and smart preferences.
          </p>
        </div>

        {/* Quick Header Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Profile Status Badge */}
          {isProfileFullyComplete ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ✓ PROFILE COMPLETE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              PROFILE INCOMPLETE
            </span>
          )}

          {/* Account Approval Status Badge */}
          {accountStatus === 'approved' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              🟢 Verified Resident
            </span>
          )}
          {accountStatus === 'pending' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              🟡 Pending Approval
            </span>
          )}
          {accountStatus === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              🔴 Rejected
            </span>
          )}
        </div>
      </div>

      {/* Global Success Banner */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-[14px] flex items-center gap-3 text-emerald-800 dark:text-emerald-300 shadow-2xs text-xs sm:text-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="font-semibold">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 p-3.5 rounded-[14px] flex items-center gap-3 text-red-800 dark:text-red-300 shadow-2xs text-xs sm:text-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="font-semibold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Layout: Mobile-first responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* Left: Grouped Settings Navigation Categories */}
        <div className="lg:col-span-4 space-y-3">
          {settingsCategories.map((groupCat) => (
            <div key={groupCat.group} className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 p-1.5 sm:p-2 shadow-2xs transition-colors duration-200">
              <h3 className="px-3 py-1.5 text-[11px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                {groupCat.group}
              </h3>
              <div className="space-y-1 mt-1">
                {groupCat.items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.id as SettingsSection);
                        setError(null);
                        setShowSuccess(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-[10px] transition-all flex items-center justify-between cursor-pointer group min-h-[44px]",
                        isActive 
                          ? "bg-[#EFF6FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold border border-blue-100 dark:border-blue-900 shadow-2xs" 
                          : "text-[#0F172A] dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-blue-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 transition-colors",
                          isActive ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 group-hover:text-[#2563EB] dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 pr-1">
                          <span className={cn(
                            "block text-xs sm:text-[15px] font-semibold truncate",
                            isActive ? "text-[#2563EB] dark:text-blue-400" : "text-[#0F172A] dark:text-slate-200"
                          )}>
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                            {item.desc}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 flex-shrink-0 transition-transform",
                        isActive ? "text-[#2563EB] dark:text-blue-400 translate-x-0.5" : "text-[#CBD5E1] dark:text-slate-600 group-hover:text-[#2563EB]"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Settings Content Card */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 p-4 sm:p-6 shadow-2xs transition-colors duration-200">
          <AnimatePresence mode="wait">
            {/* =========================================================
                SECTION 1: PROFILE
                ========================================================= */}
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Section Header */}
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100">Profile</h3>
                    <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5 font-normal">Manage your personal information and resident credentials.</p>
                  </div>
                  <div>
                    {isProfileFullyComplete ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ✓ Profile Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Profile Incomplete
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile Completion Card (Highly Visible) */}
                <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">
                        Profile Completion
                      </h4>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {completionPercentage}% of required information completed ({fieldsFilled} of 7 fields)
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400">
                      {completionPercentage}% Complete
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#E2E8F0] dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        isProfileFullyComplete ? "bg-emerald-500" : "bg-[#2563EB]"
                      )}
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>

                  {!isProfileFullyComplete && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Missing: {completionStatus.missingFields.join(', ')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const firstInput = document.getElementById('fullNameInput');
                          firstInput?.focus();
                        }}
                        className="text-xs font-bold text-[#2563EB] dark:text-blue-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                      >
                        <span>Complete Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Resident Approval Status Notice Card */}
                <div className={cn(
                  "p-3.5 sm:p-4 rounded-[12px] border flex items-start gap-3",
                  accountStatus === 'approved' ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200" :
                  accountStatus === 'rejected' ? "bg-red-50/70 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200" :
                  "bg-amber-50/70 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
                )}>
                  {accountStatus === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> :
                   accountStatus === 'rejected' ? <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" /> :
                   <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                  <div className="space-y-1">
                    <p className="text-xs font-bold">
                      Account Status: {accountStatus === 'approved' ? '🟢 Verified Resident' : accountStatus === 'rejected' ? '🔴 Rejected' : '🟡 Pending Approval'}
                    </p>
                    <p className="text-[11px] leading-normal opacity-90">
                      Completing your profile does not automatically mean your account is approved. The barangay administrator must verify and approve your registration before you can submit barangay service requests.
                    </p>
                  </div>
                </div>

                {/* Profile Header Card with Avatar */}
                <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group flex-shrink-0">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                    {previewImage ? (
                      <img 
                        src={previewImage} 
                        alt="Profile" 
                        className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white shadow-xs"
                      />
                    ) : (
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-blue-200 flex items-center justify-center font-bold text-xl sm:text-2xl shadow-2xs">
                        {getInitials(profileData.fullName)}
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                      title="Upload photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-center sm:text-left space-y-1 min-w-0">
                    <h4 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-slate-100 truncate">
                      {profileData.fullName || 'Resident Name'}
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span className="truncate">{user?.email}</span>
                    </p>
                    <p className="text-[11px] text-[#94A3B8] dark:text-slate-500">
                      Upload a clean portrait photo if desired.
                    </p>
                  </div>
                </div>

                {/* Form: Personal Information */}
                <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1">Personal Information</h4>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">All required fields are marked with an asterisk (<span className="text-red-500 font-bold">*</span>).</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Full Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        id="fullNameInput"
                        type="text"
                        required
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="First and Last Name"
                      />
                    </div>

                    {/* Email Address (Read-only) */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Email Address <span className="text-[10px] font-normal text-[#64748B]">(Read-only)</span>
                      </label>
                      <input 
                        type="email"
                        disabled
                        value={profileData.email}
                        className="w-full bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#64748B] dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Contact Number <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        required
                        aria-invalid={Boolean(profileFieldErrors.contactNumber)}
                        value={profileData.contactNumber}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!/^\d*$/.test(value) || value.length > 11) {
                            setProfileFieldErrors(prev => ({ ...prev, contactNumber: CONTACT_NUMBER_ERROR }));
                            return;
                          }
                          setProfileData({ ...profileData, contactNumber: value });
                          setProfileFieldErrors(prev => ({ ...prev, contactNumber: getContactNumberError(value) }));
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="e.g., 09123559082"
                      />
                      {profileFieldErrors.contactNumber && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{profileFieldErrors.contactNumber}</p>}
                    </div>

                    {/* Age */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Age <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        required
                        aria-invalid={Boolean(profileFieldErrors.age)}
                        value={profileData.age}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value !== '' && getAgeError(value)) {
                            setProfileFieldErrors(prev => ({ ...prev, age: AGE_ERROR }));
                            return;
                          }
                          setProfileData({ ...profileData, age: value });
                          setProfileFieldErrors(prev => ({ ...prev, age: getAgeError(value) }));
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="e.g. 28"
                      />
                      {profileFieldErrors.age && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{profileFieldErrors.age}</p>}
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Gender <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select 
                        value={profileData.gender}
                        onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Civil Status */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Civil Status <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select 
                        value={profileData.civilStatus}
                        onChange={(e) => setProfileData({ ...profileData, civilStatus: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                      </select>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="pt-1">
                    <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                      Street Address / House No. <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                      placeholder="Purok 2, Coastal Road"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Barangay <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={profileData.barangay}
                        onChange={(e) => setProfileData({ ...profileData, barangay: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Municipality/City <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={profileData.city}
                        onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Province <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={profileData.province}
                        onChange={(e) => setProfileData({ ...profileData, province: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <span>Save Changes</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* =========================================================
                SECTION 2: APPEARANCE
                ========================================================= */}
            {activeSection === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                    Appearance
                  </h3>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">
                    Customize the visual display theme for your mobile device interface.
                  </p>
                </div>

                {/* Theme Preference Row */}
                <div className="bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <h4 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">
                      Theme Preference
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Switch between clean Light Mode and night-friendly Dark Mode.
                    </p>
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#E2E8F0]/80 dark:bg-slate-900/90 rounded-full border border-[#CBD5E1]/60 dark:border-slate-700/80 shadow-inner self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px]",
                        themeMode === 'light'
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white"
                      )}
                    >
                      <span>☀️</span>
                      <span>Light Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px]",
                        themeMode === 'dark'
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white"
                      )}
                    >
                      <span>🌙</span>
                      <span>Dark Mode</span>
                    </button>
                  </div>
                </div>

                {/* System Default Row */}
                <div className="bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[8px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">
                        System Default
                      </h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                        Automatically synchronize theme with your device settings.
                      </p>
                    </div>
                  </div>

                  <Toggle
                    enabled={themeMode === 'system'}
                    onChange={() => setTheme(themeMode === 'system' ? 'light' : 'system')}
                  />
                </div>
              </motion.div>
            )}

            {/* =========================================================
                SECTION 3: ACCOUNT & SECURITY
                ========================================================= */}
            {activeSection === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100">Account & Security</h3>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">Manage your password, account security, and session status.</p>
                </div>

                {/* Account Status Summary */}
                <div className="p-4 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">Resident Security Record</h4>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">Authenticated via Supabase Secure Auth.</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Secure
                  </span>
                </div>

                {/* Password Form */}
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1">Change Password</h4>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Ensure your account uses a secure password with at least 8 characters.</p>
                  </div>

                  <div className="space-y-3.5 max-w-md">
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                          placeholder="At least 8 characters"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">Confirm New Password</label>
                      <input 
                        type="password"
                        required
                        value={securityData.confirmPassword}
                        onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none transition-colors"
                        placeholder="Re-type new password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>

                {/* Session & Sign Out */}
                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1">Active Session</h4>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Manage your active login session or sign out of the portal.</p>
                  </div>

                  <div className="p-3.5 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-white dark:bg-slate-700 border border-[#E2E8F0] dark:border-slate-600 flex items-center justify-center text-[#2563EB] dark:text-blue-400">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-slate-100">Current Web Browser Session</p>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400">Active now • Barangay Pupua Portal</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                      Active
                    </span>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => supabase.auth.signOut()}
                      className="h-11 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                SECTION 4: NOTIFICATIONS
                ========================================================= */}
            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100">Notifications</h3>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">Choose which notifications and alert channels you want to receive.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Request Status Updates</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Receive immediate notifications when document requests are updated or approved.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.statusUpdates} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, statusUpdates: !notifPrefs.statusUpdates })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Approval / Rejection Notifications</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Get notified when your resident registration or account verification is reviewed.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.announcements} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, announcements: !notifPrefs.announcements })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Appointment / Visit Reminders</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Get timely reminders before your scheduled barangay office visit.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.appointmentReminders} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, appointmentReminders: !notifPrefs.appointmentReminders })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Barangay Announcements</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Stay informed about community advisories, public health notices, and town halls.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.emailNotifications} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, emailNotifications: !notifPrefs.emailNotifications })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Queue Recommendations</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Receive smart recommendations for low-traffic hours and fast processing slots.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.aiQueueAlerts} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, aiQueueAlerts: !notifPrefs.aiQueueAlerts })} 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotifications}
                    disabled={isSaving}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save Notifications</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                SECTION 5: SMART ASSISTANCE (Renamed from AI Preferences)
                ========================================================= */}
            {activeSection === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100">Smart Assistance</h3>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">Configure smart AI features for appointment scheduling and queue optimization.</p>
                </div>

                {/* Smart Assistance Banner */}
                <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-[12px] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">Barangay Pupua Portal Assistant</h4>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Dynamically analyzes foot traffic and suggests optimal appointment times.</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Smart Queue Recommendations</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Receive intelligent recommendations for the best time to visit the barangay hall.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.queueRecommendations} 
                      onChange={() => setAiPrefs({ ...aiPrefs, queueRecommendations: !aiPrefs.queueRecommendations })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Smart Schedule Suggestions</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Allow the system to suggest convenient appointment schedules based on availability.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.smartSuggestions} 
                      onChange={() => setAiPrefs({ ...aiPrefs, smartSuggestions: !aiPrefs.smartSuggestions })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">AI Assistant</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Enable intelligent conversational assistance when requesting barangay services.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.aiAssistance} 
                      onChange={() => setAiPrefs({ ...aiPrefs, aiAssistance: !aiPrefs.aiAssistance })} 
                    />
                  </div>
                </div>

                {/* Preferred Visiting Time Window */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200">Preferred Visiting Time Window</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Morning', 'Afternoon'].map((windowOption) => {
                      const isSelected = aiPrefs.preferredTime === windowOption;
                      return (
                        <button
                          key={windowOption}
                          type="button"
                          onClick={() => setAiPrefs({ ...aiPrefs, preferredTime: windowOption })}
                          className={cn(
                            "p-3.5 rounded-[10px] border text-xs sm:text-sm font-semibold transition-all text-center cursor-pointer",
                            isSelected 
                              ? "bg-[#EFF6FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border-[#2563EB] ring-1 ring-[#2563EB]/20" 
                              : "bg-white dark:bg-slate-800 text-[#64748B] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-700 hover:border-blue-200"
                          )}
                        >
                          {windowOption} ({windowOption === 'Morning' ? '8:00 AM - 12:00 PM' : '1:00 PM - 5:00 PM'})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAiPrefs}
                    disabled={isSaving}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save Smart Assistance</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                SECTION 6: PRIVACY
                ========================================================= */}
            {activeSection === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-slate-100">Privacy</h3>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5">Manage your personal information and data privacy preferences.</p>
                </div>

                {/* Personal Information explanation */}
                <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-slate-100">Personal Information Preferences</h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                    Your personal information is securely stored and used strictly to process official barangay documents, community certifications, and resident identity verification in compliance with data privacy standards.
                  </p>
                </div>

                {/* Data & Privacy Preferences Toggles */}
                <div className="space-y-3.5">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Profile Visibility</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Allow authorized barangay staff to view verified profile details during processing.</p>
                    </div>
                    <Toggle 
                      enabled={privacyPrefs.visibility} 
                      onChange={() => setPrivacyPrefs({ ...privacyPrefs, visibility: !privacyPrefs.visibility })} 
                    />
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Data Processing Consent</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Consent to administrative data verification for clearance and permit issuance.</p>
                    </div>
                    <Toggle 
                      enabled={privacyPrefs.dataConsent} 
                      onChange={() => setPrivacyPrefs({ ...privacyPrefs, dataConsent: !privacyPrefs.dataConsent })} 
                    />
                  </div>
                </div>

                {/* Account Data Export */}
                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1">Your Account Data</h4>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Download a copy of your personal data or manage your account records.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleRequestData}
                      className="h-11 px-5 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                      <span>Request My Data (JSON)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePrivacy}
                    disabled={isSaving}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save Privacy Settings</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
