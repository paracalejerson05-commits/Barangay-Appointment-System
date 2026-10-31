import React, { useEffect, useMemo, useState } from 'react';
import { dbDeleteServiceRequest, dbGetServiceRequests } from '../lib/supabaseDb';
import { supabase } from '../lib/supabase';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Search,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { formatDate } from '../lib/utils';
import { getRequestReference } from '../lib/requestPresentation';

interface ResidentRequestsProps {
  user: any;
  profile: any;
}

const PAGE_SIZE = 8;

function getStatusText(status: unknown) {
  const value = String(status ?? '').trim();
  if (!value) return 'Unknown';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function StatusBadge({ status }: { status: unknown }) {
  const normalized = String(status ?? '').trim().toLowerCase();
  const style = normalized === 'pending'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : normalized === 'approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'completed'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : normalized === 'disapproved'
          ? 'border-red-200 bg-red-50 text-red-700'
          : normalized === 'cancelled' || normalized === 'canceled'
            ? 'border-slate-200 bg-slate-100 text-slate-600'
            : 'border-slate-200 bg-slate-50 text-slate-600';
  const Icon = normalized === 'pending'
    ? Clock3
    : normalized === 'disapproved'
      ? XCircle
      : normalized === 'approved' || normalized === 'completed'
        ? CheckCircle2
        : null;

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${style}`}>
      {Icon && <Icon aria-hidden="true" className="h-3 w-3" />}
      {getStatusText(status)}
    </span>
  );
}

function getAppointmentLabel(request: any) {
  if (!request.appointmentDate) return 'Not scheduled';
  const date = new Date(`${request.appointmentDate}T00:00:00`);
  const formattedDate = Number.isNaN(date.getTime())
    ? String(request.appointmentDate)
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  return request.appointmentTime
    ? `${formattedDate} · ${request.appointmentTime}`
    : formattedDate;
}

export function ResidentRequests({ user }: ResidentRequestsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

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
    void loadRequests();
    const channel = supabase
      .channel(`resident-requests-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_requests',
        filter: `resident_id=eq.${userId}`
      }, () => { void loadRequests(); })
      .subscribe();
    const interval = setInterval(() => { void loadRequests(); }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.uid, user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortOrder]);

  useEffect(() => {
    if (!selectedRequest) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRequest(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedRequest]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    requests.forEach(request => {
      if (request.status) statuses.add(String(request.status));
    });
    return Array.from(statuses).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const summary = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(request => String(request.status ?? '').toLowerCase() === 'pending').length,
    approved: requests.filter(request => String(request.status ?? '').toLowerCase() === 'approved').length,
    completed: requests.filter(request => String(request.status ?? '').toLowerCase() === 'completed').length
  }), [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return requests
      .filter(request => {
        const reference = request.referenceNumber || getRequestReference(request.id, request.createdAt);
        const matchesSearch = !normalizedSearch
          || String(request.serviceType ?? '').toLowerCase().includes(normalizedSearch)
          || String(reference).toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all'
          || String(request.status ?? '').toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt ?? 0).getTime() || 0;
        const bTime = new Date(b.createdAt ?? 0).getTime() || 0;
        return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
      });
  }, [requests, search, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const visibleRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstRecord = filteredRequests.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRecord = Math.min(currentPage * PAGE_SIZE, filteredRequests.length);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  const handleDeleteRequest = async (request: any) => {
    if (!window.confirm(`Delete your pending ${request.serviceType} request? This cannot be undone.`)) return;

    setDeletingId(request.id);
    try {
      await dbDeleteServiceRequest(request.id);
      setRequests(current => current.filter(item => item.id !== request.id));
      setSelectedRequest(current => current?.id === request.id ? null : current);
    } catch (error: any) {
      window.alert(error?.message || 'The request could not be deleted. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 aria-label="Loading requests" className="h-7 w-7 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header>
        <h2 className="text-[23px] font-bold tracking-tight text-[#0F172A] sm:text-3xl">My Requests</h2>
        <p className="mt-1 text-sm text-slate-500">Track the status and history of your barangay service requests.</p>
      </header>

      <section aria-label="Request summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Requests', value: summary.total, color: 'text-slate-900' },
          { label: 'Pending', value: summary.pending, color: 'text-amber-700' },
          { label: 'Approved', value: summary.approved, color: 'text-emerald-700' },
          { label: 'Completed', value: summary.completed, color: 'text-blue-700' }
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold leading-none ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <label className="relative block w-full sm:max-w-xs">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search service or reference"
              aria-label="Search by service name or reference number"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="sr-only" htmlFor="request-status-filter">Filter by status</label>
            <select
              id="request-status-filter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{getStatusText(status)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="request-sort-order">Sort requests</label>
            <select
              id="request-sort-order"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value as 'newest' | 'oldest')}
              className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button
              type="button"
              onClick={clearFilters}
              className="col-span-2 min-h-10 rounded-lg px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50 sm:col-span-1"
            >
              Clear filters
            </button>
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-800">
              {requests.length ? 'No matching requests' : 'No requests found'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {requests.length ? 'Try adjusting your search or filters.' : "You haven't submitted any service requests yet."}
            </p>
            {requests.length > 0 && (
              <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="w-[18%] px-4 py-3">Service Name</th>
                    <th scope="col" className="w-[17%] px-4 py-3">Reference Number</th>
                    <th scope="col" className="w-[17%] px-4 py-3">Date Requested</th>
                    <th scope="col" className="w-[18%] px-4 py-3">Appointment Schedule</th>
                    <th scope="col" className="w-[14%] px-4 py-3">Status</th>
                    <th scope="col" className="w-[16%] px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRequests.map(request => {
                    const reference = request.referenceNumber || getRequestReference(request.id, request.createdAt);
                    return (
                      <tr key={request.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                          <span className="block truncate" title={request.serviceType}>{request.serviceType || 'Barangay Service'}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-medium text-slate-600">
                          <span className="block truncate" title={reference}>{reference}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs leading-5 text-slate-600">{formatDate(request.createdAt)}</td>
                        <td className="px-4 py-3.5 text-xs leading-5 text-slate-600">{getAppointmentLabel(request)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={request.status} /></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {String(request.status ?? '').toLowerCase() === 'pending' && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteRequest(request)}
                                disabled={deletingId === request.id}
                                title="Delete pending request"
                                aria-label={`Delete ${request.serviceType} request`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              >
                                {deletingId === request.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(request)}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {visibleRequests.map(request => {
                const reference = request.referenceNumber || getRequestReference(request.id, request.createdAt);
                return (
                  <article key={request.id} className="space-y-3 p-4 transition-colors hover:bg-slate-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">{request.serviceType || 'Barangay Service'}</h3>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{reference}</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-slate-400">Date requested</p>
                        <p className="mt-0.5 font-medium text-slate-700">{formatDate(request.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Appointment</p>
                        <p className="mt-0.5 font-medium text-slate-700">{getAppointmentLabel(request)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {String(request.status ?? '').toLowerCase() === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteRequest(request)}
                          disabled={deletingId === request.id}
                          aria-label={`Delete ${request.serviceType} request`}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingId === request.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" />
                        View Details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{firstRecord}–{lastRecord}</span> of{' '}
                <span className="font-semibold text-slate-700">{filteredRequests.length}</span> requests
              </p>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </footer>
          </>
        )}
      </section>

      {selectedRequest && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelectedRequest(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-details-title"
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Request details</p>
                <h2 id="request-details-title" className="mt-1 truncate text-lg font-bold text-slate-900">
                  {selectedRequest.serviceType || 'Barangay Service'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close request details"
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">Reference number</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-800">
                    {selectedRequest.referenceNumber || getRequestReference(selectedRequest.id, selectedRequest.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Current status</p>
                  <div className="mt-1"><StatusBadge status={selectedRequest.status} /></div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Date requested</p>
                  <p className="mt-1 text-sm text-slate-800">{formatDate(selectedRequest.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Appointment schedule</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-800">
                    <CalendarDays aria-hidden="true" className="h-4 w-4 text-slate-400" />
                    {getAppointmentLabel(selectedRequest)}
                  </p>
                </div>
                {selectedRequest.queueNumber != null && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Queue number</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">#{selectedRequest.queueNumber}</p>
                  </div>
                )}
              </div>

              {selectedRequest.description && (
                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800">Submitted details</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedRequest.description}</p>
                </div>
              )}

              {selectedRequest.adminNotes && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <h3 className="text-sm font-semibold text-blue-900">
                    {String(selectedRequest.status ?? '').toLowerCase() === 'disapproved' ? 'Rejection reason / Admin remarks' : 'Admin remarks'}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-blue-900">{selectedRequest.adminNotes}</p>
                </div>
              )}

              {selectedRequest.completedAt && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">Completion recorded</h3>
                    <p className="mt-1 text-sm text-emerald-800">
                      {formatDate(selectedRequest.completedAt)}
                      {selectedRequest.completedBy ? ` · ${selectedRequest.completedBy}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
              {String(selectedRequest.status ?? '').toLowerCase() === 'pending' && (
                <button
                  type="button"
                  onClick={() => void handleDeleteRequest(selectedRequest)}
                  disabled={deletingId === selectedRequest.id}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === selectedRequest.id
                    ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                  Delete pending request
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
