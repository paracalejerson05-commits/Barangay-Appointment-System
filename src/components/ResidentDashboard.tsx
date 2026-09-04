import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useSchedule } from '../hooks/useSchedule';
import { handleFirestoreError, OperationType } from '../lib/firebase';
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
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

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
  user: User;
  profile: any;
}

export function ResidentDashboard({ user, profile }: ResidentDashboardProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [initialService, setInitialService] = useState<string>('Barangay Clearance');
  const { schedule, getRecommendation, announcements } = useSchedule();
  const [dashboardRec, setDashboardRec] = useState<{ date: string, time: string, display?: string } | null>(null);

  useEffect(() => {
    const fetchDashboardRec = async () => {
      const today = new Date().toISOString().split('T')[0];
      const rec = await getRecommendation(today);
      setDashboardRec(rec);
    };
    if (schedule) fetchDashboardRec();
  }, [schedule]);

  useEffect(() => {
    const q = query(
      collection(db, 'serviceRequests'),
      where('residentUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRequests');
    });

    return () => unsubscribe();
  }, [user.uid]);

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

  const openNewRequest = (serviceName?: string) => {
    if (serviceName) setInitialService(serviceName);
    setShowForm(true);
  };

  const quickServicesList = [
    { name: 'Barangay Clearance', icon: FileCheck },
    { name: 'Certificate of Residency', icon: Award },
    { name: 'Certificate of Indigency', icon: ShieldCheck },
    { name: 'Business Clearance', icon: Briefcase },
    { name: 'Blotter Report', icon: AlertTriangle }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5">
      
      {/* =========================================================================
          1. WELCOME & QUICK ACTIONS HEADER
          ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-[12px] border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              RESIDENT DASHBOARD
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight leading-tight">
            {greeting}, {profile?.displayName || user.displayName || 'Arjay Labutin'}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-normal leading-relaxed">
            Manage your appointments, track requests, and receive queue recommendations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0 pt-1 md:pt-0">
          <button
            onClick={() => openNewRequest()}
            className="h-9 px-3.5 inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[8px] font-semibold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SUMMARY STATISTICS (4 COMPACT SUMMARY CARDS)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Requests */}
        <div className="bg-white p-3.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between h-[135px] hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center flex-shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-blue-100">
              +12% this month
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#64748B]">Total Requests</p>
            <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mt-0.5 leading-none">
              {loading ? '-' : totalCount}
            </h3>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1 font-medium">
              <span>Share of Total</span>
              <span className="font-semibold text-[#0F172A]">{totalPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500" 
                style={{ width: `${totalPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Pending Approval */}
        <div className="bg-white p-3.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between h-[135px] hover:border-amber-200 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-[6px] bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              In Queue Review
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#64748B]">Pending Approval</p>
            <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mt-0.5 leading-none">
              {loading ? '-' : pendingCount}
            </h3>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1 font-medium">
              <span>Share of Total</span>
              <span className="font-semibold text-[#0F172A]">{pendingPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                style={{ width: `${pendingPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Approved */}
        <div className="bg-white p-3.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between h-[135px] hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-blue-100">
              Ready for Pickup
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#64748B]">Approved</p>
            <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mt-0.5 leading-none">
              {loading ? '-' : approvedCount}
            </h3>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1 font-medium">
              <span>Share of Total</span>
              <span className="font-semibold text-[#0F172A]">{approvedPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500" 
                style={{ width: `${approvedPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Completed */}
        <div className="bg-white p-3.5 sm:p-4 rounded-[12px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between h-[135px] hover:border-emerald-200 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {completedCount === 0 ? 'No Completed' : 'Completed'}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#64748B]">Completed</p>
            <h3 className="text-xl font-bold text-[#0F172A] tracking-tight mt-0.5 leading-none">
              {loading ? '-' : completedCount}
            </h3>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1 font-medium">
              <span>Share of Total</span>
              <span className="font-semibold text-[#0F172A]">{completedPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${completedPercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          3. MAIN CONTENT: BALANCED 2-COLUMN SECTION
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ================= LEFT / PRIMARY AREA (7 Cols) ================= */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* UPCOMING APPOINTMENT SECTION */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  UPCOMING APPOINTMENT
                </h2>
              </div>
              {upcomingAppointment && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  upcomingAppointment.status === 'approved' 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  {upcomingAppointment.status === 'approved' ? 'Confirmed' : 'Pending Verification'}
                </span>
              )}
            </div>

            {upcomingAppointment ? (
              <div className="pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F8FAFC] p-3.5 rounded-[10px] border border-[#E2E8F0]">
                  <div>
                    <span className="text-xs text-[#64748B] block font-medium">Service Name</span>
                    <h3 className="text-base font-bold text-[#0F172A]">
                      {upcomingAppointment.serviceType}
                    </h3>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-[#64748B] block font-medium">Designated Window</span>
                    <span className="inline-block font-semibold text-xs text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-blue-100">
                      Counter 2 (Document Release)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
                    <div className="flex items-center gap-1.5 text-[#64748B] text-[11px] font-medium mb-0.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Appointment Date</span>
                    </div>
                    <p className="text-xs font-bold text-[#0F172A]">
                      {formatDate(upcomingAppointment.appointmentDate)}
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
                    <div className="flex items-center gap-1.5 text-[#64748B] text-[11px] font-medium mb-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Appointment Time</span>
                    </div>
                    <p className="text-xs font-bold text-[#0F172A]">
                      {upcomingAppointment.appointmentTime || '2:30 PM'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#64748B]">
                    Please bring 1 valid ID for counter verification.
                  </span>
                  <Link
                    to="/requests"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <span>View Appointment</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] mx-auto flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">No Upcoming Appointment</h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  You do not have any scheduled appointments at Barangay Pupua Hall.
                </p>
                <div className="pt-2">
                  <Link
                    to="/services"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] rounded-[6px] transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Book Appointment</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* RECENT REQUESTS SECTION */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  RECENT REQUESTS
                </h2>
              </div>
              <Link
                to="/requests"
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
              >
                <span>View All Requests</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-[#64748B] text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Loading recent requests...</span>
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-[#64748B]">No requests submitted yet.</p>
                <button
                  onClick={() => openNewRequest()}
                  className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Create your first service request
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {recentRequests.map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-1 last:pb-0">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-[#0F172A]">
                        {req.serviceType}
                      </h4>
                      <p className="text-[11px] text-[#64748B]">
                        Submitted {req.createdAt?.toDate ? formatDate(req.createdAt.toDate()) : 'Recently'}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      {req.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved
                        </span>
                      )}
                      {req.status === 'completed' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200 inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                      {req.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QUICK SERVICES SECTION */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  QUICK SERVICES
                </h2>
              </div>
              <Link
                to="/services"
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
              >
                <span>View All Services</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {quickServicesList.map((svc) => (
                <button
                  key={svc.name}
                  onClick={() => openNewRequest(svc.name)}
                  className="p-2.5 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-blue-200 text-left transition-colors flex items-center gap-2.5 group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-[6px] bg-white border border-[#E2E8F0] text-[#2563EB] flex items-center justify-center flex-shrink-0 group-hover:border-blue-300">
                    <svc.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[#0F172A] block truncate">
                      {svc.name}
                    </span>
                    <span className="text-[10px] text-[#64748B] block">Request online</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ================= RIGHT / INFORMATION AREA (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-5">

          {/* BARANGAY ANNOUNCEMENTS */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  BARANGAY ANNOUNCEMENTS
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-[#64748B]">
                Official Notice
              </span>
            </div>
            
            <div className="space-y-2.5 pt-1">
              {(() => {
                const publishedAnnouncements = (announcements || [])
                  .filter((ann: any) => ann.status === 'Published')
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                if (publishedAnnouncements.length === 0) {
                  return (
                    <div className="p-4 text-center">
                      <p className="text-xs text-[#64748B] italic">No announcements available at this time.</p>
                    </div>
                  );
                }

                // Show only top 2 by default
                return publishedAnnouncements.slice(0, 2).map((ann: any) => (
                  <div key={ann.id} className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#0F172A]">{ann.title}</h4>
                      <span className="text-[10px] text-[#64748B] whitespace-nowrap ml-2">
                        {new Date(ann.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {ann.category && (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#2563EB] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mb-1">
                        {ann.category}
                      </span>
                    )}
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {ann.content || ann.message}
                    </p>
                  </div>
                ));
              })()}
            </div>
            
            <div className="pt-1 text-right">
              <button
                onClick={() => {
                  alert("View all published announcements coming soon!");
                }}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All Announcements</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* OFFICE INFORMATION */}
          <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  OFFICE INFORMATION
                </h2>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-[#64748B]">
                <Clock className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#0F172A] font-semibold block">Office Hours</strong>
                  <span>Monday – Friday: 8:00 AM – 5:00 PM</span>
                  <span className="block text-[11px] text-[#64748B]">(Lunch Break: 12:00 PM – 1:00 PM)</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-[#64748B]">
                <Phone className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#0F172A] font-semibold block">Contact Number</strong>
                  <span>(02) 8123-4567 / info@barangaypupua.gov.ph</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-[#64748B]">
                <MapPin className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#0F172A] font-semibold block">Location</strong>
                  <span>Barangay Pupua Hall, Municipal Compound, J.P. Rizal St.</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* =========================================================================
          4. VISIT & QUEUE RECOMMENDATION (GOVERNMENT IS STYLE)
          ========================================================================= */}
      <div className="bg-white rounded-[12px] p-4 sm:p-5 border border-[#E2E8F0] shadow-sm space-y-4">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-blue-100 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                QUEUE RECOMMENDATION
              </span>
              <h2 className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight tracking-tight">
                Optimal Visit & Appointment Recommendation
              </h2>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Queue Analysis Active</span>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Metric 1: Recommended Time */}
          <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[#64748B] text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Recommended Time</span>
              </div>
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">
                {dashboardRec?.display || <LiveClock />}
              </p>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 font-normal">
              Shortest estimated queue window
            </p>
          </div>

          {/* Metric 2: Best Day to Visit */}
          <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[#64748B] text-xs font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Best Day to Visit</span>
              </div>
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">
                {dashboardRec ? new Date(dashboardRec.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'Friday'}
              </p>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 font-normal">
              Lowest recorded foot traffic
            </p>
          </div>

          {/* Metric 3: Estimated Wait */}
          <div className="p-3.5 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[#64748B] text-xs font-semibold mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Estimated Wait</span>
              </div>
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">
                5–10 Minutes
              </p>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 font-normal">
              Fast track processing
            </p>
          </div>

        </div>

        {/* 2 Information Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
          
          {/* Panel 1: Real-Time Traffic Trends */}
          <div className="p-3.5 rounded-[8px] border border-blue-100 bg-[#EFF6FF]/60 space-y-1">
            <div className="flex items-center gap-2 text-[#0F172A] font-bold text-xs">
              <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>REAL-TIME TRAFFIC TRENDS</span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Peak queue volume is typically observed between <strong className="text-[#0F172A]">10:00 AM – 2:00 PM</strong> on Mondays and Wednesdays. For faster document release, residents are advised to schedule visits during morning opening (8:00 AM – 9:30 AM) or late afternoon (3:30 PM – 5:00 PM).
            </p>
          </div>

          {/* Panel 2: Smart Booking Insight */}
          <div className="p-3.5 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] space-y-1">
            <div className="flex items-center gap-2 text-[#0F172A] font-bold text-xs">
              <BarChart3 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>SMART BOOKING INSIGHT</span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Online appointments are prioritized at Counter 1 & 2. Submitting requirements in advance via online requests reduces counter transaction time to less than 5 minutes upon arrival.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#F1F5F9] text-xs">
          <div className="flex items-center gap-2 text-[#64748B]">
            <AlertCircle className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
            <span className="text-[11px] sm:text-xs">
              System continuously updates recommendations based on counter log timestamps.
            </span>
          </div>

          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 font-semibold text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <span>View Services & Book</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

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
  user: User, 
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

  useEffect(() => {
    const updateRecommendation = async () => {
      if (formData.appointmentDate) {
        const rec = await getRecommendation(formData.appointmentDate);
        const slots = await getAvailableSlots(formData.appointmentDate);
        setRecommendation(rec);
        setAvailableSlots(slots);
      }
    };
    updateRecommendation();
  }, [formData.appointmentDate, schedule]);

  const services = [
    'Barangay Clearance',
    'Certificate of Indigency',
    'Certificate of Residency',
    'Business Clearance',
    'Blotter Report'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isDateAvailable(formData.appointmentDate)) {
      alert("Selected date is not available. Please choose another date.");
      return;
    }

    const dayName = new Date(formData.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = schedule.weekly?.[dayName];
    const specialDate = schedule.specialDates?.find((d: any) => d.date === formData.appointmentDate);
    
    let start = daySchedule?.start;
    let end = daySchedule?.end;
    if (specialDate && !specialDate.closed) {
      start = specialDate.start;
      end = specialDate.end;
    }

    if (formData.appointmentTime < start || formData.appointmentTime > end) {
      alert(`Selected time is outside office hours (${start} - ${end}).`);
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'serviceRequests'), {
        residentUid: user.uid,
        residentName: formData.fullName,
        residentEmail: user.email,
        age: Number(formData.age),
        gender: formData.gender,
        civilStatus: formData.civilStatus,
        serviceType,
        description: formData.purpose,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Failed to submit request. Please check your connection or try again.");
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
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Select Document Service</label>
            <div className="grid grid-cols-2 gap-2">
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

          <div className="grid grid-cols-2 gap-3">
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
