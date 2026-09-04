import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  UserPlus,
  BarChart3, 
  Search, 
  ArrowUpRight,
  Loader2,
  Calendar,
  CheckCircle,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Eye, Printer,
  Activity,
  FileSpreadsheet,
  Settings,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { useLocation, Link } from 'react-router-dom';
import { useSchedule } from '../hooks/useSchedule';
import { ScheduleManager } from './ScheduleManager';
import { sendApprovalEmail, sendDisapprovalEmail } from '../lib/email';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { subDays, format, isSameDay } from 'date-fns';

import { AdminReports } from './AdminReports';
import { AdminResidents } from './AdminResidents';
import CertificateEditor from './CertificateEditor';

interface AdminDashboardProps {
  user: User;
  profile: any;
}

export function AdminDashboard({ user, profile }: AdminDashboardProps) {
  const location = useLocation();
  const [requests, setRequests] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'completed' | 'disapproved'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isRequestsPage = location.pathname === '/requests';
  const isResidentsPage = location.pathname === '/residents';
  const isReportsPage = location.pathname === '/reports';
  const isSchedulePage = location.pathname === '/schedule';
  const isOverviewPage = location.pathname === '/';

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const q = query(collection(db, 'serviceRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRequests');
    });

    const fetchResidents = () => {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        setResidents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      });
    };
    const unsubscribeResidents = fetchResidents();

    return () => {
      unsubscribe();
      unsubscribeResidents();
    };
  }, []);

  const stats = [
    { label: 'Total Requests', value: requests.length, icon: FileText, color: 'blue' },
    { label: 'Pending', value: requests.filter(r => r?.status === 'pending').length, icon: Clock, color: 'amber' },
    { label: 'Registrations', value: residents.filter(r => r?.status === 'pending').length, icon: UserPlus, color: 'blue' },
    { label: 'Completed', value: requests.filter(r => r?.status === 'completed').length, icon: CheckCircle, color: 'emerald' },
    { label: 'Residents', value: residents.length, icon: Users, color: 'slate' },
  ];

  // Derived Analytics Data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { date: d, label: format(d, 'MMM dd') };
  });

  const trendData = last7Days.map(d => {
    const dayReqs = requests.filter(r => r.createdAt?.toDate && isSameDay(r.createdAt.toDate(), d.date));
    return {
      name: d.label,
      Total: dayReqs.length,
      Approved: dayReqs.filter(r => r.status === 'approved').length,
      Completed: dayReqs.filter(r => r.status === 'completed').length,
      Pending: dayReqs.filter(r => r.status === 'pending').length,
    };
  });

  const pieData = [
    { name: 'Pending', value: requests.filter(r => r?.status === 'pending').length, color: '#f59e0b' },
    { name: 'Approved', value: requests.filter(r => r?.status === 'approved').length, color: '#2563eb' },
    { name: 'Completed', value: requests.filter(r => r?.status === 'completed').length, color: '#10b981' },
    { name: 'Disapproved', value: requests.filter(r => r?.status === 'disapproved').length, color: '#ef4444' },
  ];

  const servicesCount = requests.reduce((acc, req) => {
    if (req.serviceType) {
      acc[req.serviceType] = (acc[req.serviceType] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topServices = Object.entries(servicesCount)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5)
    .map(([name, value]) => ({ name, count: value }));

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysAppointments = requests.filter(r => r.appointmentDate === todayStr);
  const upcomingAppointments = requests.filter(r => r.appointmentDate && r.appointmentDate > todayStr);
  const currentlyWaiting = todaysAppointments.filter(r => r.status === 'pending' || r.status === 'approved');
  const completedToday = todaysAppointments.filter(r => r.status === 'completed');

  const recentActivity = [...requests.map(r => ({ ...r, activityType: 'request', date: r.createdAt?.toDate() })), ...residents.map(r => ({ ...r, activityType: 'registration', date: r.createdAt?.toDate() }))]
    .filter(a => a.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.residentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.serviceType?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Pagination logic
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto">
      {/* Header Section */}
      {!isReportsPage && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#E2E8F0] flex-shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              {isOverviewPage ? 'Admin Dashboard' : 
               isRequestsPage ? 'Service Requests' : 
               isResidentsPage ? 'Residents' : 
               isSchedulePage ? 'Schedule & Announcements' :
               ''}
            </h1>
            {isOverviewPage && (
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Monitor service requests, residents, appointments, and barangay operations.
              </p>
            )}
          </div>
          
          {isRequestsPage && (
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search resident or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-[8px] py-2 pl-9 pr-3 text-xs focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none transition-all shadow-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-5">
        {isOverviewPage && (
          <div className="flex flex-col gap-5">
            {/* 1. Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="bg-white p-3.5 rounded-[10px] border border-[#E2E8F0] shadow-sm flex items-center gap-3 hover:border-blue-200 transition-colors"
                >
                  <div className={cn(
                    "p-2 rounded-[6px] flex-shrink-0",
                    stat.color === 'blue' ? "bg-[#EFF6FF] text-[#2563EB]" :
                    stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                    stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                    "bg-[#F8FAFC] text-[#64748B]"
                  )}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[#64748B] text-[10px] font-semibold uppercase tracking-wider leading-none mb-1 line-clamp-1">{stat.label}</p>
                    <h3 className="text-lg font-bold text-[#0F172A] leading-none">{stat.value}</h3>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Service Request Trend */}
              <div className="lg:col-span-2 bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4 flex flex-col h-[320px]">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Service Request Trend</h3>
                    <p className="text-[11px] text-[#64748B]">Last 7 days overview</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-0.5">
                    <button className="px-2 py-1 text-[10px] font-semibold bg-white rounded-[4px] shadow-sm text-[#0F172A]">This Week</button>
                    <button className="px-2 py-1 text-[10px] font-semibold text-[#64748B] hover:text-[#0F172A]">This Month</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="Total" stroke="#94A3B8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Pending" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Request Status Donut Chart */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4 flex flex-col h-[320px]">
                <div className="mb-2 flex-shrink-0">
                  <h3 className="text-sm font-bold text-[#0F172A]">Request Status</h3>
                  <p className="text-[11px] text-[#64748B]">All-time status distribution</p>
                </div>
                <div className="flex-1 relative min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-[#0F172A]">{requests.length}</span>
                    <span className="text-[10px] text-[#64748B]">Total</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 flex-shrink-0">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-[11px] text-[#64748B]">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Most Requested Services & Today's Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Most Requested Services */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4 flex flex-col h-[280px]">
                <div className="mb-4 flex-shrink-0">
                  <h3 className="text-sm font-bold text-[#0F172A]">Most Requested Services</h3>
                  <p className="text-[11px] text-[#64748B]">Top 5 services requested by residents</p>
                </div>
                <div className="flex-1 min-h-0">
                  {topServices.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topServices} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#0F172A', width: 120 }} width={120} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} cursor={{ fill: '#F8FAFC' }} />
                        <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#64748B]">No data available yet.</div>
                  )}
                </div>
              </div>

              {/* Today's Appointment & Queue */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4 flex flex-col h-[280px]">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Today's Appointment & Queue</h3>
                    <p className="text-[11px] text-[#64748B]">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex flex-col justify-center">
                    <p className="text-[11px] font-semibold text-[#64748B]">Today's Appointments</p>
                    <p className="text-xl font-bold text-[#0F172A] mt-1">{todaysAppointments.length}</p>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex flex-col justify-center">
                    <p className="text-[11px] font-semibold text-[#64748B]">Upcoming Appointments</p>
                    <p className="text-xl font-bold text-[#0F172A] mt-1">{upcomingAppointments.length}</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-[8px] flex flex-col justify-center">
                    <p className="text-[11px] font-semibold text-amber-700">Currently Waiting</p>
                    <p className="text-xl font-bold text-amber-800 mt-1">{currentlyWaiting.length}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-[8px] flex flex-col justify-center">
                    <p className="text-[11px] font-semibold text-emerald-700">Completed Today</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">{completedToday.length}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-right flex-shrink-0">
                  <Link to="/schedule" className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center justify-end gap-1">
                    Manage Schedule <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </div>

            {/* 4. Recent Requests & Announcements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* Recent Service Requests Table */}
              <div className="lg:col-span-2 bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Recent Service Requests</h3>
                    <p className="text-[11px] text-[#64748B]">Latest resident submissions</p>
                  </div>
                  <Link to="/requests" className="text-xs font-semibold text-[#2563EB] hover:underline">View All</Link>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC]">
                        <th className="font-semibold p-3 pl-4">Resident</th>
                        <th className="font-semibold p-3">Service</th>
                        <th className="font-semibold p-3">Date</th>
                        <th className="font-semibold p-3 text-center">Status</th>
                        <th className="font-semibold p-3 pr-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {loading ? (
                        <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#2563EB]" /></td></tr>
                      ) : filteredRequests.slice(0, 5).map((request) => (
                        <tr key={request.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-3 pl-4 font-semibold text-[#0F172A]">{request.residentName}</td>
                          <td className="p-3 text-[#64748B]">{request.serviceType}</td>
                          <td className="p-3 text-[#64748B]">{request.createdAt?.toDate ? formatDate(request.createdAt.toDate()) : 'N/A'}</td>
                          <td className="p-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider inline-flex items-center gap-1",
                              request.status === 'approved' ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-100" :
                              request.status === 'completed' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              request.status === 'disapproved' ? "bg-red-50 text-red-600 border border-red-100" :
                              "bg-amber-50 text-amber-700 border border-amber-200"
                            )}>
                              {request.status}
                            </span>
                          </td>
                          <td className="p-3 pr-4 text-right">
                            <button 
                              onClick={() => setSelectedRequest(request)} 
                              className="inline-flex items-center justify-center p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-[6px] transition-colors border border-transparent hover:border-blue-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredRequests.length === 0 && !loading && (
                        <tr><td colSpan={5} className="p-8 text-center text-xs text-[#64748B]">No requests found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Latest Announcements */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm flex flex-col max-h-[400px]">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-[#2563EB]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Latest Announcements</h3>
                  </div>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                  <AnnouncementList />
                </div>
                <div className="p-3 border-t border-[#E2E8F0] text-center bg-[#F8FAFC] flex-shrink-0">
                  <Link to="/schedule" className="text-[11px] font-semibold text-[#2563EB] hover:underline">Manage Announcements</Link>
                </div>
              </div>
            </div>

            {/* 5. Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Recent Activity */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Recent System Activity</h3>
                </div>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 relative">
                      {index !== recentActivity.length - 1 && (
                        <div className="absolute left-1 top-4 bottom-[-16px] w-[1px] bg-[#E2E8F0]" />
                      )}
                      <div className="mt-1 w-2 h-2 rounded-full bg-[#2563EB] ring-4 ring-[#EFF6FF] flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-[#0F172A] font-medium leading-tight">
                          {activity.activityType === 'request' 
                            ? `New service request submitted by ${activity.residentName}`
                            : `New resident account registered: ${activity.displayName || activity.email}`
                          }
                        </p>
                        <span className="text-[10px] text-[#64748B] block mt-0.5">{activity.date ? formatDate(activity.date) : 'Recently'}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[11px] text-[#64748B]">No recent activity.</p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm p-4">
                <h3 className="text-sm font-bold text-[#0F172A] mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/requests" className="flex items-center gap-2.5 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-blue-200 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 bg-white rounded-[6px] border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] group-hover:border-blue-300">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">Review Requests</span>
                  </Link>
                  <Link to="/residents" className="flex items-center gap-2.5 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-blue-200 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 bg-white rounded-[6px] border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] group-hover:border-blue-300">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">Manage Residents</span>
                  </Link>
                  <Link to="/schedule" className="flex items-center gap-2.5 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-blue-200 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 bg-white rounded-[6px] border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] group-hover:border-blue-300">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">View Schedule</span>
                  </Link>
                  <Link to="/reports" className="flex items-center gap-2.5 p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#EFF6FF] hover:border-blue-200 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 bg-white rounded-[6px] border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] group-hover:border-blue-300">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">View Reports</span>
                  </Link>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Other Pages */}
        {!isOverviewPage && (
          <div className="flex-1 overflow-y-auto pr-1">
            {isReportsPage && (
              <AdminReports requests={requests} residents={residents} />
            )}
            {isRequestsPage && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
                  <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Total Requests</p>
                    <p className="text-xl font-bold text-[#0F172A] leading-none">{requests.length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Pending</p>
                    <p className="text-xl font-bold text-[#0F172A] leading-none">{requests.filter(r => r.status === 'pending').length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Approved</p>
                    <p className="text-xl font-bold text-[#0F172A] leading-none">{requests.filter(r => r.status === 'approved').length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Completed</p>
                    <p className="text-xl font-bold text-[#0F172A] leading-none">{requests.filter(r => r.status === 'completed').length}</p>
                  </div>
                  <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Disapproved</p>
                    <p className="text-xl font-bold text-[#0F172A] leading-none">{requests.filter(r => r.status === 'disapproved').length}</p>
                  </div>
                </div>

                <div className="bg-white rounded-[10px] border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="p-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center bg-white border border-[#E2E8F0] rounded-[6px] p-0.5 shadow-sm overflow-hidden w-full sm:w-auto overflow-x-auto">
                      {(['all', 'pending', 'approved', 'completed', 'disapproved'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilterStatus(f)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px] whitespace-nowrap",
                            filterStatus === f 
                              ? "bg-[#EFF6FF] text-[#2563EB]" 
                              : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
                          <th className="px-4 py-3">Resident Name</th>
                          <th className="px-4 py-3">Service Type</th>
                          <th className="px-4 py-3">Date & Time</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-center">View</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {paginatedRequests.map((request) => (
                          <tr key={request.id} className="hover:bg-[#F8FAFC] transition-colors group">
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-semibold text-[#0F172A]">{request.residentName}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] text-[#64748B]">{request.serviceType}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-[#0F172A]">
                                  {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                </span>
                                <span className="text-[10px] text-[#64748B]">
                                  {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider inline-block",
                                request.status === 'completed' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                request.status === 'approved' ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-100" :
                                request.status === 'disapproved' ? "bg-red-50 text-red-700 border border-red-100" :
                                "bg-amber-50 text-amber-700 border border-amber-200"
                              )}>
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button 
                                onClick={() => setSelectedRequest(request)} 
                                className="inline-flex items-center justify-center p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-[6px] transition-colors border border-transparent hover:border-blue-100"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {paginatedRequests.length === 0 && !loading && (
                          <tr><td colSpan={5} className="p-8 text-center text-xs text-[#64748B]">No requests found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {filteredRequests.length > 0 && (
                    <div className="p-3 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] flex-shrink-0">
                      <span className="text-[11px] text-[#64748B] font-medium">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} entries
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1 rounded-[6px] border border-[#E2E8F0] text-[#64748B] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-white"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={cn(
                              "w-6 h-6 rounded-[6px] text-[11px] font-semibold transition-all",
                              currentPage === i + 1
                                ? "bg-[#2563EB] text-white shadow-sm"
                                : "text-[#64748B] hover:bg-white border border-transparent hover:border-[#E2E8F0] bg-transparent"
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}

                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1 rounded-[6px] border border-[#E2E8F0] text-[#64748B] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm bg-white"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {isResidentsPage && (
              <AdminResidents residents={residents} />
            )}
            {isSchedulePage && <ScheduleManager />}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <RequestDetailsModal 
            request={selectedRequest} 
            onClose={() => setSelectedRequest(null)}
            user={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RequestDetailsModal({ request: initialRequest, onClose, user }: { request: any, onClose: () => void, user: User }) {
  const [request, setRequest] = useState(initialRequest);
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCertificateEditor, setShowCertificateEditor] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'approved' | 'disapproved' | 'completed'>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setRequest(initialRequest);
    setAdminNotes(initialRequest.adminNotes || '');
  }, [initialRequest]);

  const handleUpdateStatus = async (status: 'approved' | 'disapproved' | 'completed') => {
    if (confirmAction !== status) {
      setConfirmAction(status);
      setErrorMessage('');
      return;
    }
    // Only pending requests can be approved or disapproved.
    // Only approved requests can be completed.
    if ((status === 'approved' || status === 'disapproved') && request.status !== 'pending') {
      setErrorMessage("This request has already been processed."); setConfirmAction(null);
      return;
    }
    if (status === 'completed' && request.status !== 'approved') {
      setErrorMessage("Only approved requests can be marked as completed."); setConfirmAction(null);
      return;
    }

    const messages = {
      approved: "Are you sure you want to approve this request?",
      completed: "Are you sure you want to mark this request as completed?",
      disapproved: "Are you sure you want to disapprove this request?"
    };
    
    

    setIsUpdating(true);
    try {
      const processedAt = serverTimestamp();
      
      await updateDoc(doc(db, 'serviceRequests', request.id), {
        status,
        adminNotes,
        updatedAt: processedAt,
        processedBy: user.uid
      });

      await addDoc(collection(db, 'notifications'), {
        userId: request.residentUid,
        title: `Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: status === 'disapproved' 
          ? `Your request for ${request.serviceType} has been disapproved.\n\nReference ID: ${request.id}\nReason: ${adminNotes || 'Please visit the barangay hall.'}`
          : `Your request for ${request.serviceType} has been approved.\n\nReference ID: ${request.id}\nAppointment: ${new Date(request.appointmentDate).toLocaleDateString()} at ${request.appointmentTime}`,
        type: status === 'approved' || status === 'completed' ? 'success' : 'error',
        read: false,
        referenceId: request.id,
        createdAt: processedAt,
      });

      let emailWarning = "";
      
      if (request.residentEmail) {
        try {
          if (status === 'approved') {
            await sendApprovalEmail({
              residentName: request.residentName || 'Resident',
              residentEmail: request.residentEmail,
              serviceType: request.serviceType,
              approvalDate: new Date().toLocaleDateString(),
              referenceNumber: request.id,
              appointmentDate: new Date(request.appointmentDate).toLocaleDateString(),
              appointmentTime: request.appointmentTime || ''
            });
          } else if (status === 'disapproved') {
            await sendDisapprovalEmail({
              residentName: request.residentName || 'Resident',
              residentEmail: request.residentEmail,
              serviceType: request.serviceType,
              referenceNumber: request.id,
              reason: 'Your request did not meet the requirements or was cancelled by the admin.',
              adminNotes: adminNotes
            });
          }
        } catch (emailError) {
          console.error("Email sending failed:", emailError);
          emailWarning = " Note: Email notification could not be sent.";
        }
      }

      setRequest((prev: any) => ({
        ...prev,
        status,
        adminNotes,
        updatedAt: new Date(),
        processedBy: user.uid
      }));

      if (status === 'approved') {
         setSuccessMessage(`Request Approved Successfully.${emailWarning}`); setTimeout(() => { onClose(); }, 2000);
      } else if (status === 'disapproved') {
         setSuccessMessage(`Request Disapproved Successfully.${emailWarning}`); setTimeout(() => { onClose(); }, 2000);
      } else if (status === 'completed') {
         setSuccessMessage(`Request Completed Successfully.${emailWarning}`); setTimeout(() => { onClose(); }, 2000);
      }
      
    } catch (error) {
      console.error("Error updating request:", error);
      setErrorMessage("Failed to update request: " + (error instanceof Error ? error.message : "Unknown error")); setConfirmAction(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (request.status === 'approved') {
      await handleUpdateStatus('completed');
    }
  };

  if (showCertificateEditor) {
    return (
      <CertificateEditor
        request={request}
        onClose={() => setShowCertificateEditor(false)}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-sm print:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          className={cn(
            "bg-white w-full rounded-[10px] shadow-xl overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[90vh] max-w-2xl"
          )}
        >
            <>
              <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] flex-shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Request Details</h3>
                  <p className="text-[11px] text-[#64748B]">Reference ID: <span className="font-mono">{request.id}</span></p>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-[#E2E8F0] rounded-[6px] transition-colors text-[#64748B] hover:text-[#0F172A]">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Resident Information</h3>
                      <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
                        <div className="w-10 h-10 bg-[#EFF6FF] text-[#2563EB] rounded-full flex items-center justify-center font-bold text-sm border border-blue-100 flex-shrink-0">
                          {request.residentName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-[#0F172A] truncate">{request.residentName}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{request.residentEmail || request.residentUid}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Service Details</h3>
                      <div className="bg-[#F8FAFC] p-3 rounded-[8px] border border-[#E2E8F0]">
                        <p className="text-xs font-bold text-[#0F172A] mb-1.5">{request.serviceType}</p>
                        <p className="text-[11px] text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                          {request.description || <span className="text-[#64748B] italic">No description provided.</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Timeline & Status</h3>
                      <div className="bg-[#F8FAFC] p-4 rounded-[8px] border border-[#E2E8F0] space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Submitted
                          </span>
                          <span className="text-xs font-semibold text-[#0F172A]">{formatDate(request.createdAt)}</span>
                        </div>
                        
                        {request.updatedAt && (
                          <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                            <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Updated
                            </span>
                            <span className="text-xs font-semibold text-[#0F172A]">{formatDate(request.updatedAt)}</span>
                          </div>
                        )}

                        {request.appointmentDate && (
                          <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                            <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Appointment
                            </span>
                            <span className="text-xs font-semibold text-[#0F172A]">{new Date(request.appointmentDate).toLocaleDateString()} {request.appointmentTime && `at ${request.appointmentTime}`}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                          <span className="text-[11px] font-medium text-[#64748B]">Current Status</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider",
                            request.status === 'completed' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            request.status === 'approved' ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-200" :
                            request.status === 'disapproved' ? "bg-red-50 text-red-700 border border-red-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[140px]">
                      <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Admin Notes (Optional)</h3>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        disabled={request.status === 'completed' || request.status === 'disapproved'}
                        placeholder="Internal notes or instructions for the resident..."
                        className="w-full flex-1 bg-white border border-[#E2E8F0] rounded-[8px] p-3 text-xs focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all resize-none outline-none shadow-sm disabled:opacity-75 disabled:bg-gray-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col flex-shrink-0">
  {errorMessage && <div className="text-red-600 text-xs mb-3 text-right bg-red-50 p-2 rounded">{errorMessage}</div>}
  {successMessage && <div className="text-green-600 text-xs mb-3 text-right bg-green-50 p-2 rounded">{successMessage}</div>}
  {confirmAction && !isUpdating && !successMessage && (
    <div className="text-amber-700 text-xs mb-3 text-right bg-amber-50 p-2 rounded flex justify-between items-center">
      <span>Are you sure you want to <b>{confirmAction}</b> this request?</span>
      <button onClick={() => setConfirmAction(null)} className="underline text-gray-500 hover:text-gray-700">Cancel</button>
    </div>
  )}
  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 w-full">
                {request.status === 'pending' && (
                  <>
                    <button 
                      onClick={onClose}
                      className="w-full sm:w-auto px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[6px] hover:bg-[#F1F5F9] transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('disapproved')}
                      className="w-full sm:w-auto px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-[6px] transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      {isUpdating ? "Processing..." : "Disapprove Request"}
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('approved')}
                      className="w-full sm:w-auto px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isUpdating ? "Processing..." : "Approve Request"}
                    </button>
                  </>
                )}
                
                {request.status === 'approved' && (
                  <>
                    <button 
                      onClick={onClose}
                      className="w-full sm:w-auto px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[6px] hover:bg-[#F1F5F9] transition-colors shadow-sm"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => setShowCertificateEditor(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Certificate
                    </button>
                  </>
                )}

                {request.status === 'completed' && (
                  <>
                    <button 
                      onClick={onClose}
                      className="w-full sm:w-auto px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[6px] hover:bg-[#F1F5F9] transition-colors shadow-sm"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => setShowCertificateEditor(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] hover:bg-[#E2E8F0] text-xs font-semibold rounded-[6px] transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reprint Certificate
                    </button>
                  </>
                )}

                {request.status === 'disapproved' && (
                  <button 
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[6px] hover:bg-[#F1F5F9] transition-colors shadow-sm"
                  >
                    Close
                  </button>
                )}
              </div>
              </div>
            </>
        </motion.div>
      </div>
    </>
  );
}

function AnnouncementList() {
  const { announcements } = useSchedule();
  
  if (announcements.length === 0) {
    return <p className="text-[11px] text-[#64748B] italic text-center py-6">No announcements currently available.</p>;
  }

  return (
    <div className="space-y-2.5">
      {announcements.slice(0, 3).map((ann) => (
        <div key={ann.id} className="p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-xs font-bold text-[#0F172A] line-clamp-1">{ann.title || 'Barangay Announcement'}</h4>
            <span className="text-[9px] text-[#64748B] whitespace-nowrap">
              {ann.createdAt?.toDate ? ann.createdAt.toDate().toLocaleDateString() : 'Just now'}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed line-clamp-2">{ann.message}</p>
        </div>
      ))}
    </div>
  );
}
