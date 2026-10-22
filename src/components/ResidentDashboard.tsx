import React, { useState, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { useSchedule } from '../hooks/useSchedule';
import { checkProfileCompletion, getAccountStatus } from '../lib/profileUtils';
import { ProfileIncompleteModal } from './ProfileIncompleteModal';
import { AccountStatusNoticeModal } from './AccountStatusNoticeModal';
import { dbDeleteServiceRequest, dbGetServiceRequests, dbCreateServiceRequest, dbAddNotification } from '../lib/supabaseDb';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  Plus, 
  CalendarDays, 
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Calendar,
  Activity,
  Users,
  MapPin,
  Phone,
  Building2,
  Megaphone,
  ChevronRight,
  ShieldCheck,
  Award,
  FileCheck,
  AlertTriangle,
  Briefcase,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { getAppointmentDateKey } from '../lib/appointmentAvailability';

const LiveClock = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{time}</>;
};

interface ResidentDashboardProps {
  user: any;
  profile: any;
}

export function ResidentDashboard({ user, profile }: ResidentDashboardProps) {
  const navigate = useNavigate();
  const profileStatus = checkProfileCompletion(profile, user?.email);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [initialService, setInitialService] = useState<string>('Barangay Clearance');
  const { schedule, getRecommendation, announcements } = useSchedule();
  const [dashboardRec, setDashboardRec] = useState<{ date: string, time: string, display?: string, queueLevel?: string, estimatedWait?: string, reason?: string } | null>(null);

  useEffect(() => {
    if (!schedule) return;
    let active = true;
    const refreshRecommendation = async () => {
      const rec = await getRecommendation(getAppointmentDateKey());
      if (active) setDashboardRec(rec);
    };
    void refreshRecommendation();
    const interval = window.setInterval(() => void refreshRecommendation(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [schedule]);

  useEffect(() => {
    const userId = user?.uid || user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    let active = true;
    const loadRequests = async () => {
      const data = await dbGetServiceRequests(userId, false);
      if (active) {
        setRequests(data);
        setLoading(false);
      }
    };
    loadRequests();
    const channel = supabase
      .channel(`resident-dashboard-requests-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_requests',
        filter: `resident_id=eq.${userId}`
      }, () => { void loadRequests(); })
      .subscribe();
    const interval = setInterval(loadRequests, 10000);
    return () => {
      active = false;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.uid, user?.id]);

  // Compute KPI Statistics
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  const totalPercent = totalCount > 0 ? 100 : 0;
  const pendingPercent = totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0;
  const approvedPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const completedPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Find upcoming appointment (approved or pending with appointmentDate)
  const upcomingAppointment = requests.find(r => 
    (r.status === 'approved' || r.status === 'pending') && r.appointmentDate
  );

  // Recent 3 requests
  const recentRequests = requests.slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  const accountStatus = getAccountStatus(profile, user?.email);
  const [showStatusNoticeModal, setShowStatusNoticeModal] = useState(false);

  const openNewRequest = (serviceName?: string) => {
    if (accountStatus !== 'approved') {
      setShowStatusNoticeModal(true);
      return;
    }
    if (!profileStatus.isComplete) {
      setShowIncompleteModal(true);
      return;
    }
    if (serviceName) setInitialService(serviceName);
    setShowForm(true);
  };

  const handleDeleteRequest = async (request: any) => {
    if (!window.confirm(`Delete your pending ${request.serviceType} request? This cannot be undone.`)) return;

    setDeletingRequestId(request.id);
    try {
      await dbDeleteServiceRequest(request.id);
      setRequests(current => current.filter(item => item.id !== request.id));
    } catch (error: any) {
      window.alert(error?.message || 'The request could not be deleted. Please try again.');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const quickServicesList = [
    { name: 'Barangay Clearance', icon: FileCheck },
    { name: 'Certificate of Residency', icon: Award },
    { name: 'Certificate of Indigency', icon: ShieldCheck },
    { name: 'BADAC Clearance', icon: Briefcase },
    { name: 'Blotter Report', icon: AlertTriangle }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-5 pb-20 lg:pb-2">
      
      {/* =========================================================================
          COMPACT INCOMPLETE PROFILE WARNING BANNER
          ========================================================================= */}
      {!profileStatus.isComplete && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-[12px] p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                Complete your profile
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 font-normal">
                Please complete your resident information before submitting a service request.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-full sm:w-auto h-11 sm:h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-[8px] font-semibold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          1. WELCOME & QUICK ACTIONS HEADER
          ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-[12px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#1E3A8A] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 transition-colors duration-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
              RESIDENT DASHBOARD
            </span>
          </div>
          <p className="text-[14px] text-[#64748B] dark:text-slate-400 font-normal leading-relaxed">
            View your appointments, service requests, and queue recommendations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center w-full md:w-auto gap-2.5 flex-shrink-0 pt-0.5 md:pt-0">
          <button
            onClick={() => openNewRequest()}
            className="w-full md:w-auto h-10 md:h-9 px-4 md:px-3.5 inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[8px] font-semibold text-[13px] sm:text-sm transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SUMMARY STATISTICS (3 COMPACT SUMMARY CARDS - ROW ON MOBILE & DESKTOP)
          ========================================================================= */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        
        {/* Card 1: Pending */}
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-amber-500 shadow-2xs sm:shadow-xs flex flex-col justify-center h-[76px] sm:h-[100px] hover:border-amber-200 dark:hover:border-amber-800 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-[6px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] dark:text-slate-400 truncate">Pending</p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-none">
            {loading ? '-' : pendingCount}
          </h3>
        </div>

        {/* Card 2: Approved */}
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#0284C7] shadow-2xs sm:shadow-xs flex flex-col justify-center h-[76px] sm:h-[100px] hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-[6px] bg-[#EFF6FF] dark:bg-blue-950/80 text-[#2563EB] dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] dark:text-slate-400 truncate">Approved</p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-none">
            {loading ? '-' : approvedCount}
          </h3>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-emerald-500 shadow-2xs sm:shadow-xs flex flex-col justify-center h-[76px] sm:h-[100px] hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-[6px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-[#64748B] dark:text-slate-400 truncate">Completed</p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-none">
            {loading ? '-' : completedCount}
          </h3>
        </div>

      </div>

      {/* =========================================================================
          3. MAIN CONTENT
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        
        {/* ================= UPCOMING APPOINTMENT ================= */}
        <div id="appointments" className="lg:col-span-7 order-1 scroll-mt-4 bg-white dark:bg-slate-900 rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#1E3A8A] shadow-xs flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              <h2 className="text-[14px] sm:text-[16px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
                UPCOMING APPOINTMENT
              </h2>
            </div>
            {upcomingAppointment && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                upcomingAppointment.status === 'approved' 
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
              )}>
                {upcomingAppointment.status === 'approved' ? 'Confirmed' : 'Pending'}
              </span>
            )}
          </div>

          {upcomingAppointment ? (
            <div className="pt-4 space-y-3 flex-1 flex flex-col justify-center">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F8FAFC] dark:bg-slate-800/80 p-3.5 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700">
                <div>
                  <span className="text-[12px] text-[#64748B] dark:text-slate-400 block font-medium">Service Name</span>
                  <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                    {upcomingAppointment.serviceType}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[12px] text-[#64748B] dark:text-slate-400 block font-medium">Designated Window</span>
                  <span className="inline-block font-semibold text-[11px] text-[#2563EB] dark:text-blue-400 bg-[#EFF6FF] dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900 mt-0.5">
                    Counter 2 (Document Release)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800/80 rounded-[8px] border border-[#E2E8F0] dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[#64748B] dark:text-slate-400 text-[11px] font-medium mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    <span>Appointment Date</span>
                  </div>
                  <p className="text-[13px] sm:text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                    {formatDate(upcomingAppointment.appointmentDate)}
                  </p>
                </div>

                <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800/80 rounded-[8px] border border-[#E2E8F0] dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[#64748B] dark:text-slate-400 text-[11px] font-medium mb-0.5">
                    <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    <span>Appointment Time</span>
                  </div>
                  <p className="text-[13px] sm:text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                    {upcomingAppointment.appointmentTime || '2:30 PM'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[12px] mt-auto">
                <span className="text-[11px] text-[#64748B] dark:text-slate-400 hidden sm:inline-block">
                  Please bring 1 valid ID for counter verification.
                </span>
                <Link
                  to="/requests"
                  className="inline-flex items-center gap-1 font-semibold text-[#2563EB] dark:text-blue-400 hover:underline ml-auto"
                >
                  <span>View Appointment</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-8 lg:min-h-[140px] text-center">
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-blue-950/80 text-[#2563EB] dark:text-blue-400 flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-[14px] font-bold text-[#0F172A] dark:text-slate-100 mb-1">No Upcoming Appointment</h3>
              <p className="text-[13px] text-[#64748B] dark:text-slate-400 mb-3">
                You don't have a scheduled appointment.
              </p>
              <Link
                to="/services"
                className="inline-flex items-center justify-center w-full sm:w-auto gap-1.5 h-10 sm:h-9 px-4 sm:px-3 text-[13px] sm:text-[13px] font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-[8px] transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span>Book Appointment</span>
              </Link>
            </div>
          )}
        </div>

        {/* ================= BARANGAY ANNOUNCEMENTS ================= */}
        <div className="lg:col-span-5 lg:row-span-3 order-2 bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] border-t-[3px] border-t-indigo-600 shadow-xs flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-[14px] sm:text-[16px] font-bold tracking-tight text-[#0F172A]">
                BARANGAY ANNOUNCEMENTS
              </h2>
            </div>
          </div>
          
          <div className="flex-1 pt-3 space-y-3">
            {(() => {
              const publishedAnnouncements = (announcements || [])
                .filter((ann: any) => ann.status === 'Published')
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              if (publishedAnnouncements.length === 0) {
                return (
                  <div className="py-6 text-center h-full flex flex-col items-center justify-center">
                    <p className="text-[13px] text-[#64748B] mb-2">No new announcements.</p>
                  </div>
                );
              }

              // Show only top 3 by default
              return publishedAnnouncements.slice(0, 3).map((ann: any) => (
                <div key={ann.id} className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-[13px] font-bold text-[#0F172A] leading-tight line-clamp-1 pr-2">{ann.title}</h4>
                    <span className="text-[10px] text-[#64748B] whitespace-nowrap">
                      {new Date(ann.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#64748B] leading-relaxed line-clamp-2">
                    {ann.content || ann.message}
                  </p>
                </div>
              ));
            })()}
          </div>
          
          <div className="pt-3 mt-auto text-right border-t border-[#F1F5F9]">
            <button
              onClick={() => alert("View all published announcements coming soon!")}
              className="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All Announcements</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ================= RECENT REQUESTS ================= */}
        <div className="lg:col-span-7 order-3 bg-white dark:bg-slate-900 rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#2563EB] shadow-xs flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              <h2 className="text-[14px] sm:text-[16px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
                RECENT REQUESTS
              </h2>
            </div>
            <Link
              to="/requests"
              className="text-[13px] font-semibold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View All Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="pt-2 flex-1">
            {loading ? (
              <div className="py-6 text-center text-[#64748B] dark:text-slate-400 text-[13px] flex items-center justify-center gap-2 h-full">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Loading requests...</span>
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="py-6 text-center flex flex-col items-center justify-center h-full">
                <p className="text-[13px] text-[#64748B] dark:text-slate-400 mb-2">No requests submitted yet.</p>
                <button
                  onClick={() => openNewRequest()}
                  className="text-[13px] font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Create your first service request
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9] dark:divide-slate-800">
                {recentRequests.map((req) => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-0">
                    <div>
                      <h4 className="text-[13px] sm:text-[14px] font-bold text-[#0F172A] dark:text-slate-100">
                        {req.serviceType}
                      </h4>
                      <p className="text-[11px] sm:text-[12px] text-[#64748B] dark:text-slate-400 mt-0.5">
                        {formatDate(req.createdAt)}
                      </p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 border",
                        req.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800" :
                        req.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800" :
                        req.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800" :
                        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800"
                      )}>
                        {req.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                        {req.status === 'pending' && <Clock className="w-3 h-3" />}
                        {req.status === 'rejected' && <XCircle className="w-3 h-3" />}
                        <span className="uppercase tracking-wider">{req.status}</span>
                      </span>
                      {req.status?.toLowerCase() === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req)}
                          disabled={deletingRequestId === req.id}
                          title="Delete pending request"
                          aria-label={`Delete ${req.serviceType} request`}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingRequestId === req.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                      <Link to="/requests" className="hidden sm:flex text-[12px] font-semibold text-[#2563EB] hover:underline items-center gap-1">
                        View
                      </Link>
                      <Link to="/requests" className="sm:hidden text-[#64748B] hover:text-[#2563EB]">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================= QUICK SERVICES ================= */}
        <div className="lg:col-span-7 order-4 bg-white dark:bg-slate-900 rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-sky-600 shadow-xs flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              <h2 className="text-[14px] sm:text-[16px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
                QUICK SERVICES
              </h2>
            </div>
            <Link
              to="/services"
              className="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
            >
              <span>View All Services</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-3">
            {quickServicesList.slice(0, 4).map((svc) => (
              <button
                key={svc.name}
                onClick={() => openNewRequest(svc.name)}
                className="p-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-blue-200 text-left transition-colors flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-[6px] bg-white border border-[#E2E8F0] text-[#2563EB] flex items-center justify-center flex-shrink-0 group-hover:border-blue-300">
                  <svc.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] sm:text-[14px] font-bold text-[#0F172A] block truncate">
                    {svc.name}
                  </span>
                  <span className="text-[11px] text-[#64748B] block mt-0.5">Request online</span>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* =========================================================================
          4. VISIT & QUEUE RECOMMENDATION
          ========================================================================= */}
      {((user?.user_metadata?.aiPrefs?.queueRecommendations ?? profile?.aiPrefs?.queueRecommendations) !== false && (user?.user_metadata?.aiPrefs?.smartSuggestions ?? profile?.aiPrefs?.smartSuggestions) !== false) && (
      <div className="bg-white dark:bg-slate-900 rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#2563EB] shadow-xs space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-[14px] sm:text-[16px] font-bold text-[#0F172A] tracking-tight">
              SMART QUEUE RECOMMENDATION
            </h2>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold self-start sm:self-auto">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>Active</span>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] mb-0.5">Recommended Time</p>
            <p className="text-[14px] sm:text-[16px] font-bold text-[#0F172A] dark:text-slate-100">{dashboardRec?.display || <LiveClock />}</p>
          </div>
          <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] mb-0.5">Best Day</p>
            <p className="text-[14px] sm:text-[16px] font-bold text-[#0F172A] dark:text-slate-100">{dashboardRec ? new Date(dashboardRec.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'No schedule data'}</p>
          </div>
          <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] mb-0.5">Current Queue</p>
            <p className="text-[14px] sm:text-[16px] font-bold text-[#0F172A] dark:text-slate-100">{dashboardRec?.queueLevel || 'Not enough data'}</p>
          </div>
          <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-[#64748B] mb-0.5">Estimated Wait</p>
            <p className="text-[14px] sm:text-[16px] font-bold text-[#0F172A] dark:text-slate-100">{dashboardRec?.estimatedWait || 'Not enough queue data'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <span className="text-[12px] text-[#64748B]">
            {dashboardRec?.reason || 'Based on available appointment slots and current queue activity.'}
          </span>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button className="h-11 sm:h-9 flex items-center justify-center text-[13px] font-semibold text-[#2563EB] hover:underline cursor-pointer" onClick={() => alert('View Recommendation details coming soon')}>
              View Recommendation <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
            <Link
              to="/services"
              className="inline-flex items-center justify-center w-full sm:w-auto gap-1.5 h-11 sm:h-9 px-4 sm:px-3 text-[14px] sm:text-[13px] font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-[8px] transition-colors shadow-sm"
            >
              <span>Book Appointment <ArrowRight className="w-3.5 h-3.5 ml-1" /></span>
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          NEW SERVICE REQUEST MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showForm && (
          <ServiceRequestForm 
            onClose={() => setShowForm(false)} 
            user={user} 
            profile={profile}
            initialService={initialService}
          />
        )}
      </AnimatePresence>

      {/* =========================================================================
          PROFILE INCOMPLETE MODAL
          ========================================================================= */}
      <ProfileIncompleteModal
        isOpen={showIncompleteModal}
        onClose={() => setShowIncompleteModal(false)}
        missingFields={profileStatus.missingFields}
        title="Complete Your Profile"
        message="Please complete your required resident information before submitting a service request."
        onCompleteProfile={() => {
          setShowIncompleteModal(false);
          navigate('/settings');
        }}
      />

      {/* =========================================================================
          ACCOUNT STATUS NOTICE MODAL (FOR REJECTED / PENDING RESIDENTS)
          ========================================================================= */}
      <AccountStatusNoticeModal
        isOpen={showStatusNoticeModal}
        onClose={() => setShowStatusNoticeModal(false)}
        status={accountStatus}
        onGoToSettings={() => navigate('/settings')}
      />
    </div>
  );
}

function ServiceRequestForm({ 
  onClose, 
  user, 
  profile,
  initialService = 'Barangay Clearance'
}: { 
  onClose: () => void, 
  user: any, 
  profile: any,
  initialService?: string 
}) {
  const [serviceType, setServiceType] = useState(initialService);
  const [formData, setFormData] = useState({
    fullName: profile?.displayName || user.displayName || '',
    age: profile?.age || '',
    gender: profile?.gender || 'Male',
    civilStatus: profile?.civilStatus || 'Single',
    purpose: '',
    appointmentDate: '',
    appointmentTime: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { schedule, getRecommendation, isDateAvailable, getAvailableSlots } = useSchedule();
  const [recommendation, setRecommendation] = useState<{ date: string, time: string, display: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!formData.appointmentDate) return;
    let active = true;
    const updateRecommendation = async () => {
      const [rec, slots] = await Promise.all([
        getRecommendation(formData.appointmentDate, serviceType),
        getAvailableSlots(formData.appointmentDate)
      ]);
      if (!active) return;
      setRecommendation(rec);
      if (!schedule?.weekly) {
        setValidationError('No appointment schedule has been configured by the administrator yet.');
        return;
      }
      setAvailableSlots(slots);
    };
    void updateRecommendation();
    const interval = window.setInterval(() => void updateRecommendation(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [formData.appointmentDate, schedule]);

  const services = [
    'Barangay Clearance',
    'Certificate of Indigency',
    'Certificate of Residency',
    'BADAC Clearance',
    'Blotter Report'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const residentUid = user?.uid || user?.id;
    if (!residentUid) {
      setValidationError('Your session has expired. Please sign in again.');
      return;
    }

    if (getAccountStatus(profile, user?.email) !== 'approved') {
      setValidationError('Your account is still pending approval. Please wait for the administrator to approve your registration before submitting a request.');
      return;
    }

    const profileCheck = checkProfileCompletion(profile, user?.email);
    if (!profileCheck.isComplete) {
      setValidationError(`Your profile is incomplete. Please complete your required resident information before submitting a service request: ${profileCheck.missingFields.join(', ')}`);
      return;
    }
    
    if (!isDateAvailable(formData.appointmentDate)) {
      alert("Selected date is not available. Please choose another date.");
      return;
    }

    const refreshedSlots = await getAvailableSlots(formData.appointmentDate);
    setAvailableSlots(refreshedSlots);
    const selectedSlot = refreshedSlots.find(slot => slot.time === formData.appointmentTime && !slot.isFull);
    if (!selectedSlot) {
      const nextSlot = await getRecommendation(formData.appointmentDate, serviceType);
      if (nextSlot) {
        setFormData(current => ({ ...current, appointmentDate: nextSlot.date, appointmentTime: nextSlot.time }));
        setRecommendation(nextSlot);
        alert(`That time is no longer available. The next available slot is ${nextSlot.display}. Please submit the request again to confirm it.`);
      } else {
        alert('There are no available administrator-defined appointment slots. Please choose another date.');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await dbCreateServiceRequest({
        residentUid,
        residentName: formData.fullName,
        residentEmail: user.email,
        serviceType,
        description: formData.purpose,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        status: 'pending',
      });
      if (!created) throw new Error('Service request could not be saved to Supabase.');

      // Create notification for admin
      await dbAddNotification({
        userId: 'admin',
        title: 'New Service Request',
        message: `${formData.fullName} submitted a request for ${serviceType}.`,
        type: 'info'
      });

      onClose();
    } catch (error) {
      console.error("Error submitting request:", error);
      alert(error instanceof Error ? error.message : "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-white w-full max-w-lg rounded-[12px] shadow-xl overflow-hidden max-h-[90vh] flex flex-col border border-[#E2E8F0]"
      >
        <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#EFF6FF] text-[#2563EB] rounded-[6px] flex items-center justify-center border border-blue-100">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] text-sm">New Service Request</h3>
              <p className="text-[11px] text-[#64748B]">Fill in the details to submit your request.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-[#F8FAFC] rounded-[6px] transition-colors cursor-pointer text-[#64748B] hover:text-[#0F172A]"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-[8px] flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Select Document Service</label>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              {services.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => setServiceType(service)}
                  className={cn(
                    "px-3 py-2 rounded-[8px] text-xs font-semibold border transition-all text-left cursor-pointer",
                    serviceType === service 
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" 
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                  )}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Age</label>
              <input
                type="number"
                required
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Civil Status</label>
              <select
                value={formData.civilStatus}
                onChange={(e) => setFormData({ ...formData, civilStatus: e.target.value })}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
              >
                <option>Single</option>
                <option>Married</option>
                <option>Widowed</option>
                <option>Separated</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Appointment Date</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.appointmentDate}
                onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value, appointmentTime: '' })}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
              />
              {!isDateAvailable(formData.appointmentDate) && formData.appointmentDate && (
                <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Barangay Hall is closed on this date.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Preferred Time Slot</label>
              <div className="relative">
                <select
                  required
                  disabled={availableSlots.length === 0}
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2 pr-8 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors appearance-none disabled:opacity-50"
                >
                  <option value="">{availableSlots.length === 0 ? 'Select date first' : 'Select time slot'}</option>
                  {availableSlots.map((slot) => (
                    <option key={slot.time} value={slot.time} disabled={slot.isFull}>
                      {slot.display} {slot.isFull ? '(FULL)' : (recommendation?.time === slot.time ? '(Recommended)' : '')}
                    </option>
                  ))}
                </select>
                <Clock className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {recommendation && (
            <div className="bg-[#EFF6FF] p-3 rounded-[8px] border border-blue-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="text-[11px] font-semibold text-[#0F172A]">AI Rec: {recommendation.display}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, appointmentDate: recommendation.date, appointmentTime: recommendation.time })}
                className="bg-white border border-blue-200 text-[#2563EB] px-2.5 py-1 rounded-[6px] text-[11px] font-semibold hover:bg-[#EFF6FF] transition-colors cursor-pointer shadow-sm"
              >
                Use Slot
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Purpose of Request</label>
            <textarea
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="State reason (e.g., employment requirement, scholarship application...)"
              className="w-full bg-white border border-[#E2E8F0] rounded-[8px] p-2.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors h-20 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-[8px] font-semibold text-xs text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-9 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[8px] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
