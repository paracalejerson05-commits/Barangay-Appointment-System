import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  FileText, 
  Calendar, 
  Loader2,
  ChevronRight,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

interface ResidentRequestsProps {
  user: User;
  profile: any;
}

export function ResidentRequests({ user, profile }: ResidentRequestsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'disapproved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Disapproved
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-7 h-7 text-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Page Title - Clean & Compact without large logo */}
      <div className="mb-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
          My Service Requests
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
          Track the status and appointment schedule of your submitted barangay service requests.
        </p>
      </div>

      {/* Requests List */}
      <div className="space-y-2.5">
        {requests.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-[10px] flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">No requests yet</h3>
            <p className="text-xs text-[#64748B]">You haven't made any service requests yet.</p>
          </div>
        ) : (
          requests.map((request, i) => {
            const isExpanded = expandedId === request.id;
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
                className={cn(
                  "bg-white rounded-[12px] border transition-all duration-150 overflow-hidden group shadow-2xs",
                  isExpanded ? "border-[#2563EB] ring-1 ring-[#2563EB]/20" : "border-[#E2E8F0] hover:border-blue-300 hover:shadow-sm"
                )}
              >
                {/* Main Compact Row */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  {/* Left: Icon & Core Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[10px] bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors truncate">
                          {request.serviceType}
                        </h4>
                        <span className="sm:hidden">{getStatusBadge(request.status)}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Submitted {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Appointment Date, Status Badge & Arrow */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0">
                    {request.appointmentDate && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-[6px] border border-[#E2E8F0]">
                        <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>{formatDate(request.appointmentDate)} • {request.appointmentTime || 'Pending Slot'}</span>
                      </div>
                    )}

                    <div className="hidden sm:block">
                      {getStatusBadge(request.status)}
                    </div>

                    <ChevronRight className={cn(
                      "w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-transform duration-200 flex-shrink-0",
                      isExpanded ? "rotate-90 text-[#2563EB]" : ""
                    )} />
                  </div>
                </div>

                {/* Sub-line info if approved */}
                {request.status === 'approved' && !isExpanded && (
                  <div className="px-4 pb-2.5 -mt-1 text-[11px] font-semibold text-[#2563EB] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Claim instructions sent to your registered email</span>
                  </div>
                )}

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#F1F5F9] bg-[#F8FAFC]/50 text-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <span className="text-[#64748B] font-medium block text-[11px]">Resident Name:</span>
                        <span className="font-semibold text-[#0F172A]">{request.residentName}</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] font-medium block text-[11px]">Purpose / Reason:</span>
                        <span className="font-semibold text-[#0F172A]">{request.description || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] font-medium block text-[11px]">Schedule:</span>
                        <span className="font-semibold text-[#0F172A]">
                          {request.appointmentDate ? `${formatDate(request.appointmentDate)} at ${request.appointmentTime}` : 'Not set'}
                        </span>
                      </div>
                    </div>

                    {request.status === 'approved' && (
                      <div className="p-2.5 bg-blue-50 rounded-[8px] border border-blue-100 flex items-center gap-2 text-[#2563EB]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="font-medium text-[11px]">
                          Claim instructions sent to your email. Please bring a valid government ID during your scheduled claim time.
                        </span>
                      </div>
                    )}

                    {request.adminNotes && (
                      <div className="p-3 bg-white rounded-[8px] border border-[#E2E8F0]">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A] mb-1">
                          <Info className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>Barangay Official Feedback / Notes</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] leading-relaxed">
                          {request.adminNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
