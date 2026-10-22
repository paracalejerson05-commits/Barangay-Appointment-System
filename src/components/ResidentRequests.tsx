import React, { useState, useEffect } from 'react';
import { dbDeleteServiceRequest, dbGetServiceRequests } from '../lib/supabaseDb';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Calendar, 
  Loader2,
  ChevronRight,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { getRequestReference, getStatusLabel } from '../lib/requestPresentation';

interface ResidentRequestsProps {
  user: any;
  profile: any;
}

export function ResidentRequests({ user, profile }: ResidentRequestsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.uid || user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    let active = true;
    const loadRequests = async () => {
      try {
        const reqs = await dbGetServiceRequests(userId, false);
        if (active) setRequests(reqs);
      } catch (err) {
        console.error('Error loading resident requests:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRequests();
    const channel = supabase
      .channel(`resident-requests-${userId}`)
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

  const handleDeleteRequest = async (request: any) => {
    if (!window.confirm(`Delete your pending ${request.serviceType} request? This cannot be undone.`)) return;

    setDeletingId(request.id);
    try {
      await dbDeleteServiceRequest(request.id);
      setRequests(current => current.filter(item => item.id !== request.id));
      setExpandedId(current => current === request.id ? null : current);
    } catch (error: any) {
      window.alert(error?.message || 'The request could not be deleted. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
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
    <div className="w-full max-w-5xl mx-auto space-y-3 sm:space-y-4">
      <div className="mb-2">
        <h2 className="text-[23px] sm:text-3xl font-bold text-[#0F172A] tracking-tight">
          My Requests
        </h2>
        <p className="text-sm text-slate-500">
          Track the status and history of your barangay service requests.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-sm">
          <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No requests found</h3>
          <p className="text-sm text-slate-500 mt-1">You haven't submitted any service requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-[14px] border border-slate-200/80 p-3.5 sm:p-5 shadow-sm hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h3 className="text-[14px] sm:text-base font-bold text-slate-900">{req.serviceType}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getRequestReference(req.id, req.createdAt)} · Requested on {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-auto">
                  {getStatusBadge(req.status)}
                  {req.status?.toLowerCase() === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRequest(req)}
                      disabled={deletingId === req.id}
                      title="Delete pending request"
                      aria-label={`Delete ${req.serviceType} request`}
                      className="min-h-10 min-w-10 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === req.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="min-h-10 min-w-10 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className={cn("w-5 h-5 transition-transform", expandedId === req.id && "rotate-90")} />
                  </button>
                </div>
              </div>

              {req.status?.toLowerCase() === 'completed' && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                  <p className="text-sm font-semibold">Request completed</p>
                  {req.completedAt && (
                    <p className="text-xs mt-1">
                      Completed: {new Date(req.completedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                      {req.completedBy ? ` by ${req.completedBy}` : ''}
                    </p>
                  )}
                  <p className="text-xs mt-1.5">Your request has been completed. Please visit the Barangay Hall to claim the document if a physical copy is required.</p>
                </div>
              )}

              {expandedId === req.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-slate-100 text-sm space-y-2 text-slate-600"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="font-semibold text-slate-700">Appointment:</span>{' '}
                      {req.appointmentDate ? `${req.appointmentDate} at ${req.appointmentTime || 'N/A'}` : 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Current stage:</span>{' '}
                      {getStatusLabel(req.status)}
                    </div>
                    {req.queueNumber && (
                      <div>
                        <span className="font-semibold text-slate-700">Queue Number:</span> #{req.queueNumber}
                      </div>
                    )}
                  </div>
                  {req.description && (
                    <div>
                      <span className="font-semibold text-slate-700">Purpose / Details:</span> {req.description}
                    </div>
                  )}
                  {req.adminNotes && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs mt-2">
                      <span className="font-bold">Admin Notes:</span> {req.adminNotes}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
