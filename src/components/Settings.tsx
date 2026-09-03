import React, { useState, useRef, useEffect } from 'react';
import { User, updateProfile, updatePassword } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SettingsProps {
  user: User;
  profile: any;
}

type SettingsSection = 'profile' | 'account' | 'notifications' | 'ai' | 'privacy';

export function Settings({ user, profile }: SettingsProps) {
  const isAdmin = profile?.role === 'admin';
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Your profile has been updated successfully.');
  const [showPassword, setShowPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(profile?.photoURL || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    fullName: profile?.displayName || user.displayName || '',
    email: user.email || '',
    contactNumber: profile?.contactNumber || '',
    address: profile?.address || '',
    barangay: profile?.barangay || 'Pupua',
    city: profile?.city || 'Catbalogan City',
    province: profile?.province || 'Samar',
    age: profile?.age || '',
    gender: profile?.gender || 'Male',
    civilStatus: profile?.civilStatus || 'Single'
  });

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

  // AI Preferences State
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

  // Sync profile data when prop updates
  useEffect(() => {
    if (profile) {
      setProfileData({
        fullName: profile.displayName || user.displayName || '',
        email: user.email || '',
        contactNumber: profile.contactNumber || '',
        address: profile.address || '',
        barangay: profile.barangay || 'Pupua',
        city: profile.city || 'Catbalogan City',
        province: profile.province || 'Samar',
        age: profile.age || '',
        gender: profile.gender || 'Male',
        civilStatus: profile.civilStatus || 'Single'
      });
      setPreviewImage(profile.photoURL || null);

      if (profile.notificationPrefs) {
        setNotifPrefs(prev => ({ ...prev, ...profile.notificationPrefs }));
      }
      if (profile.aiPrefs) {
        setAiPrefs(prev => ({ ...prev, ...profile.aiPrefs }));
      }
      if (profile.privacyPrefs) {
        setPrivacyPrefs(prev => ({ ...prev, ...profile.privacyPrefs }));
      }
    }
  }, [profile, user.email, user.displayName]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setShowSuccess(false);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: profileData.fullName,
        contactNumber: profileData.contactNumber,
        address: profileData.address,
        barangay: profileData.barangay,
        city: profileData.city,
        province: profileData.province,
        age: Number(profileData.age) || null,
        gender: profileData.gender,
        civilStatus: profileData.civilStatus,
        photoURL: previewImage,
        updatedAt: serverTimestamp()
      });

      await updateProfile(user, {
        displayName: profileData.fullName,
        photoURL: previewImage
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
      await updatePassword(user, securityData.newPassword);
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
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPrefs: notifPrefs,
        updatedAt: serverTimestamp()
      });
      setSuccessMessage('Notification preferences saved.');
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
      await updateDoc(doc(db, 'users', user.uid), {
        aiPrefs: aiPrefs,
        updatedAt: serverTimestamp()
      });
      setSuccessMessage('AI preferences saved successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save AI preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        privacyPrefs: privacyPrefs,
        updatedAt: serverTimestamp()
      });
      setSuccessMessage('Privacy settings updated.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save privacy settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      user: {
        uid: user.uid,
        email: user.email,
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
    downloadAnchor.setAttribute("download", `barangay_resident_data_${user.uid.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const navigationItems = [
    { id: 'profile', label: 'Profile', desc: 'Manage your personal information.', icon: UserIcon },
    { id: 'account', label: 'Account & Security', desc: 'Password and account security.', icon: Lock },
    { id: 'notifications', label: 'Notifications', desc: 'Manage notification preferences.', icon: Bell },
    { id: 'ai', label: 'AI Preferences', desc: 'Manage AI assistance and recommendations.', icon: Sparkles },
    { id: 'privacy', label: 'Privacy', desc: 'Manage privacy and data preferences.', icon: Shield },
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
        enabled ? "bg-[#2563EB]" : "bg-[#CBD5E1]"
      )}
    >
      <div
        className={cn(
          "bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
          Settings
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
          Manage your account, profile, notifications, and system preferences.
        </p>
      </div>

      {/* Global Success Banner */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-[12px] flex items-center gap-3 text-emerald-800 shadow-xs text-xs sm:text-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
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
            className="bg-red-50 border border-red-200 p-3.5 rounded-[12px] flex items-center gap-3 text-red-800 shadow-xs text-xs sm:text-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="font-semibold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Layout: Left Navigation + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Compact Settings Navigation */}
        <div className="lg:col-span-4 bg-white rounded-[14px] border border-[#E2E8F0] p-2 sm:p-2.5 shadow-2xs space-y-1">
          {navigationItems.map((item) => {
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
                  "w-full text-left p-3 rounded-[10px] transition-all flex items-start gap-3 cursor-pointer group",
                  isActive 
                    ? "bg-[#EFF6FF] text-[#2563EB] font-semibold border border-blue-100" 
                    : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 transition-colors mt-0.5",
                  isActive ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#64748B] group-hover:text-[#2563EB] group-hover:bg-blue-50"
                )}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className={cn(
                    "block text-xs sm:text-sm font-semibold truncate",
                    isActive ? "text-[#2563EB]" : "text-[#0F172A]"
                  )}>
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                    {item.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Settings Content Card */}
        <div className="lg:col-span-8 bg-white rounded-[14px] border border-[#E2E8F0] p-5 sm:p-6 shadow-sm">
          <AnimatePresence mode="wait">
            {/* SECTION 1: PROFILE */}
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Header & Subtext */}
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Profile</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Manage your personal information and resident credentials.</p>
                </div>

                {/* Compact Profile Header Card with Avatar */}
                <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row items-center sm:items-center gap-4">
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
                        className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white shadow-sm"
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <h4 className="text-base font-bold text-[#0F172A] truncate">
                        {profileData.fullName || 'Resident Name'}
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-center sm:self-auto">
                        <CheckCircle2 className="w-3 h-3" />
                        {isAdmin ? 'System Administrator' : 'Verified Resident'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] flex items-center justify-center sm:justify-start gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                </div>

                {/* Form: Personal Information */}
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Personal Information</h4>
                    <p className="text-[11px] text-[#64748B]">Update your basic account and contact information.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Full Name</label>
                      <input 
                        type="text"
                        required
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="First and Last Name"
                      />
                    </div>

                    {/* Email Address (Read-only) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Email Address</label>
                      <input 
                        type="email"
                        disabled
                        value={profileData.email}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#64748B] cursor-not-allowed"
                      />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Contact Number</label>
                      <input 
                        type="tel"
                        value={profileData.contactNumber}
                        onChange={(e) => setProfileData({ ...profileData, contactNumber: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="e.g., 0912 345 6789"
                      />
                    </div>

                    {/* Age */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Age</label>
                      <input 
                        type="number"
                        value={profileData.age}
                        onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                        placeholder="e.g. 28"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Gender</label>
                      <select 
                        value={profileData.gender}
                        onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>

                    {/* Civil Status */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Civil Status</label>
                      <select 
                        value={profileData.civilStatus}
                        onChange={(e) => setProfileData({ ...profileData, civilStatus: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option>Single</option>
                        <option>Married</option>
                        <option>Widowed</option>
                        <option>Separated</option>
                      </select>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Street Address / House No.</label>
                    <input 
                      type="text"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 focus:outline-none transition-colors"
                      placeholder="Purok 2, Coastal Road"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Barangay</label>
                      <input 
                        type="text"
                        value={profileData.barangay}
                        onChange={(e) => setProfileData({ ...profileData, barangay: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">City / Municipality</label>
                      <input 
                        type="text"
                        value={profileData.city}
                        onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Province</label>
                      <input 
                        type="text"
                        value={profileData.province}
                        onChange={(e) => setProfileData({ ...profileData, province: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="h-10 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <span>Save Changes</span>
                          <Check className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* SECTION 2: ACCOUNT & SECURITY */}
            {activeSection === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Account & Security</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Manage your password, account verification status, and recent security activity.</p>
                </div>

                {/* Account Status Card */}
                <div className="p-4 bg-[#F8FAFC] rounded-[12px] border border-[#E2E8F0] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Account Status</h4>
                      <p className="text-[11px] text-[#64748B]">Official barangay identity records linked to this account.</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Resident
                  </span>
                </div>

                {/* Password Form */}
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Password</h4>
                    <p className="text-[11px] text-[#64748B]">Ensure your account uses a strong password with at least 8 characters.</p>
                  </div>

                  <div className="space-y-3.5 max-w-md">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={securityData.newPassword}
                          onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                          className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 pr-9 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                          placeholder="At least 8 characters"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Confirm New Password</label>
                      <input 
                        type="password"
                        required
                        value={securityData.confirmPassword}
                        onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                        placeholder="Re-type new password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="h-9 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>

                {/* Login Activity Section */}
                <div className="pt-4 border-t border-[#F1F5F9] space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Login Activity</h4>
                    <p className="text-[11px] text-[#64748B]">Recent devices and sessions accessing your resident portal.</p>
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-white border border-[#E2E8F0] flex items-center justify-center text-[#2563EB]">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">Current Web Session</p>
                        <p className="text-[11px] text-[#64748B]">Active now • Barangay Pupua Portal (Web)</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                      Active
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SECTION 3: NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Notifications</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Choose which notifications and alert channels you want to receive.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Appointment Reminders</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Get timely reminders for your scheduled barangay appointments.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.appointmentReminders} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, appointmentReminders: !notifPrefs.appointmentReminders })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Request Status Updates</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Receive immediate notifications when documents are approved or ready.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.statusUpdates} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, statusUpdates: !notifPrefs.statusUpdates })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Service Announcements</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Stay informed about local barangay advisories, holidays, and town hall news.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.announcements} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, announcements: !notifPrefs.announcements })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Email Notifications</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Send document claim receipts and appointment slips to your registered email.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.emailNotifications} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, emailNotifications: !notifPrefs.emailNotifications })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">AI Queue Recommendations</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Receive smart notifications for fastest processing slots and low-traffic hours.</p>
                    </div>
                    <Toggle 
                      enabled={notifPrefs.aiQueueAlerts} 
                      onChange={() => setNotifPrefs({ ...notifPrefs, aiQueueAlerts: !notifPrefs.aiQueueAlerts })} 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotifications}
                    disabled={isSaving}
                    className="h-10 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Preferences</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* SECTION 4: AI PREFERENCES */}
            {activeSection === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">AI Preferences</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Customize how AI assistance works for your appointments and requests.</p>
                </div>

                {/* AI Feature Header Banner */}
                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-[12px] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#1E293B]">Smart Barangay Assistant</h4>
                    <p className="text-[11px] text-[#64748B]">AI dynamically balances resident foot traffic and suggests optimal appointment slots.</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">AI Queue Recommendations</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Receive recommendations for the best time to visit the barangay office.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.queueRecommendations} 
                      onChange={() => setAiPrefs({ ...aiPrefs, queueRecommendations: !aiPrefs.queueRecommendations })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Smart Appointment Suggestions</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Allow the system to suggest convenient appointment schedules based on availability.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.smartSuggestions} 
                      onChange={() => setAiPrefs({ ...aiPrefs, smartSuggestions: !aiPrefs.smartSuggestions })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">AI Assistance</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Enable AI-powered assistance when requesting barangay services.</p>
                    </div>
                    <Toggle 
                      enabled={aiPrefs.aiAssistance} 
                      onChange={() => setAiPrefs({ ...aiPrefs, aiAssistance: !aiPrefs.aiAssistance })} 
                    />
                  </div>
                </div>

                {/* Preferred Time Choice */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-[#0F172A]">Preferred Visiting Time Window</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Morning', 'Afternoon'].map((windowOption) => {
                      const isSelected = aiPrefs.preferredTime === windowOption;
                      return (
                        <button
                          key={windowOption}
                          type="button"
                          onClick={() => setAiPrefs({ ...aiPrefs, preferredTime: windowOption })}
                          className={cn(
                            "p-3 rounded-[10px] border text-xs font-semibold transition-all text-center cursor-pointer",
                            isSelected 
                              ? "bg-[#EFF6FF] text-[#2563EB] border-[#2563EB] ring-1 ring-[#2563EB]/20" 
                              : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-blue-200"
                          )}
                        >
                          {windowOption} ({windowOption === 'Morning' ? '8:00 AM - 12:00 PM' : '1:00 PM - 5:00 PM'})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAiPrefs}
                    disabled={isSaving}
                    className="h-10 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save AI Preferences</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* SECTION 5: PRIVACY */}
            {activeSection === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Privacy</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Manage your privacy and data preferences in accordance with the Data Privacy Act.</p>
                </div>

                {/* Personal Information explanation */}
                <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <h4 className="text-xs font-bold text-[#0F172A]">Personal Information Usage</h4>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Your personal information is securely stored and used strictly to process official barangay documents, community certifications, and resident identity verification.
                  </p>
                </div>

                {/* Data & Privacy Preferences */}
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Profile Visibility</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Allow authorized barangay staff to view verified profile details during processing.</p>
                    </div>
                    <Toggle 
                      enabled={privacyPrefs.visibility} 
                      onChange={() => setPrivacyPrefs({ ...privacyPrefs, visibility: !privacyPrefs.visibility })} 
                    />
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">Data Processing Consent</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5">Consent to administrative data verification for clearance and permit issuance.</p>
                    </div>
                    <Toggle 
                      enabled={privacyPrefs.dataConsent} 
                      onChange={() => setPrivacyPrefs({ ...privacyPrefs, dataConsent: !privacyPrefs.dataConsent })} 
                    />
                  </div>
                </div>

                {/* Account Data Management */}
                <div className="pt-4 border-t border-[#F1F5F9] space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">Account Data</h4>
                    <p className="text-[11px] text-[#64748B]">Download a copy of your personal data or request account removal.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleRequestData}
                      className="h-10 px-4 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-semibold rounded-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Request My Data (JSON)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="h-10 px-4 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete Account</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePrivacy}
                    disabled={isSaving}
                    className="h-10 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Privacy Settings</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 max-w-md w-full shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="text-base font-bold text-[#0F172A]">Delete Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="text-[#94A3B8] hover:text-[#0F172A] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                This action is permanent and cannot be undone. All your service request histories and submitted document records will be unlinked.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Type <span className="text-red-600 font-bold">DELETE</span> to confirm
                </label>
                <input 
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-red-500 focus:outline-none"
                  placeholder="DELETE"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="h-9 px-4 rounded-[10px] text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE'}
                  onClick={() => {
                    alert('For security compliance, please contact your Barangay Pupua administrator to finalize account deletion.');
                    setShowDeleteModal(false);
                  }}
                  className="h-9 px-4 rounded-[10px] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Confirm Deletion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
