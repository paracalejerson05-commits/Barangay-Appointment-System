import { supabase } from '../lib/supabase';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  User as UserIcon, 
  Lock, 
  Bell, 
  Sparkles, 
  Shield, 
  Camera, 
  Mail, 
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
  ChevronRight,
  Settings as SettingsIcon,
  Megaphone,
  Activity,
  Clock,
  Sliders,
  Plus,
  Edit2,
  Globe,
  Lock as LockIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { syncUserToSupabase } from '../lib/supabaseSync';
import { dbGetAnnouncements, dbSaveAnnouncement, dbDeleteAnnouncement } from '../lib/supabaseDb';

interface AdminSettingsProps {
  user: any;
  profile: any;
}

type AdminSettingsSection = 'profile' | 'account' | 'appearance' | 'notifications' | 'system' | 'announcements' | 'ai' | 'privacy';

export function AdminSettings({ user, profile }: AdminSettingsProps) {
  const { theme: themeMode, setTheme } = useTheme();
  const sectionFromHash = (): AdminSettingsSection => window.location.hash === '#account' ? 'account' : 'profile';
  const [activeSection, setActiveSection] = useState<AdminSettingsSection>(sectionFromHash);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Admin settings updated successfully.');
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(profile?.photoURL || null);

  useEffect(() => {
    const syncSectionFromHash = () => setActiveSection(sectionFromHash());
    window.addEventListener('hashchange', syncSectionFromHash);
    return () => window.removeEventListener('hashchange', syncSectionFromHash);
  }, []);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    fullName: profile?.displayName || user?.displayName || 'System Administrator',
    email: user?.email || profile?.email || 'paracalejerson05@gmail.com',
    contactNumber: profile?.contactNumber || '09123456789',
    role: 'System Administrator',
    status: 'Active Administrator'
  });

  // Password Form State
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notifications State
  const [adminNotifPrefs, setAdminNotifPrefs] = useState({
    newResidentRegistration: true,
    newServiceRequest: true,
    requestStatusChanges: true,
    appointmentQueueUpdates: true,
    systemNotifications: true
  });

  // System Preferences State
  const [systemPrefs, setSystemPrefs] = useState({
    autoAssignQueue: true,
    prioritySeniors: true,
    officeHours: '08:00 AM - 05:00 PM (Mon-Fri)',
    refreshInterval: '30 seconds',
    pageSize: '25 items per page',
    autoArchiveDays: '30 days'
  });

  // Announcements Management State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    category: 'General',
    status: 'Published',
    visibility: 'Public'
  });

  // Smart Queue & Assistance State (AI Preferences)
  const [smartPrefs, setSmartPrefs] = useState({
    queueRecommendationSystem: true,
    queueAnalysis: true,
    appointmentSuggestions: true,
    aiAssistant: true,
    processingInsights: true
  });

  useEffect(() => {
    if (user?.user_metadata?.smartPrefs) {
      setSmartPrefs(prev => ({ ...prev, ...user.user_metadata.smartPrefs }));
    }
  }, [user]);

  // Privacy & Activity State
  const [activityLogs, setActivityLogs] = useState([
    { id: 1, action: 'Approved resident registration (Maria Santos)', timestamp: '10 minutes ago', type: 'success' },
    { id: 2, action: 'Updated system queue capacity limits', timestamp: '2 hours ago', type: 'info' },
    { id: 3, action: 'Broadcasted Barangay General Assembly announcement', timestamp: '1 day ago', type: 'success' },
    { id: 4, action: 'System security audit completed successfully', timestamp: '3 days ago', type: 'info' }
  ]);

  // Load announcements from Supabase
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setAnnouncements(await dbGetAnnouncements());
      } catch (err) {
        console.warn('Failed to load announcements from Supabase:', err);
      }
    };
    fetchAnnouncements();
  }, []);

  // Sync profile data
  useEffect(() => {
    if (profile) {
      setProfileData(prev => ({
        ...prev,
        fullName: profile.displayName || user?.displayName || prev.fullName,
        email: user?.email || profile.email || prev.email,
        contactNumber: profile.contactNumber || prev.contactNumber,
      }));
      if (profile.photoURL) {
        setPreviewImage(profile.photoURL);
      }
    }
  }, [profile, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const targetUid = user?.uid || user?.id;
      if (targetUid) {
        const synced = await syncUserToSupabase(
          { uid: targetUid, email: user?.email || profileData.email, displayName: profileData.fullName },
          { uid: targetUid, email: user?.email || profileData.email, displayName: profileData.fullName, contactNumber: profileData.contactNumber, role: 'admin', status: 'approved' }
        );
        if (!synced) throw new Error('Administrator profile could not be saved to Supabase.');
      }
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: profileData.fullName, display_name: profileData.fullName, photoURL: previewImage || null } });
      if (authError) throw authError;

      setSuccessMessage('Administrator profile updated successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update admin profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (securityData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
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
      setSuccessMessage('Administrator password updated successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async (sectionName: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { adminNotifPrefs, systemPrefs, smartPrefs } });
      if (error) throw error;
      setSuccessMessage(`${sectionName} preferences saved successfully.`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError(`Failed to save ${sectionName.toLowerCase()}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!String(announcementForm.title || '').trim() || !String(announcementForm.content || '').trim()) {
      setError('Title and content are required for announcements.');
      return;
    }
    setIsSaving(true);
    try {
      const id = await dbSaveAnnouncement({ id: editingAnnouncementId || undefined, ...announcementForm });
      if (!id) throw new Error('Announcement could not be saved to Supabase.');
      setAnnouncements(await dbGetAnnouncements());

      setShowAnnouncementModal(false);
      setEditingAnnouncementId(null);
      setAnnouncementForm({ title: '', content: '', category: 'General', status: 'Published', visibility: 'Public' });
      setSuccessMessage('Announcement saved successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      setError('Failed to save announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      if (!(await dbDeleteAnnouncement(id))) throw new Error('Announcement could not be deleted from Supabase.');
      setAnnouncements(announcements.filter(a => a.id !== id));
      setSuccessMessage('Announcement deleted successfully.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err) {
      setError('Failed to delete announcement.');
    }
  };

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
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

  const settingsCategories = [
    {
      group: 'ADMINISTRATOR',
      items: [
        { id: 'profile', label: 'Administrator Profile', desc: 'Personal details and admin role', icon: UserIcon },
        { id: 'account', label: 'Account & Security', desc: 'Password and session security', icon: Lock },
      ]
    },
    {
      group: 'OPERATIONS',
      items: [
        { id: 'appearance', label: 'Appearance', desc: 'Theme and display options', icon: Palette },
        { id: 'notifications', label: 'Notifications', desc: 'Admin notification preferences', icon: Bell },
        { id: 'system', label: 'System Preferences', desc: 'Office hours and workflow settings', icon: Sliders },
        { id: 'announcements', label: 'Announcements', desc: 'Manage barangay public notices', icon: Megaphone },
      ]
    },
    {
      group: 'INTELLIGENCE & AUDIT',
      items: [
        { id: 'ai', label: 'Smart Queue & Assistance', desc: 'AI queue recommendations and insights', icon: Sparkles },
        { id: 'privacy', label: 'Privacy & Activity', desc: 'Audit logs and admin activities', icon: Shield },
      ]
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 font-['Manrope',sans-serif] pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-[30px] font-bold text-[#0F172A] dark:text-slate-100 tracking-tight">
            Admin Settings
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mt-0.5 font-normal">
            Configure system operations, administrator credentials, announcements, and smart queue controls.
          </p>
        </div>

        {/* System Administrator Status Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-blue-50 text-[#2563EB] border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
            🛡️ System Administrator
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            🟢 System Active
          </span>
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

      {/* Responsive Grid: Vertical list on mobile, 2-column on desktop/tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Navigation Menu */}
        <div className="lg:col-span-4 space-y-3">
          {settingsCategories.map((groupCat) => (
            <div key={groupCat.group} className="bg-white dark:bg-slate-900 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 p-2 shadow-2xs">
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
                        setActiveSection(item.id as AdminSettingsSection);
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
                          isActive ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 group-hover:text-[#2563EB] dark:group-hover:text-blue-400"
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
                        isActive ? "text-[#2563EB] dark:text-blue-400 translate-x-0.5" : "text-[#CBD5E1] dark:text-slate-600"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Content Area */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 p-5 sm:p-6 shadow-2xs">
          <AnimatePresence mode="wait">
            
            {/* 1. ADMINISTRATOR PROFILE */}
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Administrator Profile</h3>
                    <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Manage administrative credentials and system operator details.</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-[#2563EB] border border-blue-200 rounded-full text-[11px] font-semibold">
                    System Admin
                  </span>
                </div>

                <div className="p-4 rounded-[12px] bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-700/60 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    {previewImage ? (
                      <img src={previewImage} alt="Admin" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xl shadow-sm">
                        JA
                      </div>
                    )}
                  </div>
                  <div className="text-center sm:text-left space-y-1">
                    <h4 className="text-base sm:text-[16px] font-semibold text-[#0F172A] dark:text-slate-100">
                      {profileData.fullName}
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>{profileData.email}</span>
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center sm:justify-start gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Account Status: Active Administrator
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={profileData.fullName}
                        onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Email Address <span className="text-[11px] text-[#64748B]">(Read-only)</span>
                      </label>
                      <input 
                        type="email" 
                        disabled
                        value={profileData.email}
                        className="w-full bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#64748B] dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Contact Number <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="tel" 
                        required
                        value={profileData.contactNumber}
                        onChange={(e) => setProfileData({ ...profileData, contactNumber: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                        Administrator Role
                      </label>
                      <input 
                        type="text" 
                        disabled
                        value={profileData.role}
                        className="w-full bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#64748B] dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Save Profile Changes</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* 2. ACCOUNT & SECURITY */}
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
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Account & Security</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Manage administrator password, active sessions, and security credentials.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                  <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-200">Change Administrator Password</h4>
                  
                  <div>
                    <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">New Password</label>
                    <input 
                      type="password"
                      required
                      placeholder="At least 8 characters"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">Confirm New Password</label>
                    <input 
                      type="password"
                      required
                      placeholder="Re-enter new password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Update Password</span>
                  </button>
                </form>

                {/* Session Management */}
                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 space-y-3">
                  <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-200">Session Management</h4>
                  <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-slate-100">Current Session Active</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">IP: 192.168.1.1 • Secure HTTPS Session</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => supabase.auth.signOut()}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. APPEARANCE */}
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
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Appearance</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Choose your preferred display theme for the administration console.</p>
                </div>

                <div className="bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">Theme Mode</h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Select Light or Dark mode for dashboard viewing.</p>
                  </div>

                  <div className="inline-flex items-center p-1 bg-[#E2E8F0]/80 dark:bg-slate-900 rounded-full border border-[#CBD5E1] dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                        themeMode === 'light' ? "bg-[#2563EB] text-white shadow-xs" : "text-[#64748B] dark:text-slate-300"
                      )}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                        themeMode === 'dark' ? "bg-[#2563EB] text-white shadow-xs" : "text-[#64748B] dark:text-slate-300"
                      )}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark Mode</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[8px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">System Default</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400">Match operating system preference automatically.</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={themeMode === 'system'}
                    onChange={() => setTheme(themeMode === 'system' ? 'light' : 'system')}
                  />
                </div>
              </motion.div>
            )}

            {/* 4. NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3">
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Notifications</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Configure administrative alerts and event notifications.</p>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'newResidentRegistration', label: 'New Resident Registration', desc: 'Alert when a new resident registers and requires approval' },
                    { key: 'newServiceRequest', label: 'New Service Request', desc: 'Alert when a resident submits a new clearance or certificate request' },
                    { key: 'requestStatusChanges', label: 'Request Status Changes', desc: 'Notify when requests are processed or updated' },
                    { key: 'appointmentQueueUpdates', label: 'Appointment and Queue Updates', desc: 'Receive real-time queue ticket and appointment schedule alerts' },
                    { key: 'systemNotifications', label: 'System Notifications', desc: 'Important administrative system announcements and security notices' },
                  ].map((item) => (
                    <div key={item.key} className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">{item.label}</h4>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle
                        enabled={(adminNotifPrefs as any)[item.key]}
                        onChange={() => {
                          const updated = { ...adminNotifPrefs, [item.key]: !(adminNotifPrefs as any)[item.key] };
                          setAdminNotifPrefs(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleSavePreferences('Notification')}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Notification Preferences</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. SYSTEM PREFERENCES */}
            {activeSection === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3">
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">System Preferences</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Configure default processing rules, office hours, and dashboard behavior.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">Auto-Assign Queue Numbers</h4>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">Automatically generate sequential queue tickets upon request submission.</p>
                    </div>
                    <Toggle
                      enabled={systemPrefs.autoAssignQueue}
                      onChange={() => setSystemPrefs({ ...systemPrefs, autoAssignQueue: !systemPrefs.autoAssignQueue })}
                    />
                  </div>

                  <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">Priority Queuing for Seniors & PWD</h4>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">Automatically prioritize senior citizens and PWDs in queue sorting.</p>
                    </div>
                    <Toggle
                      enabled={systemPrefs.prioritySeniors}
                      onChange={() => setSystemPrefs({ ...systemPrefs, prioritySeniors: !systemPrefs.prioritySeniors })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">Office Hours</label>
                      <input 
                        type="text"
                        value={systemPrefs.officeHours}
                        onChange={(e) => setSystemPrefs({ ...systemPrefs, officeHours: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">Dashboard Refresh Frequency</label>
                      <select
                        value={systemPrefs.refreshInterval}
                        onChange={(e) => setSystemPrefs({ ...systemPrefs, refreshInterval: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 h-11 sm:h-10 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                      >
                        <option value="10 seconds">10 seconds (Real-time)</option>
                        <option value="30 seconds">30 seconds (Standard)</option>
                        <option value="1 minute">1 minute (Battery saver)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleSavePreferences('System')}
                      className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save System Preferences</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 6. ANNOUNCEMENTS */}
            {activeSection === 'announcements' && (
              <motion.div
                key="announcements"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Barangay Announcements</h3>
                    <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Create, edit, publish, and manage public notices for residents.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAnnouncementId(null);
                      setAnnouncementForm({ title: '', content: '', category: 'General', status: 'Published', visibility: 'Public' });
                      setShowAnnouncementModal(true);
                    }}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold rounded-[10px] flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Announcement</span>
                  </button>
                </div>

                {/* Announcement List */}
                <div className="space-y-3">
                  {announcements.length === 0 ? (
                    <div className="p-8 text-center bg-[#F8FAFC] dark:bg-slate-800/40 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700">
                      <Megaphone className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                      <p className="text-xs sm:text-sm font-medium text-[#64748B]">No announcements posted yet.</p>
                      <p className="text-[11px] text-[#94A3B8] mt-1">Click "New Announcement" to create your first public notice.</p>
                    </div>
                  ) : (
                    announcements.map((ann) => (
                      <div key={ann.id} className="p-4 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-[15px] font-bold text-[#0F172A] dark:text-slate-100 truncate">{ann.title}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                              {ann.category || 'General'}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                              ann.status === 'Published' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}>
                              {ann.status || 'Published'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] dark:text-slate-300 line-clamp-2">{ann.content}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAnnouncementId(ann.id);
                              setAnnouncementForm({
                                title: ann.title,
                                content: ann.content,
                                category: ann.category || 'General',
                                status: ann.status || 'Published',
                                visibility: ann.visibility || 'Public'
                              });
                              setShowAnnouncementModal(true);
                            }}
                            className="p-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-[#0F172A] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-600 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Announcement Modal Form */}
                {showAnnouncementModal && (
                  <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-slate-900 rounded-[16px] border border-[#E2E8F0] dark:border-slate-800 p-6 w-full max-w-lg shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-slate-800">
                        <h4 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
                          {editingAnnouncementId ? 'Edit Announcement' : 'Create Barangay Announcement'}
                        </h4>
                        <button 
                          onClick={() => setShowAnnouncementModal(false)}
                          className="text-[#64748B] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveAnnouncement} className="space-y-4">
                        <div>
                          <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1">Title</label>
                          <input 
                            type="text"
                            required
                            placeholder="Announcement title"
                            value={announcementForm.title}
                            onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1">Category</label>
                            <select
                              value={announcementForm.category}
                              onChange={(e) => setAnnouncementForm({ ...announcementForm, category: e.target.value })}
                              className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                            >
                              <option value="General">General</option>
                              <option value="Health">Health & Medical</option>
                              <option value="Event">Community Event</option>
                              <option value="Urgent">Urgent Notice</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1">Status</label>
                            <select
                              value={announcementForm.status}
                              onChange={(e) => setAnnouncementForm({ ...announcementForm, status: e.target.value })}
                              className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                            >
                              <option value="Published">Published</option>
                              <option value="Draft">Draft (Unpublished)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-[13px] font-semibold text-[#0F172A] dark:text-slate-200 mb-1">Content</label>
                          <textarea
                            rows={4}
                            required
                            placeholder="Type announcement details here..."
                            value={announcementForm.content}
                            onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAnnouncementModal(false)}
                            className="px-4 py-2.5 rounded-[10px] border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-slate-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="px-5 py-2.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white shadow-sm cursor-pointer flex items-center gap-1.5"
                          >
                            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Save Announcement</span>
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 7. SMART QUEUE & ASSISTANCE */}
            {activeSection === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3">
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Smart Queue & Assistance</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Configure AI-powered queue recommendations, analysis, and appointment suggestions.</p>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'queueRecommendationSystem', label: 'Queue Recommendation System', desc: 'AI suggests optimal service windows and time slots for residents' },
                    { key: 'queueAnalysis', label: 'Queue Analysis', desc: 'Automated bottleneck detection and peak hour traffic forecasting' },
                    { key: 'appointmentSuggestions', label: 'Appointment Suggestions', desc: 'Smart rescheduling suggestions to reduce waiting room congestion' },
                    { key: 'aiAssistant', label: 'AI Assistant', desc: 'Interactive AI support for processing resident inquiries and service guidance' },
                    { key: 'processingInsights', label: 'Processing Insights', desc: 'Predictive analytics for staff workload and service turnaround times' },
                  ].map((item) => (
                    <div key={item.key} className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">{item.label}</h4>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle
                        enabled={(smartPrefs as any)[item.key]}
                        onChange={() => {
                          const updated = { ...smartPrefs, [item.key]: !(smartPrefs as any)[item.key] };
                          setSmartPrefs(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleSavePreferences('Smart Queue & Assistance')}
                    className="h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm rounded-[10px] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Smart Preferences</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* 8. PRIVACY & ACTIVITY */}
            {activeSection === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-3">
                  <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A] dark:text-slate-100">Privacy & Activity</h3>
                  <p className="text-xs sm:text-[14px] text-[#64748B] dark:text-slate-400 mt-0.5">Review administrative audit logs, login activity, and security actions.</p>
                </div>

                {/* Audit Activity Logs */}
                <div className="space-y-3">
                  <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-200">Recent Administrative Actions & Activity</h4>
                  <div className="space-y-2">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <Activity className="w-4 h-4 text-[#2563EB]" />
                          <span className="font-medium text-[#0F172A] dark:text-slate-200">{log.action}</span>
                        </div>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 whitespace-nowrap">{log.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F5F9] dark:border-slate-800 space-y-3">
                  <h4 className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-200">Privacy Compliance</h4>
                  <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">Data Privacy Act (DPA) Compliance Mode</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">Strictly enforce data minimization and encrypted resident record logging.</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                      Enforced
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
