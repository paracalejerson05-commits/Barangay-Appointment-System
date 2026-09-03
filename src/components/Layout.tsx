import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';
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
  Calendar,
  Bot,
  Sparkles,
  Search,
  Sun,
  Clock,
  ShieldAlert,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn, formatTimeAgo } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Chatbot } from './Chatbot';
import { BARANGAY_LOGO_URL, BARANGAY_LOGO_FALLBACK, SYSTEM_NAME } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  profile: any;
  onLogout: () => void;
}

export function Layout({ children, user, profile, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin';

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
    if (!user) return;

    // For admins, show notifications where userId is 'admin'
    // For residents, show notifications where userId is their uid
    const targetUserId = isAdmin ? 'admin' : user.uid;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', targetUserId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        time: doc.data().createdAt?.toDate ? formatTimeAgo(doc.data().createdAt.toDate()) : 'Just now'
      }));
      setNotifications(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleNotificationClick = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
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

  const menuItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ClipboardList, label: 'Requests', path: '/requests' },
    { icon: Users, label: 'Residents', path: '/residents' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ] : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Services', path: '/services' },
    { icon: ClipboardList, label: 'My Requests', path: '/requests' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#F4F7F9] flex p-3 lg:p-4 gap-4 font-sans text-[#111827] relative">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F4F7FB]">
        {/* Abstract Soft Shapes */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-blue-200/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[120px]" />
        
        {/* Soft Wave SVG */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-60" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
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

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 lg:inset-y-4 lg:left-4 z-50 bg-[#15418C] text-white transition-all duration-300 ease-in-out shadow-xl",
          isDesktopCollapsed ? "lg:w-20" : "lg:w-64",
          isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0",
          "lg:rounded-[20px] rounded-r-[20px]"
        )}
      >
        <div className="h-full flex flex-col p-4 relative">
          
          {/* Collapse/Expand Toggle (Desktop only) */}
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="hidden lg:flex absolute -right-3 top-6 bg-white text-[#15418C] w-7 h-7 rounded-full items-center justify-center shadow-md border border-gray-100 cursor-pointer z-50 hover:bg-gray-50 transition-colors"
          >
            {isDesktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute right-4 top-6 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            {/* Logo & Brand Header */}
            <Link to="/" className={cn(
              "flex items-center gap-3 pb-6 mb-2 border-b border-white/10",
              isDesktopCollapsed ? "justify-center" : "px-2"
            )}>
              <div className="h-10 w-10 flex items-center justify-center flex-shrink-0 relative">
                <div className="absolute inset-0 bg-white rounded-full opacity-10"></div>
                <img 
                  src={BARANGAY_LOGO_URL} 
                  alt="Logo" 
                  className="h-full w-full object-contain drop-shadow-md relative z-10 bg-white rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    e.currentTarget.parentElement.innerHTML = '<span class="font-bold text-xl tracking-tighter">RD</span>';
                  }}
                />
              </div>
              <div className={cn("flex flex-col min-w-0 transition-opacity duration-200", isDesktopCollapsed && "hidden")}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  SMART PORTAL
                </span>
                <span className="font-bold text-white text-[15px] leading-tight truncate tracking-wide">
                  {SYSTEM_NAME || 'Barangay Pupua'}
                </span>
              </div>
            </Link>

            {/* Nav Menu */}
            <nav className="space-y-1.5 mt-4">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={isDesktopCollapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    "flex items-center px-3.5 py-3 rounded-[12px] font-medium text-[13px] transition-all duration-200 group relative",
                    isActive 
                      ? "bg-white/15 text-white shadow-inner font-semibold" 
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <div className={cn(
                        "flex items-center justify-center flex-shrink-0 transition-transform duration-200",
                        isDesktopCollapsed ? "mx-auto" : "mr-3",
                        isActive ? "scale-110" : "group-hover:scale-110"
                      )}>
                        <item.icon className="w-5 h-5 stroke-[2]" />
                      </div>
                      
                      <span className={cn(
                        "tracking-wide whitespace-nowrap transition-opacity duration-200",
                        isDesktopCollapsed ? "hidden" : "block opacity-100"
                      )}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 mt-2 border-t border-white/10 space-y-2">
            
            {/* User Status Card */}
            <div className={cn(
              "flex items-center gap-3 border border-white/20 rounded-[12px] transition-all duration-200 overflow-hidden",
              isDesktopCollapsed ? "p-1.5 justify-center border-transparent" : "p-2.5"
            )}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className={cn(
                    "rounded-[8px] object-cover flex-shrink-0 bg-white/10",
                    isDesktopCollapsed ? "w-8 h-8" : "w-10 h-10"
                  )}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={cn(
                  "bg-[#2563EB] text-white flex items-center justify-center rounded-[8px] font-bold flex-shrink-0",
                  isDesktopCollapsed ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
                )}>
                  {profile?.displayName?.substring(0, 2)?.toUpperCase() || user.displayName?.substring(0, 2)?.toUpperCase() || 'AL'}
                </div>
              )}
              
              <div className={cn("min-w-0 flex-1 transition-opacity duration-200", isDesktopCollapsed && "hidden")}>
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.displayName || user.displayName || 'Resident'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", isAdmin ? "bg-amber-400" : "bg-emerald-400")} />
                  <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">
                    {profile?.role || 'Resident'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title={isDesktopCollapsed ? "Sign Out" : undefined}
              className={cn(
                "w-full flex items-center px-3.5 py-3 text-white/80 hover:bg-white/10 hover:text-white rounded-[12px] font-medium text-[13px] transition-all duration-200 cursor-pointer group"
              )}
            >
              <div className={cn(
                "flex items-center justify-center flex-shrink-0",
                isDesktopCollapsed ? "mx-auto" : "mr-3"
              )}>
                <LogOut className="w-5 h-5 stroke-[2]" />
              </div>
              <span className={cn("tracking-wide whitespace-nowrap", isDesktopCollapsed && "hidden")}>
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
        isDesktopCollapsed ? "lg:ml-24" : "lg:ml-72"
      )}>
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          {/* Header */}
          <header className="h-20 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 bg-transparent">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 text-[#6B7280] hover:bg-[#F8FAFC] rounded-[10px] transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#111827] leading-tight tracking-tight truncate">
                    {greeting}, {profile?.displayName?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Resident'}
                  </h2>
                  <span className={cn(
                    "hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                    isAdmin ? "bg-blue-50 text-[#2563EB] border-blue-200" : "bg-slate-100 text-[#6B7280] border-[#E5E7EB]"
                  )}>
                    {isAdmin ? 'Admin' : 'Resident'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                  <span className="font-normal text-[#6B7280] truncate">{currentDate}</span>
                  <span className="w-1 h-1 bg-[#E5E7EB] rounded-full hidden sm:inline-block" />
                  <span className="hidden sm:inline-flex items-center gap-1 font-medium text-[#6B7280]">
                    <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                    {liveTime}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Header Search Bar */}
              <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-48 lg:w-64">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services, requests..."
                  className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] py-1.5 pl-9 pr-3 text-xs font-normal text-[#111827] placeholder:text-[#6B7280] focus:bg-white focus:border-[#2563EB] transition-all outline-none"
                />
              </form>

              <div className="h-5 w-px bg-[#E5E7EB] hidden sm:block" />

              {/* Notifications Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="p-2 text-[#6B7280] hover:bg-[#F8FAFC] rounded-[10px] relative transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#6B7280]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" />
                  )}
                </button>
                
                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 mt-2 w-80 sm:w-90 bg-white rounded-[14px] shadow-lg border border-[#E5E7EB] overflow-hidden z-50"
                    >
                      <div className="p-3.5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-[#2563EB]" />
                          <h4 className="font-bold text-xs text-[#111827] uppercase tracking-wider">Notifications</h4>
                        </div>
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-[#6B7280]">
                            No notifications at this time.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n.id)}
                              className={cn(
                                "p-3 transition-colors cursor-pointer hover:bg-[#F8FAFC]",
                                !n.read ? "bg-blue-50/50" : ""
                              )}
                            >
                              <div className="flex gap-3">
                                <div className={cn(
                                  "w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                                  n.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#2563EB]"
                                )}>
                                  <Bell className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-xs font-semibold text-[#111827]">{n.title}</p>
                                    {!n.read && (
                                      <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#6B7280] mb-1 leading-snug">{n.message}</p>
                                  <p className="text-[9px] text-[#6B7280] font-semibold uppercase">{n.time}</p>
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
              <div className="flex items-center gap-2">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || user.displayName || 'Resident')}&background=2563EB&color=fff`} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-[8px] border border-[#E5E7EB] object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-transparent">
            {children}
          </main>
        </div>
      </div>

      {/* Chatbot Toggle */}
      <div className={cn("fixed bottom-6 right-6 z-50 transition-opacity duration-200", isChatOpen ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <button
          onClick={() => setIsChatOpen(true)}
          className={cn(
            "w-[56px] h-[56px] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
          )}
        >
          <Bot className="w-6 h-6" />
        </button>
      </div>

      {/* Chatbot Sidebar/Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <Chatbot onClose={() => setIsChatOpen(false)} user={user} profile={profile} />
        )}
      </AnimatePresence>
    </div>
  );
}

