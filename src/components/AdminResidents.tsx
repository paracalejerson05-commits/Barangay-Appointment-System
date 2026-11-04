import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, UserPlus, Filter, MoreVertical, Eye, Edit, Trash2, 
  X, Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, XCircle,
  Check, Phone, MapPin, Calendar, Clock, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, parseToDate } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { deleteUserFromSupabase, syncUserToSupabase, updateUserStatusInSupabase } from '../lib/supabaseSync';
import { dbAddNotification, dbGetServiceRequests } from '../lib/supabaseDb';
import { checkProfileCompletion } from '../lib/profileUtils';
import { AccountStatusBadge } from './AccountStatusBadge';

interface AdminResidentsProps {
  residents: any[];
  onAction?: () => void;
}

export function AdminResidents({ residents, onAction }: AdminResidentsProps) {
  const [residentList, setResidentList] = useState<any[]>(residents || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [residentLoadError, setResidentLoadError] = useState('');
  const [residentLoadAttempt, setResidentLoadAttempt] = useState(0);

  // Rejection confirmation modal state
  const [residentToReject, setResidentToReject] = useState<any | null>(null);

  // Deactivation and deletion modal & notification states
  const [residentToDelete, setResidentToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync residentList from Supabase users table and incoming props
  useEffect(() => {
    let active = true;
    async function fetchFromSupabase() {
      let sbMapped: any[] = [];
      let hasAuthoritativeSupabaseData = false;
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
          if (error) {
            console.error('[Admin Residents] Could not load resident registrations from Supabase:', error.message);
            if (active) setResidentLoadError(`Resident registrations could not be loaded from Supabase: ${error.message}`);
          } else if (data) {
            hasAuthoritativeSupabaseData = true;
            if (active) setResidentLoadError('');
            sbMapped = data.map(u => ({
              uid: u.id,
              id: u.id,
              displayName: u.display_name || u.email?.split('@')[0] || 'Resident',
              email: u.email,
              role: u.role || 'resident',
              contactNumber: u.contact_number,
              age: u.age,
              date_of_birth: u.date_of_birth,
              gender: u.gender,
              civilStatus: u.civil_status,
              address: u.address,
              house_street: u.house_street,
              purok_sitio: u.purok_sitio,
              barangay: u.barangay,
              municipality_city: u.municipality_city,
              province: u.province,
              id_type: u.id_type,
              id_type_other: u.id_type_other,
              id_front_path: u.id_front_path,
              id_back_path: u.id_back_path,
              face_photo_path: u.face_photo_path,
              face_registration_method: u.face_registration_method,
              verification_status: u.verification_status,
              privacy_consent_at: u.privacy_consent_at,
              status: u.status || (u.role === 'admin' ? 'approved' : 'pending'),
              createdAt: u.created_at ? new Date(u.created_at) : new Date(),
              lastLoginAt: u.updated_at ? new Date(u.updated_at) : new Date()
            }));
          }
        } else {
          if (active) setResidentLoadError('Supabase is not configured. Resident registrations cannot be loaded.');
        }
      } catch (error) {
        console.error('[Admin Residents] Unexpected error loading resident registrations:', error);
        if (active) {
          setResidentLoadError(error instanceof Error
            ? `Resident registrations could not be loaded: ${error.message}`
            : 'Resident registrations could not be loaded. Please retry.');
        }
      }

      const map = new Map<string, any>();
      sbMapped.forEach(r => map.set(r.uid || r.id, r));
      if (!hasAuthoritativeSupabaseData) {
        (residents || []).forEach(r => {
          const id = r.uid || r.id;
          if (!map.has(id)) {
            map.set(id, r);
          } else {
            map.set(id, { ...map.get(id), ...r });
          }
        });
      }
      const sortedList = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
        return timeB - timeA;
      }).filter((resident, index, list) => {
        const email = String(resident.email || '').trim().toLowerCase();
        return !email || list.findIndex(item => String(item.email || '').trim().toLowerCase() === email) === index;
      });
      if (active) setResidentList(sortedList);
    }
    fetchFromSupabase();

    const channel = supabase
      .channel('admin-residents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchFromSupabase();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [residents, residentLoadAttempt]);

  const getStatus = (resident: any): 'pending' | 'active' | 'inactive' => {
    if (resident.role === 'admin' || resident.email === 'paracalejerson05@gmail.com') {
      return 'active';
    }
    const raw = (resident.status || '').toLowerCase().trim();
    if (raw === 'rejected' || raw === 'disapproved' || raw === 'inactive' || raw === 'deactivated') {
      return 'inactive';
    }
    if (raw === 'approved' || raw === 'active') {
      return resident.verification_status === 'approved'
        && checkProfileCompletion(resident, resident.email).isComplete
        ? 'active'
        : 'pending';
    }
    // Default for newly registered residents
    return 'pending';
  };

  const filteredResidents = residentList.filter(resident => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      resident.displayName?.toLowerCase().includes(term) ||
      resident.email?.toLowerCase().includes(term) ||
      resident.contactNumber?.includes(searchTerm) ||
      resident.address?.toLowerCase().includes(term);
    
    const status = getStatus(resident);
    const matchesFilter = filter === 'all' || status === filter;
    
    return matchesSearch && matchesFilter;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredResidents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResidents = filteredResidents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Stats dynamically computed from residentList
  const stats = {
    total: residentList.length,
    pending: residentList.filter(r => getStatus(r) === 'pending').length,
    active: residentList.filter(r => getStatus(r) === 'active').length,
    inactive: residentList.filter(r => getStatus(r) === 'inactive').length,
  };

  // Approve resident action
  const handleApprove = async (resident: any) => {
    const targetUid = resident.uid || resident.id;
    if (!targetUid) return;

    setIsProcessing(true);
    try {
      // 1. Update status in Supabase
      const sbResult = await updateUserStatusInSupabase(targetUid, 'active');
      if (!sbResult.success) {
        throw new Error(sbResult.error || 'Failed to update status in Supabase');
      }

      // 2. Send approval notification to the resident via Supabase
      const notifData = {
        userId: targetUid,
        title: 'Account Approved',
        message: 'Your resident registration has been approved by the Barangay Administrator. You can now request Barangay services.',
        type: 'success'
      };
      await dbAddNotification(notifData);

      // 4. Update local state
      setResidentList(prev => prev.map(r => {
        if ((r.uid || r.id) === targetUid) {
          return { ...r, status: 'approved', verification_status: 'approved' };
        }
        return r;
      }));

      // If selectedResident is currently open in modal, update it
      setSelectedResident((prev: any) => prev && (prev.uid || prev.id) === targetUid ? { ...prev, status: 'approved', verification_status: 'approved' } : prev);

      setNotification({
        type: 'success',
        message: `${resident.displayName || resident.email} has been approved successfully.`
      });
      if (onAction) onAction();
    } catch (err: any) {
      console.error('Approve resident error:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to approve resident.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject resident action modal trigger
  const handleReject = (resident: any) => {
    if (resident.role === 'admin' || resident.email === 'paracalejerson05@gmail.com') {
      setNotification({
        type: 'error',
        message: 'Admin accounts cannot be rejected.'
      });
      return;
    }
    setResidentToReject(resident);
  };

  // Confirm rejection
  const confirmRejectResident = async () => {
    if (!residentToReject) return;
    const targetUid = residentToReject.uid || residentToReject.id;
    if (!targetUid) return;

    setIsProcessing(true);
    try {
      // 1. Update status in Supabase
      const sbResult = await updateUserStatusInSupabase(targetUid, 'inactive');
      if (!sbResult.success) {
        throw new Error(sbResult.error || 'Failed to update status in Supabase');
      }

      // 2. Send notification to resident via Supabase
      const notifData = {
        userId: targetUid,
        title: 'Account Registration Status',
        message: 'Your resident account registration was not approved by the Administrator. Please visit the Barangay Hall for verification.',
        type: 'error'
      };
      await dbAddNotification(notifData);

      // 4. Update local state
      setResidentList(prev => prev.map(r => {
        if ((r.uid || r.id) === targetUid) {
          return { ...r, status: 'inactive', verification_status: 'rejected' };
        }
        return r;
      }));

      setSelectedResident((prev: any) => prev && (prev.uid || prev.id) === targetUid ? { ...prev, status: 'inactive', verification_status: 'rejected' } : prev);

      setNotification({
        type: 'success',
        message: `Registration for ${residentToReject.displayName || residentToReject.email} has been rejected.`
      });
      setResidentToReject(null);
      if (onAction) onAction();
    } catch (err: any) {
      console.error('Reject resident error:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to reject resident registration.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = (resident: any) => {
    // Prevent deleting an Admin account
    if (resident.role === 'admin' || resident.email === 'paracalejerson05@gmail.com') {
      setNotification({
        type: 'error',
        message: 'Admin accounts cannot be deleted.'
      });
      return;
    }
    setResidentToDelete(resident);
  };

  const confirmDeleteResident = async () => {
    if (!residentToDelete) return;

    if (residentToDelete.role === 'admin' || residentToDelete.email === 'paracalejerson05@gmail.com') {
      setNotification({
        type: 'error',
        message: 'Admin accounts cannot be deleted.'
      });
      setResidentToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      const targetUid = residentToDelete.uid || residentToDelete.id;
      if (!targetUid) {
        throw new Error('Resident identifier is missing.');
      }

      const deleteResult = await deleteUserFromSupabase(targetUid);
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to remove resident from Supabase.');
      }

      setResidentList(prev => prev.filter(r => (r.uid || r.id) !== targetUid));
      setResidentToDelete(null);

      setNotification({
        type: 'success',
        message: 'Resident successfully removed.'
      });

      if (onAction) {
        onAction();
      }
    } catch (error: any) {
      console.error('Error deleting resident:', error);
      setNotification({
        type: 'error',
        message: error?.message || 'Failed to remove resident from database.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (resident: any) => {
    setSelectedResident(resident);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5 w-full">
      {/* Directory intro */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2563EB] dark:text-blue-400 mb-1.5">Resident Operations</p>
          <p className="text-[13px] text-[#64748B] dark:text-slate-400">Review registrations, verify profiles, and manage resident access.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] text-[#94A3B8] dark:text-slate-500">Directory status</p>
          <p className="text-xs font-semibold text-[#334155] dark:text-slate-200">Updated automatically</p>
        </div>
      </div>

      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
              "px-4 py-3 rounded-[12px] border flex items-center justify-between gap-3 text-xs font-medium shadow-sm",
              notification.type === 'success'
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            )}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-black/5 rounded transition-colors text-current cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {residentLoadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Resident directory could not be refreshed</p>
              <p className="mt-0.5 break-words">{residentLoadError}</p>
              <p className="mt-1">Check the Supabase connection and confirm the admin has permission to read the <code>public.users</code> table.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResidentLoadAttempt(attempt => attempt + 1)}
            className="min-h-10 shrink-0 rounded-lg border border-red-300 bg-white px-3 font-semibold text-red-700 hover:bg-red-100"
          >
            Retry loading
          </button>
        </div>
      )}

      {/* Improved 4 Status Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 flex-shrink-0">
        {/* Card 1: Total Residents */}
        <div 
          onClick={() => setFilter('all')}
          className="group bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-[#2563EB] shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-[0.12em] mb-1">Total Residents</p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-slate-100 leading-none">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#EFF6FF] dark:bg-blue-950/70 flex items-center justify-center text-[#2563EB] dark:text-blue-400 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Pending Approval */}
        <div 
          onClick={() => setFilter('pending')}
          className={cn(
              "group p-3.5 sm:p-4 rounded-[14px] border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
            stats.pending > 0
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 hover:bg-amber-50"
              : "bg-white dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-800 hover:border-amber-300"
          )}
        >
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-[0.12em]">Pending Approval</p>
              {stats.pending > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-slate-100 leading-none">{stats.pending}</p>
              {stats.pending > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-[4px]">
                  Needs Review
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-amber-100/80 dark:bg-amber-950/70 flex items-center justify-center text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Active / Approved */}
        <div 
          onClick={() => setFilter('active')}
          className="group bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-emerald-500 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-[0.12em] mb-1">Active</p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-slate-100 leading-none">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Inactive / Rejected */}
        <div 
          onClick={() => setFilter('inactive')}
          className="group bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-[14px] border border-[#E2E8F0] dark:border-slate-800 border-t-[3px] border-t-slate-500 shadow-sm flex items-center justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <div>
            <p className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-[0.12em] mb-1">Inactive</p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-slate-100 leading-none">{stats.inactive}</p>
          </div>
          <div className="w-10 h-10 rounded-[10px] bg-[#F1F5F9] dark:bg-slate-800 flex items-center justify-center text-[#64748B] dark:text-slate-400 group-hover:scale-105 transition-transform">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Directory Area */}
      <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-[16px] shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Resident Directory</h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">{filteredResidents.length} residents in this view</p>
            </div>
            
            {/* Status Filters */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 rounded-[8px] p-0.5 shadow-sm overflow-x-auto max-w-full">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px]",
                  filter === 'all' ? "bg-[#EFF6FF] dark:bg-blue-950/70 text-[#2563EB] dark:text-blue-400" : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                )}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px] inline-flex items-center gap-1",
                  filter === 'pending' ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300" : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                )}
              >
                <span>Pending ({stats.pending})</span>
                {stats.pending > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
              <button
                onClick={() => setFilter('active')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px]",
                  filter === 'active' ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300" : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                )}
              >
                Active ({stats.active})
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px]",
                  filter === 'inactive' ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200" : "text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                )}
              >
                Inactive ({stats.inactive})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search residents by name, email, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 rounded-[9px] py-2 pl-8 pr-3 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* 1. MOBILE-FIRST CARDS VIEW (Displayed on screens < md to prevent wide table horizontal scrolling) */}
        <div className="block md:hidden divide-y divide-[#F1F5F9] dark:divide-slate-800 p-3 sm:p-4 space-y-3 bg-[#FCFDFE] dark:bg-slate-950/20">
          {paginatedResidents.map((resident) => {
            const status = getStatus(resident);
            const isPending = status === 'pending';
            const profileCheck = checkProfileCompletion(resident, resident.email);

            return (
              <div 
                key={resident.uid || resident.id}
                className={cn(
                  "bg-white dark:bg-slate-900 rounded-[14px] border p-4 shadow-sm space-y-3 transition-all",
                  isPending ? "border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20" : "border-[#E2E8F0] dark:border-slate-800"
                )}
              >
                {/* Header: Avatar, Name, Email, Status */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={resident.photoURL || `https://ui-avatars.com/api/?name=${resident.displayName}&background=F1F5F9&color=64748B`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0] flex-shrink-0"
                    />
                    <div className="min-w-0 flex flex-col">
                      <span className="font-bold text-[#0F172A] dark:text-slate-100 text-sm truncate">{resident.displayName || 'Unnamed'}</span>
                      <span className="text-xs text-[#64748B] dark:text-slate-400 truncate">{resident.email}</span>
                    </div>
                  </div>
                  <AccountStatusBadge status={status} size="sm" />
                </div>

                {/* Key Resident Details Visible Without Extra Screens */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] dark:bg-slate-800/70 p-3 rounded-[10px] border border-[#E2E8F0]/60 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[#475569] dark:text-slate-300 truncate">
                    <Phone className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 flex-shrink-0" />
                    <span className="truncate">{resident.contactNumber || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#475569] dark:text-slate-300 truncate">
                    <Users className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 flex-shrink-0" />
                    <span className="truncate">{resident.age ? `${resident.age} yrs` : 'N/A'} • {resident.gender || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 flex items-start gap-1.5 text-[#475569] dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{resident.address || 'Address not provided'}</span>
                  </div>
                </div>

                {/* Profile Completion Indicator */}
                {!profileCheck.isComplete && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-[6px] border border-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Profile missing: {profileCheck.missingFields.slice(0, 2).join(', ')}{profileCheck.missingFields.length > 2 ? '...' : ''}</span>
                  </div>
                )}

                {/* Mobile Touch-Friendly Action Buttons (Height 44px for thumb tap) */}
                <div className="flex items-center gap-2 pt-1">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => handleApprove(resident)}
                        disabled={isProcessing}
                        className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-[8px] flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleReject(resident)}
                        disabled={isProcessing}
                        className="flex-1 h-11 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-[8px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => setSelectedResident(resident)}
                        className="h-11 px-3 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] rounded-[8px] flex items-center justify-center cursor-pointer"
                        title="View Resident Profile"
                      >
                        <Eye className="w-4 h-4 text-[#64748B]" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedResident(resident)}
                        className="flex-1 h-11 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-semibold text-xs rounded-[8px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                      <ActionMenu 
                        resident={resident}
                        status={status}
                        onView={(r) => setSelectedResident(r)}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onEdit={handleEdit}
                        onDeactivate={handleDeactivate}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filteredResidents.length === 0 && (
            <div className="py-14 text-center bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[12px] border border-dashed border-[#E2E8F0] dark:border-slate-700">
              <Users className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">No residents found</p>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">Try adjusting your search or filter.</p>
            </div>
          )}
        </div>

        {/* 2. DESKTOP DATA TABLE (Visible on screens >= md) */}
        <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto min-h-[300px]">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-slate-800/70 text-[#64748B] dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-slate-700">
                <th className="px-4 py-3">Resident</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Age / Gender</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {paginatedResidents.map((resident) => {
                const status = getStatus(resident);
                const isPending = status === 'pending';

                return (
                  <tr 
                    key={resident.uid || resident.id} 
                    className={cn(
                      "hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors text-xs group",
                      isPending && "bg-amber-50/20 dark:bg-amber-950/20"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={resident.photoURL || `https://ui-avatars.com/api/?name=${resident.displayName}&background=F1F5F9&color=64748B`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0] flex-shrink-0"
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className="font-semibold text-[#0F172A] dark:text-slate-100 truncate">{resident.displayName || 'Unnamed'}</span>
                          <span className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">{resident.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge status={status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[#0F172A] dark:text-slate-100 font-medium">{resident.age ? `${resident.age} yrs` : '-'}</span>
                        <span className="text-[10px] text-[#64748B] dark:text-slate-400">{resident.gender || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#0F172A] dark:text-slate-200">{resident.contactNumber || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="truncate max-w-[160px] inline-block text-[#64748B] dark:text-slate-400" title={resident.address}>
                        {resident.address || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#64748B] dark:text-slate-400">
                        {resident.createdAt ? formatDate(resident.createdAt) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isPending ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleApprove(resident)}
                            disabled={isProcessing}
                            title="Approve Resident"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(resident)}
                            disabled={isProcessing}
                            title="Reject Registration"
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-[6px] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedResident(resident)}
                            title="View Details"
                            className="p-1 hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] rounded-[4px] transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedResident(resident)}
                            title="View Resident Profile"
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded-[6px] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                          <ActionMenu 
                            resident={resident}
                            status={status}
                            onView={(r) => setSelectedResident(r)}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onEdit={handleEdit}
                            onDeactivate={handleDeactivate}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-[#94A3B8] mb-2" />
                      <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">No residents found</p>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">Try adjusting your search or filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredResidents.length > 0 && (
          <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0">
            <span className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">
              Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredResidents.length)} of {filteredResidents.length} residents
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 flex items-center gap-1 rounded-[8px] border border-[#E2E8F0] dark:border-slate-700 text-[11px] font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-900 shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              
              <div className="hidden sm:flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-6 h-6 rounded-[4px] text-[11px] font-semibold transition-all",
                      currentPage === i + 1
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-[#64748B] dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#E2E8F0]"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 flex items-center gap-1 rounded-[8px] border border-[#E2E8F0] dark:border-slate-700 text-[11px] font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-900 shadow-2xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Confirmation Modal */}
      <AnimatePresence>
        {residentToReject && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[16px] shadow-2xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 flex flex-col"
            >
              <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Reject Resident Registration</h3>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Confirm registration rejection</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isProcessing && setResidentToReject(null)}
                  disabled={isProcessing}
                  className="p-1 hover:bg-[#E2E8F0] rounded-[6px] transition-colors text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-[#0F172A] dark:text-slate-200 leading-relaxed">
                  Are you sure you want to reject the registration for <strong className="font-bold">{residentToReject.displayName || residentToReject.email}</strong>?
                </p>
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-[8px] text-[11px] text-red-800 leading-normal">
                  The resident's status will be set to <strong className="font-bold">Rejected</strong>. They will still be able to log in to view their dashboard, but will be prevented from submitting any service requests.
                </div>
              </div>

              <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResidentToReject(null)}
                  disabled={isProcessing}
                  className="h-10 px-4 bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 text-xs font-semibold rounded-[8px] hover:bg-[#F1F5F9] dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRejectResident}
                  disabled={isProcessing}
                  className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Registration</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deactivate & Delete Confirmation Modal */}
      <AnimatePresence>
        {residentToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.16 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[16px] shadow-2xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 flex flex-col"
            >
              <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Deactivate Resident</h3>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">Confirm removal</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isDeleting && setResidentToDelete(null)}
                  disabled={isDeleting}
                  className="p-1 hover:bg-[#E2E8F0] rounded-[6px] transition-colors text-[#64748B] hover:text-[#0F172A] disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-xs text-[#0F172A] dark:text-slate-200 leading-relaxed font-semibold">
                  Are you sure you want to deactivate and remove this resident?
                </div>

                <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800/70 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700 flex items-center gap-3">
                  <img 
                    src={residentToDelete.photoURL || `https://ui-avatars.com/api/?name=${residentToDelete.displayName || 'Resident'}&background=F1F5F9&color=64748B`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate">{residentToDelete.displayName || 'Unnamed Resident'}</p>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">{residentToDelete.email}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 text-[11px] text-[#64748B] leading-normal">
                  <span className="font-semibold text-[#0F172A]">Barangay Records Notice:</span> Historical service requests and completed transaction records are safely preserved.
                </div>
              </div>

              <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResidentToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 text-xs font-semibold rounded-[8px] hover:bg-[#F1F5F9] dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteResident}
                  disabled={isDeleting}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Deactivate Resident</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resident Details Modal */}
      <AnimatePresence>
        {selectedResident && (
          <ResidentDetailsModal 
            resident={selectedResident} 
            status={getStatus(selectedResident)}
            onApprove={handleApprove}
            onReject={handleReject}
            onClose={() => setSelectedResident(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Action Menu Component
function ActionMenu({ 
  resident, 
  status,
  onView, 
  onApprove,
  onReject,
  onEdit, 
  onDeactivate 
}: { 
  resident: any, 
  status: string,
  onView: (r: any) => void, 
  onApprove: (r: any) => void,
  onReject: (r: any) => void,
  onEdit: (r: any) => void, 
  onDeactivate: (r: any) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdminAccount = resident.role === 'admin' || resident.email === 'paracalejerson05@gmail.com';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="p-1.5 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] rounded-[4px] transition-colors cursor-pointer"
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 shadow-xl rounded-[10px] z-[50] py-1 overflow-hidden">
          <button 
            onClick={() => { setIsOpen(false); onView(resident); }} 
            className="w-full text-left px-3 py-2.5 text-xs font-medium text-[#0F172A] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#64748B]" /> View Profile
          </button>

          {status === 'pending' && (
            <>
              <button 
                onClick={() => { setIsOpen(false); onApprove(resident); }} 
                className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Approve Account
              </button>
              <button 
                onClick={() => { setIsOpen(false); onReject(resident); }} 
                className="w-full text-left px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-red-600" /> Reject Account
              </button>
            </>
          )}

          {status === 'inactive' && (
            <button 
              onClick={() => { setIsOpen(false); onApprove(resident); }} 
              className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Reactivate / Approve
            </button>
          )}

          <button 
            onClick={() => { setIsOpen(false); onEdit(resident); }} 
            className="w-full text-left px-3 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-[#64748B]" /> Edit Details
          </button>

          {!isAdminAccount ? (
            <button 
              onClick={() => { setIsOpen(false); onDeactivate(resident); }} 
              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-[#F1F5F9]"
            >
              <Trash2 className="w-3.5 h-3.5" /> Deactivate
            </button>
          ) : (
            <div 
              className="w-full text-left px-3 py-1.5 text-[10px] font-medium text-[#94A3B8] flex items-center gap-2 bg-[#F8FAFC] cursor-not-allowed select-none"
              title="Admin accounts cannot be deleted"
            >
              <Trash2 className="w-3.5 h-3.5 opacity-40" /> Admin Protected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Resident Details Modal
function ResidentDetailsModal({ 
  resident, 
  status, 
  onApprove,
  onReject,
  onClose 
}: { 
  resident: any, 
  status: string, 
  onApprove: (r: any) => void,
  onReject: (r: any) => void,
  onClose: () => void 
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationImages, setVerificationImages] = useState<Record<string, string>>({});
  const [verificationImagesLoading, setVerificationImagesLoading] = useState(false);
  const [verificationImagesError, setVerificationImagesError] = useState('');

  const profileCheck = checkProfileCompletion(resident, resident?.email);

  useEffect(() => {
    const fetchRequests = async () => {
      const residentId = resident?.uid || resident?.id;
      if (!residentId) {
        setLoading(false);
        return;
      }
      try {
        setRequests(await dbGetServiceRequests(residentId, false));
      } catch (err) {
        console.error("Error fetching resident requests:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [resident?.uid, resident?.id]);

  useEffect(() => {
    let active = true;
    const documents = [
      ['Front of ID', resident?.id_front_path],
      ['Back of ID', resident?.id_back_path],
      ['Face photo', resident?.face_photo_path]
    ].filter((item): item is [string, string] => Boolean(item[1]));
    if (documents.length === 0) {
      setVerificationImages({});
      setVerificationImagesLoading(false);
      setVerificationImagesError('');
      return () => { active = false; };
    }

    const loadPrivateImages = async () => {
      setVerificationImagesLoading(true);
      setVerificationImagesError('');
      try {
        const results = await Promise.all(documents.map(async ([label, path]) => {
          const { data, error } = await supabase.storage
            .from('resident-verification')
            .createSignedUrl(path, 300);
          if (error || !data?.signedUrl) {
            throw new Error(`${label} could not be opened. Confirm the private storage migration and administrator access are configured.`);
          }
          return [label, data.signedUrl] as const;
        }));
        if (active) setVerificationImages(Object.fromEntries(results));
      } catch (error) {
        console.error('Unable to load private resident verification images:', error);
        if (active) setVerificationImagesError(error instanceof Error ? error.message : 'Unable to load private verification images.');
      } finally {
        if (active) setVerificationImagesLoading(false);
      }
    };

    void loadPrivateImages();
    return () => { active = false; };
  }, [resident?.id_front_path, resident?.id_back_path, resident?.face_photo_path]);

  const isPending = status === 'pending';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[16px] shadow-2xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-800/60 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100">Resident Profile Review</h3>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">Review identity, personal information, and service history</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#E2E8F0] rounded-[6px] transition-colors text-[#64748B] hover:text-[#0F172A] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#F8FAFC] dark:bg-slate-800/70 rounded-[12px] border border-[#E2E8F0] dark:border-slate-700">
            <div className="flex items-center gap-3.5">
              <img 
                src={resident.photoURL || `https://ui-avatars.com/api/?name=${resident.displayName}&background=EFF6FF&color=2563EB`}
                alt=""
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0F172A] dark:text-slate-100 truncate">{resident.displayName || 'Unnamed Resident'}</h2>
                <p className="text-xs text-[#64748B] dark:text-slate-400">{resident.email}</p>
                <p className="text-[10px] text-[#94A3B8] dark:text-slate-500 font-mono mt-0.5">UID: {resident.uid || resident.id}</p>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5 flex-shrink-0">
              <AccountStatusBadge status={status} size="md" />
              <span className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border",
                profileCheck.isComplete 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {profileCheck.isComplete ? 'Profile Complete' : `${profileCheck.missingFields.length} Details Missing`}
              </span>
            </div>
          </div>

          {/* Pending Approval Notice if pending */}
          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Awaiting Administrator Approval:</strong> This newly registered resident cannot submit any service requests until approved.
              </div>
            </div>
          )}

          {/* Missing Fields Warning if incomplete */}
          {!profileCheck.isComplete && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-[8px] p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                Missing Required Profile Information:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profileCheck.missingFields.map((f) => (
                  <span key={f} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white text-amber-800 border border-amber-200">
                    • {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div>
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-[10px] border border-[#E2E8F0] dark:border-slate-700">
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Full Name</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.displayName || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Email Address</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Contact Number</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.contactNumber || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Age & Gender</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.age ? `${resident.age} years old` : 'N/A'} • {resident.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Civil Status</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.civilStatus || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Registration Date</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                  {resident.createdAt ? formatDate(resident.createdAt) : 'Unknown'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] text-[#64748B] mb-0.5">Complete Address</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100 leading-relaxed">{resident.address || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Date of Birth</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">{resident.date_of_birth ? formatDate(resident.date_of_birth) : 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Barangay Address</p>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                  {[resident.house_street, resident.purok_sitio, resident.barangay, resident.municipality_city, resident.province].filter(Boolean).join(', ') || 'Not provided'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Identity Verification · Manual Review</h3>
            <div className="space-y-3 rounded-[10px] border border-[#E2E8F0] bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <p><span className="font-semibold text-slate-600">ID Type:</span> {resident.id_type === 'Other Accepted ID' ? resident.id_type_other : resident.id_type || 'Not provided'}</p>
                <p><span className="font-semibold text-slate-600">Verification:</span> {resident.verification_status || 'Pending manual verification'}</p>
                <p className="sm:col-span-2"><span className="font-semibold text-slate-600">Face process:</span> {resident.face_registration_method === 'in_person' ? 'Resident requested in-person verification' : resident.face_registration_method || 'Not provided'}</p>
                {resident.privacy_consent_at && <p className="sm:col-span-2 text-emerald-700">Privacy notice acknowledged {formatDate(resident.privacy_consent_at)}.</p>}
              </div>
              {verificationImagesLoading && <p className="text-xs text-slate-600">Loading private verification images…</p>}
              {verificationImagesError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{verificationImagesError}</p>}
              {!resident.id_front_path && !resident.id_back_path && !resident.face_photo_path ? (
                <p className="text-xs text-slate-500">No identity images were submitted.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(['Front of ID', 'Back of ID', 'Face photo'] as const).map(label => (
                    verificationImages[label] ? (
                      <a key={label} href={verificationImages[label]} target="_blank" rel="noreferrer" className="block min-w-0 rounded-lg border border-slate-200 bg-white p-2">
                        <img src={verificationImages[label]} alt={label} className="h-36 w-full rounded object-contain" />
                        <span className="mt-1 block text-center text-xs font-semibold text-blue-700">{label} · Open secure preview</span>
                      </a>
                    ) : null
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Service Requests */}
          <div>
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2.5">Service Request History</h3>
            <div className="bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 rounded-[10px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-slate-800/70 border-b border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400">
                    <th className="px-3 py-2 font-semibold">Service</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-[#64748B]">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : requests.length > 0 ? (
                    requests.map(req => (
                      <tr key={req.id}>
                        <td className="px-3 py-2 font-medium text-[#0F172A] dark:text-slate-100">{req.serviceType}</td>
                        <td className="px-3 py-2 text-[#64748B] dark:text-slate-400">
                          {formatDate(req.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider inline-block",
                            req.status === 'completed' ? "text-emerald-700 bg-emerald-50" : 
                            req.status === 'approved' ? "text-[#2563EB] bg-[#EFF6FF]" : 
                            req.status === 'disapproved' ? "text-red-700 bg-red-50" :
                            "text-amber-700 bg-amber-50"
                          )}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-[#64748B] italic">
                        No service requests submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-[11px] text-[#64748B] hidden sm:block">
            {isPending ? 'Action required: approve or reject registration.' : 'Account active and approved.'}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={() => onReject(resident)}
                  className="h-10 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
                <button 
                  type="button"
                  onClick={() => onApprove(resident)}
                  className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[8px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer flex-1 sm:flex-initial"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve Resident</span>
                </button>
              </>
            ) : (
              <button 
                onClick={onClose}
                className="h-10 px-5 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[8px] hover:bg-[#F1F5F9] transition-colors cursor-pointer w-full sm:w-auto"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
