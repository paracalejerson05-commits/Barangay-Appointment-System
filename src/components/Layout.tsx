import React, { useState, useEffect, useRef } from 'react';

import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { dbGetNotifications, dbMarkNotificationRead } from '../lib/supabaseDb';
import { 
  LayoutDashboard, 
  FileText, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell,
  MessageSquare,
  BarChart3,
  Users,
  CalendarDays,
  Sparkles,
  Search,
  Sun,
  Clock,
  ShieldAlert,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserRound,
  ShieldCheck,
} from 'lucide-react';
import { cn, formatTimeAgo } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Chatbot } from './Chatbot';
import { BARANGAY_LOGO_URL, BARANGAY_LOGO_FALLBACK, SYSTEM_NAME } from '../constants';
import { checkProfileCompletion } from '../lib/profileUtils';
import { markNotificationReadInSupabase } from '../lib/supabaseSync';
import { getNotificationTargetUserIds } from '../lib/notificationScope';
import { isPrimaryAdmin } from '../lib/adminAccess';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  profile: any;
  onLogout: () => void;
}

export function Layout({ children, user, profile, onLogout }: LayoutProps) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile?.role === 'admin' && profile?.status !== 'deactivated';
  const canManageAdmins = isAdmin && isPrimaryAdmin(user?.email || profile?.email);
  const residentProfileStatus = checkProfileCompletion(profile, user?.email);
  const isResidentProfileComplete = residentProfileStatus.isComplete;

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    const updateTime = () => {
      setLiveTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchNotifs() {
      if (!user) return;
      const userId = user?.uid || user?.id;
      const targetUserId = getNotificationTargetUserIds(userId, isAdmin)[0] ?? null;
      if (!targetUserId) return;

      const notifs = await dbGetNotifications(targetUserId);
      setNotifications(notifs.map(n => ({
        ...n,
        time: formatTimeAgo(n.createdAt)
      })));
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    try {
      const results = await Promise.all(unreadNotifications.map(n => dbMarkNotificationRead(n.id)));
      if (results.some(result => !result)) {
        throw new Error('One or more notifications could not be updated.');
      }
      setNotifications(current => current.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleNotificationClick = async (id: string) => {
    try {
      await dbMarkNotificationRead(id);
      setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    if (q.includes('request') || q.includes('document') || q.includes('status')) {
      navigate('/requests');
    } else if (q.includes('service') || q.includes('clearance') || q.includes('indigency') || q.includes('book')) {
      navigate('/services');
    } else if (q.includes('setting') || q.includes('profile')) {
      navigate('/settings');
    } else if (isAdmin && (q.includes('resident') || q.includes('user'))) {
      navigate('/residents');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const adminMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ClipboardList, label: 'Requests', path: '/requests' },
    { icon: Users, label: 'Residents', path: '/residents' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const residentMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Services', path: '/services' },
    { icon: ClipboardList, label: 'My Requests', path: '/requests' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const menuItems = isAdmin ? adminMenuItems : residentMenuItems;
  const mobileMenuItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: ClipboardList, label: 'Requests', path: '/requests' },
    { icon: Users, label: 'Residents', path: '/residents' },
    { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
  ] : [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: FileText, label: 'Services', path: '/services' },
    { icon: ClipboardList, label: 'My Requests', path: '/requests' },
  ];

  return (
    <div className="h-screen h-dvh overflow-hidden bg-[#F4F7F9] dark:bg-[#0B132B] flex p-0 lg:p-4 gap-0 lg:gap-4 font-sans text-[#111827] dark:text-slate-100 relative transition-colors duration-200">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F4F7FB] dark:bg-[#0B132B]">
        {/* Abstract Soft Shapes */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-blue-200/20 dark:bg-blue-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-300/20 dark:bg-blue-900/10 blur-[120px]" />
        
        {/* Soft Wave SVG */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-60 dark:opacity-20" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Top Wave */}
          <path d="M0,0 L1440,0 L1440,250 C1100,100 800,450 400,200 C200,75 0,300 0,300 Z" fill="url(#grad-top)" />
          {/* Bottom Wave */}
          <path d="M1440,1024 L0,1024 L0,800 C300,950 600,650 1000,850 C1250,975 1440,750 1440,750 Z" fill="url(#grad-bottom)" />
          
          <defs>
            <linearGradient id="grad-top" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-bottom" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-4 left-4 z-50 hidden flex-col overflow-hidden rounded-2xl border border-[#DCE6F2] bg-white text-[#1E293B] shadow-[0_12px_36px_rgba(21,65,140,0.10)] transition-[width] duration-300 ease-in-out lg:flex",
          isDesktopCollapsed ? "w-20" : "w-64"
        )}
        aria-label={`${isAdmin ? 'Admin' : 'Resident'} navigation`}
      >
        <div className={cn("flex min-h-0 flex-1 flex-col", isDesktopCollapsed ? "p-3" : "p-4")}>
          <div className={cn(
            "flex min-h-[58px] items-center border-b border-[#E8EEF6]",
            isDesktopCollapsed ? "flex-col justify-center gap-2 pb-3" : "gap-3 pb-4"
          )}>
            <Link
              to="/"
              title={isDesktopCollapsed ? "Brgy. Pupua" : undefined}
              aria-label="Brgy. Pupua home"
              className={cn(
                "flex min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
                isDesktopCollapsed ? "justify-center" : "flex-1 gap-3"
              )}
            >
              <img
                src={BARANGAY_LOGO_URL}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-full border border-[#E2E8F0] bg-white object-contain"
                referrerPolicy="no-referrer"
              />
              {!isDesktopCollapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-bold leading-tight tracking-[-0.02em] text-[#15418C]">
                    Brgy. Pupua
                  </span>
                  <span className="mt-1 block truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-[#718096]">
                    Public Service Portal
                  </span>
                </span>
              )}
            </Link>
            {!isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(true)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#64748B] transition-colors duration-150 hover:bg-[#F1F5F9] hover:text-[#15418C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#15418C] transition-colors duration-150 hover:bg-[#E5EDF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-5", isDesktopCollapsed && "pt-6")}>
            {!isDesktopCollapsed && (
              <p className="mb-2.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8291A6]">
                {isAdmin ? 'Admin Overview' : 'Resident Overview'}
              </p>
            )}
            <nav className="space-y-1" aria-label="Main navigation">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={isDesktopCollapsed ? item.label : undefined}
                  aria-label={isDesktopCollapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    "group relative flex min-h-11 items-center rounded-[13px] px-3 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
                    isDesktopCollapsed ? "justify-center" : "gap-3",
                    isActive
                      ? "bg-gradient-to-r from-[#EAF2FF] to-[#F3F7FF] text-[#15418C] shadow-[0_3px_10px_rgba(21,65,140,0.08)]"
                      : "text-[#64748B] hover:bg-[#F4F7FB] hover:text-[#15418C]"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-[#2563EB]" aria-hidden="true" />
                      )}
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-150 group-hover:-translate-y-px",
                          isActive ? "text-[#2563EB]" : "text-[#7B8BA1] group-hover:text-[#2563EB]"
                        )}
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                      {!isDesktopCollapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className={cn("mt-auto border-t border-[#E8EEF6] pt-3", isDesktopCollapsed && "flex flex-col items-center")}>
            <div
              className={cn(
                "mb-2 flex min-w-0 items-center rounded-xl bg-[#F7F9FC] p-2",
                isDesktopCollapsed ? "justify-center" : "gap-2.5"
              )}
              title={isDesktopCollapsed ? profile?.displayName || user.displayName || (isAdmin ? "Administrator" : "Resident") : undefined}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-9 w-9 flex-shrink-0 rounded-full border border-white object-cover shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#E4EEFC] text-xs font-bold text-[#15418C]">
                  {(profile?.displayName || user.displayName || (isAdmin ? 'Admin' : 'Resident'))
                    .split(/\s+/)
                    .map((part: string) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
              {!isDesktopCollapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[#26364A]">
                      {isAdmin ? 'Admin' : 'Resident'}
                    </span>
                    <span className="block truncate text-[10px] text-[#718096]">
                      {profile?.displayName || user.displayName || (isAdmin ? 'Administrator' : 'Resident Account')}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#8291A6]" aria-hidden="true" />
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onLogout}
              title={isDesktopCollapsed ? "Sign Out" : undefined}
              aria-label="Sign Out"
              className={cn(
                "flex min-h-10 w-full items-center rounded-[11px] text-[12px] font-semibold text-[#64748B] transition-colors duration-150 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                isDesktopCollapsed ? "justify-center" : "gap-3 px-3"
              )}
            >
              <LogOut className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.9} aria-hidden="true" />
              {!isDesktopCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full overflow-hidden",
        isDesktopCollapsed ? "lg:ml-24" : "lg:ml-72"
      )}>
        <div className="flex-1 flex flex-col overflow-hidden relative z-10 h-full">
          {/* Header */}
          <motion.header
            key={location.pathname}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mobile-app-header h-16 lg:h-20 flex items-center justify-between px-3 sm:px-6 lg:px-8 z-40 bg-white/95 dark:bg-[#0F172A]/95 lg:bg-transparent lg:dark:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b border-[#E5E7EB] dark:border-slate-800 lg:border-none flex-shrink-0 transition-colors duration-200"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link to="/" className="lg:hidden flex flex-1 items-center gap-2 min-w-0" aria-label="Go to dashboard">
                <img
                  src={BARANGAY_LOGO_URL}
                  alt=""
                  className="w-8 h-8 rounded-full object-contain bg-white border border-[#E5E7EB] flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <span className={cn(
                  "min-w-0 font-sans font-semibold leading-tight text-[#15418C] dark:text-white tracking-tight",
                  isAdmin
                    ? "whitespace-nowrap text-[clamp(16px,4.6vw,18px)]"
                    : "text-[clamp(15px,5vw,20px)] line-clamp-2"
                )}>
                  {isAdmin ? 'Brgy. Pupua' : SYSTEM_NAME}
                </span>
              </Link>

              <div className="hidden lg:flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-xs sm:text-base font-bold text-[#111827] dark:text-slate-100 leading-tight tracking-tight truncate">
                    {greeting}, {profile?.displayName?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Resident'}
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border flex-shrink-0",
                    isAdmin 
                      ? "bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border-blue-200 dark:border-blue-800" 
                      : isResidentProfileComplete
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  )}>
                    {isAdmin ? 'Admin' : isResidentProfileComplete ? 'Profile Complete' : 'Profile Incomplete'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-[#6B7280] dark:text-slate-400">
                  <span className="font-normal text-[#6B7280] dark:text-slate-400 truncate">{currentDate}</span>
                  <span className="w-1 h-1 bg-[#E5E7EB] dark:bg-slate-700 rounded-full hidden sm:inline-block" />
                  <span className="hidden sm:inline-flex items-center gap-1 font-medium text-[#6B7280] dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    {liveTime}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Header Search Bar */}
              <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-48 lg:w-64">
                <Search className="w-4 h-4 text-[#6B7280] dark:text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services, requests..."
                  className="w-full bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#E5E7EB] dark:border-slate-700 rounded-[10px] py-1.5 pl-9 pr-3 text-xs font-normal text-[#111827] dark:text-slate-100 placeholder:text-[#6B7280] dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-all outline-none"
                />
              </form>

              <div className="h-5 w-px bg-[#E5E7EB] dark:bg-slate-800 hidden sm:block" />

              {/* Notifications Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="p-2 text-[#6B7280] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 active:bg-[#E5E7EB] rounded-[12px] relative transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Notifications"
                >
                  <Bell className="w-[18px] h-[18px] text-[#6B7280] dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2563EB] ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
                
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-[-10px] sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-slate-900 rounded-[14px] shadow-xl border border-[#E5E7EB] dark:border-slate-800 overflow-hidden z-50"
                    >
                      <div className="p-3.5 border-b border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-800/60">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                          <h4 className="font-bold text-xs text-[#111827] dark:text-slate-100 uppercase tracking-wider">Notifications</h4>
                        </div>
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB] dark:divide-slate-800">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-[#6B7280] dark:text-slate-400">
                            No notifications at this time.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n.id)}
                              className={cn(
                                "p-3 transition-colors cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-slate-800/80",
                                !n.read ? "bg-blue-50/50 dark:bg-blue-950/30" : ""
                              )}
                            >
                              <div className="flex gap-3">
                                <div className={cn(
                                  "w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                                  n.type === 'success' ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400" : "bg-blue-50 dark:bg-blue-950/80 text-[#2563EB] dark:text-blue-400"
                                )}>
                                  <Bell className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-xs font-semibold text-[#111827] dark:text-slate-100">{n.title}</p>
                                    {!n.read && (
                                      <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mb-1 leading-snug">{n.message}</p>
                                  <p className="text-[9px] text-[#6B7280] dark:text-slate-500 font-semibold uppercase">{n.time}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Avatar */}
              <div ref={profileMenuRef} className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(open => !open)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl transition-colors hover:bg-slate-50 active:scale-95 dark:hover:bg-slate-800"
                  title="Profile menu"
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || user.displayName || 'Resident')}&background=2563EB&color=fff`}
                    alt="Profile"
                    className="h-8 w-8 rounded-full border border-[#E5E7EB] object-cover dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                </button>
                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.14 }}
                      role="menu"
                      aria-label="Profile options"
                      className="absolute right-0 top-full z-[60] mt-2 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{profile?.displayName || user.displayName || 'Account'}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                      <Link to="/settings#profile" role="menuitem" onClick={() => setIsProfileMenuOpen(false)} className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                        <UserRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        My Profile
                      </Link>
                      {canManageAdmins && (
                        <Link to="/admins" role="menuitem" onClick={() => setIsProfileMenuOpen(false)} className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[#15418C] transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50">
                          <ShieldCheck className="h-4 w-4" />
                          Manage Admins
                        </Link>
                      )}
                      <Link to="/settings#account" role="menuitem" onClick={() => setIsProfileMenuOpen(false)} className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        Account Settings
                      </Link>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <button type="button" role="menuitem" onClick={() => { setIsProfileMenuOpen(false); onLogout(); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.header>

          {/* Mobile navigation */}
          <nav className={cn(
            "mobile-nav lg:hidden z-30 flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-slate-800 shadow-sm",
            isAdmin && "admin-mobile-nav"
          )} aria-label="Mobile navigation">
            <div className={cn(
              "grid w-full items-center gap-0.5 px-2 py-1",
              isAdmin && "admin-mobile-nav-items",
              isAdmin ? "grid-cols-6" : "grid-cols-4"
            )}>
              {mobileMenuItems.map((item) => (
                <NavLink
                  key={`${item.label}-${item.path}`}
                  to={item.path}
                  end={item.label === 'Home'}
                  className={({ isActive }) => {
                    return cn(
                      "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0 rounded-[9px] px-0 text-[12px] font-semibold transition-all duration-200 active:scale-[0.96]",
                      isActive
                        ? cn(
                            "bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-300",
                            !isAdmin && "shadow-sm"
                          )
                        : "text-[#64748B] hover:bg-[#F8FAFC] dark:text-slate-400 dark:hover:bg-slate-800"
                    );
                  }}
                  aria-label={item.label}
                >
                  <item.icon className="h-[22px] w-[22px] flex-shrink-0" strokeWidth={2} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(true)}
                className={cn(
                  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0 rounded-[9px] px-0 text-[12px] font-semibold transition-all duration-200 active:scale-[0.96]",
                  isMoreMenuOpen
                    ? cn(
                        "bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-300",
                        !isAdmin && "shadow-sm"
                      )
                    : "text-[#64748B] hover:bg-[#F8FAFC] dark:text-slate-400 dark:hover:bg-slate-800"
                )}
                aria-label="More navigation options"
                aria-expanded={isMoreMenuOpen}
              >
                <Menu className="h-[22px] w-[22px] flex-shrink-0" strokeWidth={2} />
                <span>More</span>
              </button>
            </div>
          </nav>

          {/* Page Content */}
          <main className="mobile-compact-content flex-1 overflow-y-auto overflow-x-hidden px-[14px] py-3.5 sm:p-6 lg:p-8 bg-transparent min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile More menu */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setIsMoreMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240, mass: 0.8 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl z-50 lg:hidden overflow-hidden flex flex-col max-h-[80vh] pb-[max(1rem,env(safe-area-inset-bottom))]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-title"
            >
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mt-3 mb-1" />
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB] dark:border-slate-800">
                <h3 id="mobile-more-title" className="font-bold text-base text-[#111827] dark:text-white">More</h3>
                <button 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center bg-[#F3F4F6] dark:bg-slate-800 text-[#6B7280] dark:text-slate-300 rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                  aria-label="Close More menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3 space-y-1 overflow-y-auto">
                <Link
                  to="/settings"
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex min-h-[56px] items-center gap-3 px-3 rounded-[14px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  <span className="flex-1 font-semibold text-sm text-[#111827] dark:text-slate-100">Settings</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); setIsNotificationsOpen(true); }}
                  className="w-full flex min-h-[56px] items-center gap-3 px-3 rounded-[14px] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  <span className="flex-1 font-semibold text-sm text-[#111827] dark:text-slate-100">Notifications</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMoreMenuOpen(false); onLogout(); }}
                  className="w-full flex min-h-[56px] items-center gap-3 px-3 rounded-[14px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="flex-1 font-semibold text-sm text-red-600 dark:text-red-400">Sign Out</span>
                  <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!isAdmin && (
        <>
          {/* Chatbot Toggle Button */}
          <div className={cn(
            "fixed z-50 transition-all duration-200", 
            "bottom-18 right-4 lg:bottom-6 lg:right-6", 
            isChatOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            <button
              onClick={() => setIsChatOpen(true)}
              className="w-12 h-12 lg:w-[56px] lg:h-[56px] rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
              aria-label="Open AI Assistant"
            >
              <img
                src="/ai-chatbot.svg"
                alt=""
                className="w-10 h-10 lg:w-12 lg:h-12 object-contain"
              />
            </button>
          </div>

          {/* Chatbot Sidebar/Modal */}
          <AnimatePresence>
            {isChatOpen && (
              <Chatbot onClose={() => setIsChatOpen(false)} user={user} profile={profile} />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
