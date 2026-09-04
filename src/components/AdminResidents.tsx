import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, UserPlus, Filter, MoreVertical, Eye, Edit, Trash2, 
  X, Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { doc, updateDoc, serverTimestamp, query, collection, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AdminResidentsProps {
  residents: any[];
  onAction?: () => void;
}

export function AdminResidents({ residents, onAction }: AdminResidentsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResident, setSelectedResident] = useState<any>(null);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  const getStatus = (resident: any) => {
    if (resident.status === 'pending') return 'pending';
    if (resident.status === 'disapproved') return 'inactive';
    if (!resident.lastLoginAt) return 'inactive';
    
    let lastLogin;
    try {
      lastLogin = resident.lastLoginAt?.toDate ? resident.lastLoginAt.toDate() : new Date(resident.lastLoginAt);
    } catch(e) {
      return 'inactive';
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return lastLogin > thirtyDaysAgo ? 'active' : 'inactive';
  };

  const filteredResidents = residents.filter(resident => {
    const matchesSearch = 
      resident.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resident.contactNumber?.includes(searchTerm) ||
      resident.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = getStatus(resident);
    const matchesFilter = filter === 'all' || status === filter;
    
    return matchesSearch && matchesFilter;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredResidents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResidents = filteredResidents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Stats
  const stats = {
    total: residents.length,
    active: residents.filter(r => getStatus(r) === 'active').length,
    pending: residents.filter(r => getStatus(r) === 'pending').length,
    inactive: residents.filter(r => getStatus(r) === 'inactive').length,
  };

  const handleDeactivate = async (resident: any) => {
    if (!window.confirm(`Are you sure you want to deactivate ${resident.displayName}?`)) return;
    try {
      await updateDoc(doc(db, 'users', resident.uid), {
        status: 'disapproved',
        updatedAt: serverTimestamp()
      });
      if (onAction) onAction();
    } catch (error) {
      console.error('Error deactivating resident:', error);
      alert('Failed to deactivate resident.');
    }
  };

  const handleEdit = (resident: any) => {
    alert('Edit resident functionality would open here.');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Subtitle */}
      <div className="-mt-4 mb-1">
        <p className="text-[13px] text-[#64748B]">Manage and monitor registered residents in the barangay.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Total Residents</p>
            <p className="text-xl font-bold text-[#0F172A] leading-none">{stats.total}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Active</p>
            <p className="text-xl font-bold text-[#0F172A] leading-none">{stats.active}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Pending</p>
            <p className="text-xl font-bold text-[#0F172A] leading-none">{stats.pending}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-3 rounded-[8px] border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">Inactive</p>
            <p className="text-xl font-bold text-[#0F172A] leading-none">{stats.inactive}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Directory Area */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0F172A] mr-2">Residents</h2>
            
            {/* Status Filters */}
            <div className="flex items-center bg-white border border-[#E2E8F0] rounded-[6px] p-0.5 shadow-sm overflow-hidden">
              {(['all', 'pending', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-[4px]",
                    filter === f 
                      ? "bg-[#EFF6FF] text-[#2563EB]" 
                      : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search residents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-[6px] py-1.5 pl-8 pr-3 text-xs focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none transition-all shadow-sm"
              />
            </div>
            <button className="p-1.5 bg-white border border-[#E2E8F0] text-[#64748B] rounded-[6px] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] transition-colors shadow-sm whitespace-nowrap">
              <UserPlus className="w-3.5 h-3.5" />
              Add Resident
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-[300px]">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
                <th className="px-4 py-3">Resident</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden sm:table-cell">Age / Gender</th>
                <th className="px-4 py-3 hidden md:table-cell">Civil Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 hidden xl:table-cell">Address</th>
                <th className="px-4 py-3 hidden sm:table-cell">Last Active</th>
                <th className="px-4 py-3 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {paginatedResidents.map((resident) => {
                const status = getStatus(resident);
                return (
                  <tr key={resident.uid} className="hover:bg-[#F8FAFC] transition-colors text-xs group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={resident.photoURL || `https://ui-avatars.com/api/?name=${resident.displayName}&background=F1F5F9&color=64748B`}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-[#E2E8F0] flex-shrink-0"
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className="font-semibold text-[#0F172A] truncate">{resident.displayName || 'Unnamed'}</span>
                          <span className="text-[10px] text-[#64748B] truncate">{resident.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider inline-flex items-center",
                        status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : 
                        status === 'pending' ? "bg-amber-50 text-amber-700 border border-amber-100" : 
                        "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
                      )}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <div className="flex flex-col">
                        <span className="text-[#0F172A] font-medium">{resident.age ? `${resident.age} yrs` : '-'}</span>
                        <span className="text-[10px] text-[#64748B]">{resident.gender || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-[#0F172A]">
                      {resident.civilStatus || '-'}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="text-[#0F172A]">{resident.contactNumber || '-'}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden xl:table-cell">
                      <span className="truncate max-w-[180px] inline-block text-[#64748B]" title={resident.address}>
                        {resident.address || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className="text-[#0F172A]">
                        {resident.lastLoginAt ? (resident.lastLoginAt.toDate ? formatDate(resident.lastLoginAt.toDate()) : new Date(resident.lastLoginAt).toLocaleDateString()) : 'Never'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ActionMenu 
                        resident={resident}
                        onView={(r) => setSelectedResident(r)}
                        onEdit={handleEdit}
                        onDeactivate={handleDeactivate}
                      />
                    </td>
                  </tr>
                );
              })}
              
              {filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-[#94A3B8] mb-2" />
                      <p className="text-sm font-semibold text-[#0F172A]">No residents found</p>
                      <p className="text-xs text-[#64748B] mt-1">Try adjusting your search or filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredResidents.length > 0 && (
          <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-[#64748B] font-medium">
              Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredResidents.length)} of {filteredResidents.length} residents
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 flex items-center gap-1 rounded-[6px] border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
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
                        : "text-[#64748B] hover:bg-white border border-transparent hover:border-[#E2E8F0]"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 flex items-center gap-1 rounded-[6px] border border-[#E2E8F0] text-[11px] font-semibold text-[#0F172A] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resident Details Modal */}
      <AnimatePresence>
        {selectedResident && (
          <ResidentDetailsModal 
            resident={selectedResident} 
            status={getStatus(selectedResident)}
            onClose={() => setSelectedResident(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Action Menu Component
function ActionMenu({ resident, onView, onEdit, onDeactivate }: { resident: any, onView: (r: any) => void, onEdit: (r: any) => void, onDeactivate: (r: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        className="p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] rounded-[4px] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-[#E2E8F0] shadow-md rounded-[6px] z-[50] py-1 overflow-hidden">
          <button onClick={() => { setIsOpen(false); onView(resident); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#64748B]" /> View
          </button>
          <button onClick={() => { setIsOpen(false); onEdit(resident); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
            <Edit className="w-3.5 h-3.5 text-[#64748B]" /> Edit
          </button>
          <button onClick={() => { setIsOpen(false); onDeactivate(resident); }} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" /> Deactivate
          </button>
        </div>
      )}
    </div>
  );
}

// Resident Details Modal
function ResidentDetailsModal({ resident, status, onClose }: { resident: any, status: string, onClose: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const q = query(
          collection(db, 'serviceRequests'), 
          where('residentUid', '==', resident.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching resident requests:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [resident.uid]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        className="bg-white w-full max-w-2xl rounded-[10px] shadow-xl overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Resident Profile</h3>
            <p className="text-[11px] text-[#64748B]">View full resident information and history</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#E2E8F0] rounded-[6px] transition-colors text-[#64748B] hover:text-[#0F172A]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img 
              src={resident.photoURL || `https://ui-avatars.com/api/?name=${resident.displayName}&background=F1F5F9&color=64748B`}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-[#E2E8F0] shadow-sm flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#0F172A] truncate">{resident.displayName || 'Unnamed Resident'}</h2>
              <p className="text-xs text-[#64748B]">{resident.email}</p>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider",
              status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : 
              status === 'pending' ? "bg-amber-50 text-amber-700 border border-amber-200" : 
              "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
            )}>
              {status} Account
            </span>
          </div>

          {/* Details Grid */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-[#F8FAFC] p-4 rounded-[8px] border border-[#E2E8F0]">
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Phone Number</p>
                <p className="text-xs font-semibold text-[#0F172A]">{resident.contactNumber || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Age & Gender</p>
                <p className="text-xs font-semibold text-[#0F172A]">{resident.age ? `${resident.age} yrs` : 'N/A'} • {resident.gender || 'N/A'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] text-[#64748B] mb-0.5">Home Address</p>
                <p className="text-xs font-semibold text-[#0F172A] leading-relaxed">{resident.address || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Civil Status</p>
                <p className="text-xs font-semibold text-[#0F172A]">{resident.civilStatus || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] mb-0.5">Registration Date</p>
                <p className="text-xs font-semibold text-[#0F172A]">
                  {resident.createdAt ? (resident.createdAt.toDate ? formatDate(resident.createdAt.toDate()) : new Date(resident.createdAt).toLocaleDateString()) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Service Requests */}
          <div>
            <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Service Request History</h3>
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
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
                        <td className="px-3 py-2 font-medium text-[#0F172A]">{req.serviceType}</td>
                        <td className="px-3 py-2 text-[#64748B]">
                          {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'}
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
                        No service requests found for this resident.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-[6px] hover:bg-[#F1F5F9] transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
