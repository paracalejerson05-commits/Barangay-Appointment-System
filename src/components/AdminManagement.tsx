import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  LoaderCircle,
  MapPin,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
  UserX,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isPrimaryAdmin } from '../lib/adminAccess';
import { apiUrl } from '../lib/api';

interface Administrator {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string;
  date_of_birth?: string | null;
  age?: number | null;
  gender?: string | null;
  civil_status?: string | null;
  contact_number?: string | null;
  address?: string | null;
  email_verified?: boolean | null;
  last_sign_in_at?: string | null;
  photo_url?: string | null;
}

interface AdminEditForm {
  displayName: string;
  email: string;
  dateOfBirth: string;
  contactNumber: string;
  gender: string;
  civilStatus: string;
  address: string;
  photoUrl: string;
}

interface AdminManagementProps {
  user: { email?: string };
}

type Feedback = { type: 'success' | 'error' | 'warning'; message: string } | null;

function DetailField({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-start gap-1.5 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
        {icon && <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>}{value}
      </dd>
    </div>
  );
}

function ReadOnlyField({ label, value, breakAll = false }: { label: string; value: React.ReactNode; breakAll?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      <div className={`flex min-h-10 items-center rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${breakAll ? 'break-all' : 'break-words'}`}>{value}</div>
    </div>
  );
}

async function loadAdminRecords() {
  const { data, error } = await supabase.rpc('list_admin_management');
  if (error) {
    if (error.code === 'PGRST202' || /list_admin_management.*schema cache|schema cache.*list_admin_management/i.test(error.message)) {
      throw new Error('Administrator management is not installed in Supabase. Run database_admin_management.sql in the Supabase SQL Editor, then refresh this page.');
    }
    throw new Error(error.message || 'Unable to load administrator accounts.');
  }
  const result = data as { admins?: Administrator[]; invitations?: Array<Omit<Administrator, 'id'> & { email: string }> };
  return [
    ...(result.admins || []),
    ...(result.invitations || []).map(invitation => ({
      ...invitation,
      id: `invitation:${invitation.email}`
    }))
  ];
}

async function createAdminInvitation(fullName: string, email: string) {
  const { error } = await supabase.rpc('create_admin_invitation', {
    p_full_name: fullName,
    p_email: email
  });
  if (error) {
    if (error.code === '23505') throw new Error('An administrator or invitation already uses this email address.');
    if (error.code === '42501') throw new Error('Only the primary administrator may invite administrators.');
    throw new Error(error.message || 'Unable to create the administrator invitation.');
  }
}

async function deactivateAdmin(id: string) {
  const { data, error } = await supabase.rpc('deactivate_managed_admin', { p_user_id: id });
  if (error) {
    if (error.code === '23514') throw new Error('The last active administrator cannot be deactivated.');
    if (error.code === '42501') throw new Error('The primary administrator cannot be deactivated.');
    throw new Error(error.message || 'Unable to deactivate this administrator.');
  }
  return data as Administrator;
}

async function saveAdminProfile(id: string, profile: AdminEditForm) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch(apiUrl(`/api/admins/${encodeURIComponent(id)}/profile`), {
    method: 'PATCH',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(profile)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Profile update failed with HTTP ${response.status}.`);
  return result as { admin: Administrator; emailChangePending: boolean };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function calculateAge(value?: string | null) {
  if (!value) return null;
  const birthDate = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (today.getUTCMonth() < birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

function statusLabel(status: string) {
  if (status === 'deactivated' || status === 'inactive') return 'Deactivated';
  if (status === 'invited') return 'Invitation pending';
  if (status === 'pending') return 'Pending';
  return 'Active';
}

export function AdminManagement({ user }: AdminManagementProps) {
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Administrator | null>(null);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [editForm, setEditForm] = useState<AdminEditForm | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loadError, setLoadError] = useState('');

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const records = await loadAdminRecords();
      setAdmins(records);
      setSelectedAdmin(current => current ? records.find(record => record.id === current.id) || current : null);
      return records;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load administrators.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const closeForm = () => {
    setShowAddForm(false);
    setFullName('');
    setEmail('');
    setFormError('');
  };

  const startEditingAdmin = (admin: Administrator) => {
    setSelectedAdmin(admin);
    setEditForm({
      displayName: admin.display_name || '',
      email: admin.email || '',
      dateOfBirth: admin.date_of_birth?.slice(0, 10) || '',
      contactNumber: admin.contact_number || '',
      gender: admin.gender || '',
      civilStatus: admin.civil_status || '',
      address: admin.address || '',
      photoUrl: admin.photo_url || ''
    });
    setIsEditingAdmin(true);
  };

  const handleAdminPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editForm) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Choose an image smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        for (const size of [512, 384, 256, 192]) {
          const scale = Math.min(1, size / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            setFormError('The selected image could not be processed.');
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          for (const quality of [0.75, 0.6, 0.45]) {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            if (dataUrl.length <= 80_000) {
              setEditForm(current => current ? { ...current, photoUrl: dataUrl } : current);
              setFormError('');
              return;
            }
          }
        }
        setFormError('This image could not be compressed to the supported size. Choose a simpler image.');
      };
      image.onerror = () => setFormError('The selected image could not be opened.');
      image.src = String(reader.result);
    };
    reader.onerror = () => setFormError('The selected image could not be read.');
    reader.readAsDataURL(file);
  };

  const handleSaveAdminProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAdmin || !editForm) return;
    const profile = {
      ...editForm,
      displayName: editForm.displayName.trim(),
      email: editForm.email.trim().toLowerCase(),
      contactNumber: editForm.contactNumber.trim(),
      gender: editForm.gender.trim(),
      civilStatus: editForm.civilStatus.trim(),
      address: editForm.address.trim()
    };
    if (!profile.displayName || profile.displayName.length > 255) {
      setFormError('Enter a full name with no more than 255 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (profile.contactNumber && !/^\d{11}$/.test(profile.contactNumber)) {
      setFormError('Contact number must contain 11 digits.');
      return;
    }
    if (profile.dateOfBirth && calculateAge(profile.dateOfBirth) === null) {
      setFormError('Enter a valid date of birth that is not in the future.');
      return;
    }

    setIsSavingProfile(true);
    setFormError('');
    setFeedback(null);
    try {
      const result = await saveAdminProfile(selectedAdmin.id, profile);
      const records = await loadAdmins();
      const refreshedAdmin = records?.find(record => record.id === selectedAdmin.id);
      setSelectedAdmin(refreshedAdmin || result.admin);
      setIsEditingAdmin(false);
      setEditForm(null);
      setFeedback({
        type: result.emailChangePending ? 'warning' : 'success',
        message: result.emailChangePending
          ? 'Profile changes were saved. The email address will update after Supabase Auth verification is completed.'
          : 'Administrator profile changes were saved successfully.'
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this administrator profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFeedback(null);
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setFormError('Full name and email address are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter a valid email address.');
      return;
    }

    setIsSaving(true);
    try {
      await createAdminInvitation(trimmedName, trimmedEmail);
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        closeForm();
        setFeedback({
          type: 'success',
          message: `A secure sign-in/setup link was sent to ${trimmedEmail}. Administrator access is activated only after the recipient verifies that email.`
        });
      } catch (error) {
        closeForm();
        setFeedback({
          type: 'error',
          message: `The invitation was saved, but Supabase could not send the setup link: ${error instanceof Error ? error.message : 'email delivery failed'}. Configure Supabase Auth email delivery, then resend the invitation.`
        });
      }
      await loadAdmins();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to add this administrator.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (admin: Administrator) => {
    if (!window.confirm(`Deactivate ${admin.display_name || admin.email}? They will no longer be able to access the administrator account.`)) {
      return;
    }
    setFeedback(null);
    setDeactivatingId(admin.id);
    try {
      await deactivateAdmin(admin.id);
      await loadAdmins();
      setFeedback({ type: 'success', message: `${admin.display_name || admin.email} was deactivated.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to deactivate this administrator.' });
    } finally {
      setDeactivatingId(null);
    }
  };

  const AdminActions = ({ admin }: { admin: Administrator }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => { setSelectedAdmin(admin); setIsEditingAdmin(false); setEditForm(null); }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Eye className="h-3.5 w-3.5" />
        View
      </button>
      {!admin.id.startsWith('invitation:') && (
        <button
          type="button"
          onClick={() => startEditingAdmin(admin)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      )}
      {admin.status !== 'deactivated' && admin.status !== 'invited' && !isPrimaryAdmin(admin.email) && (
        <button
          type="button"
          disabled={deactivatingId === admin.id}
          onClick={() => void handleDeactivate(admin)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {deactivatingId === admin.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
          Deactivate
        </button>
      )}
    </div>
  );

  if (!isPrimaryAdmin(user.email)) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <h1 className="text-lg font-bold">Administrator access required</h1>
        <p className="mt-1 text-sm">Only the primary administrator is authorized to manage administrator accounts.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#15418C] dark:bg-blue-950/50 dark:text-blue-300">
            <ShieldCheck className="h-4 w-4" />
            Access management
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-slate-100 sm:text-3xl">Manage Administrators</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Manage authorized system administrators. Invitees receive a secure sign-in link and become administrators only after verifying their email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setFeedback(null); setFormError(''); setShowAddForm(true); }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#15418C] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#123873] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      {feedback && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : feedback.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Administrator accounts</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{admins.length} account{admins.length === 1 ? '' : 's'}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAdmins()}
            disabled={isLoading}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#2563EB]" />
            Loading administrators…
          </div>
        ) : loadError ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
            <AlertCircle className="mb-2 h-6 w-6 text-red-500" />
            <p className="max-w-xl text-sm text-red-700 dark:text-red-300">{loadError}</p>
            <button type="button" onClick={() => void loadAdmins()} className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">Try again</button>
          </div>
        ) : admins.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
            <ShieldCheck className="mb-2 h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No administrator accounts found</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use Add Admin to invite an authorized administrator.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Administrator</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date added</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {admins.map(admin => (
                    <tr key={admin.id} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{admin.display_name || 'Administrator'}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{admin.email}</p>
                      </td>
                      <td className="px-4 py-4 capitalize">{admin.role}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          admin.status === 'deactivated'
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            : admin.status === 'invited'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}>{statusLabel(admin.status)}</span>
                      </td>
                      <td className="px-4 py-4 text-xs">{formatDate(admin.created_at)}</td>
                      <td className="px-4 py-4"><AdminActions admin={admin} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {admins.map(admin => (
                <article key={admin.id} className="space-y-3 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#15418C] dark:bg-blue-950/50 dark:text-blue-300">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{admin.display_name || 'Administrator'}</p>
                      <p className="break-all text-xs text-slate-500 dark:text-slate-400">{admin.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      admin.status === 'deactivated'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        : admin.status === 'invited'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    }`}>{statusLabel(admin.status)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{admin.role}</span>
                    <span>Added {formatDate(admin.created_at)}</span>
                  </div>
                  <AdminActions admin={admin} />
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={event => {
          if (event.target === event.currentTarget && !isSaving) closeForm();
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-admin-title" className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="add-admin-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">Add administrator</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">A secure sign-in link will be sent. Administrator access is granted only after the recipient verifies their email.</p>
              </div>
              <button type="button" onClick={closeForm} disabled={isSaving} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input required maxLength={120} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950" />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-950" />
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Administrator role</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">Admin</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Account status</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">After email verification</p>
                </div>
              </div>
              {formError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={isSaving} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#15418C] px-4 text-sm font-bold text-white hover:bg-[#123873] disabled:opacity-60">
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isSaving ? 'Sending invitation…' : 'Send invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAdmin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-5" onMouseDown={event => {
          if (event.target === event.currentTarget && !isSavingProfile) {
            setSelectedAdmin(null);
            setIsEditingAdmin(false);
            setEditForm(null);
          }
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="admin-details-title" className="my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-[#15418C] dark:bg-blue-950/60 dark:text-blue-200">
                  {(isEditingAdmin ? editForm?.photoUrl : selectedAdmin.photo_url)
                    ? <img src={(isEditingAdmin ? editForm?.photoUrl : selectedAdmin.photo_url) || undefined} alt="Administrator profile" className="h-11 w-11 rounded-full object-cover" />
                    : (selectedAdmin.display_name || selectedAdmin.email || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 id="admin-details-title" className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                    {isEditingAdmin ? 'Edit administrator profile' : 'Administrator profile'}
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedAdmin.display_name || selectedAdmin.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setSelectedAdmin(null); setIsEditingAdmin(false); setEditForm(null); }} disabled={isSavingProfile} aria-label="Close details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>

            {isEditingAdmin && editForm ? (
              <form onSubmit={handleSaveAdminProfile} className="space-y-5 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-[#15418C] dark:bg-blue-950/60 dark:text-blue-200">
                    {editForm.photoUrl
                      ? <img src={editForm.photoUrl} alt="Administrator profile preview" className="h-full w-full object-cover" />
                      : (editForm.displayName || selectedAdmin.email || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={handleAdminPhotoChange} className="sr-only" aria-label="Upload profile photo" />
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Change profile photo</button>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Images are resized and saved to the existing Auth profile.</p>
                  </div>
                </div>
                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Personal Information</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Full name</span>
                      <input required maxLength={255} autoComplete="name" value={editForm.displayName} onChange={event => setEditForm({ ...editForm, displayName: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Date of birth</span>
                      <input type="date" max={new Date().toISOString().slice(0, 10)} value={editForm.dateOfBirth} onChange={event => setEditForm({ ...editForm, dateOfBirth: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    </label>
                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Age</span>
                      <div className="flex min-h-10 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {editForm.dateOfBirth ? calculateAge(editForm.dateOfBirth) ?? 'Enter a valid date' : selectedAdmin.age ?? 'Not provided'}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Gender</span>
                      <select value={editForm.gender} onChange={event => setEditForm({ ...editForm, gender: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <option value="">Not specified</option>
                        {editForm.gender && !['Female', 'Male', 'Other', 'Prefer not to say'].includes(editForm.gender) && <option>{editForm.gender}</option>}
                        <option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Civil status</span>
                      <select value={editForm.civilStatus} onChange={event => setEditForm({ ...editForm, civilStatus: event.target.value })} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <option value="">Not specified</option>
                        {editForm.civilStatus && !['Single', 'Married', 'Widowed', 'Separated'].includes(editForm.civilStatus) && <option>{editForm.civilStatus}</option>}
                        <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contact Information</h3>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Contact number</span>
                    <input type="tel" inputMode="numeric" maxLength={11} pattern="[0-9]{11}" value={editForm.contactNumber} onChange={event => setEditForm({ ...editForm, contactNumber: event.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="11 digits" className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                </section>

                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Address Information</h3>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Complete address</span>
                    <textarea rows={3} maxLength={2000} value={editForm.address} onChange={event => setEditForm({ ...editForm, address: event.target.value })} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                </section>

                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account &amp; Security</h3>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Email address</span>
                    <input required type="email" maxLength={254} autoComplete="email" readOnly value={editForm.email} className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                      Email is managed by Supabase Auth and cannot be changed from this profile editor.
                    </span>
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ReadOnlyField label="Administrator role" value={selectedAdmin.role} />
                    <ReadOnlyField label="Account status" value={statusLabel(selectedAdmin.status)} />
                    <ReadOnlyField label="Email verification" value={selectedAdmin.email_verified == null ? 'Not available' : selectedAdmin.email_verified ? 'Verified' : 'Not verified'} />
                    <ReadOnlyField label="Date added" value={formatDate(selectedAdmin.created_at)} />
                    <ReadOnlyField label="Last sign-in" value={formatDateTime(selectedAdmin.last_sign_in_at)} />
                    <ReadOnlyField label="Authentication user ID" value={selectedAdmin.id} breakAll />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Administrator Details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReadOnlyField label="Position / designation" value="Not stored in the current profile schema" />
                    <ReadOnlyField label="Office / department" value="Not stored in the current profile schema" />
                  </div>
                </section>

                {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{formError}</p>}
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                  <button type="button" disabled={isSavingProfile} onClick={() => { setIsEditingAdmin(false); setEditForm(null); setFormError(''); }} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
                  <button type="submit" disabled={isSavingProfile} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#15418C] px-4 text-sm font-bold text-white hover:bg-[#123873] disabled:opacity-60">
                    {isSavingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSavingProfile ? 'Saving changes…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5 px-5 py-5 sm:px-6">
                <section>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Personal Information</h3>
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <DetailField label="Full name" value={selectedAdmin.display_name || 'Not provided'} />
                    <DetailField label="Date of birth" value={selectedAdmin.date_of_birth ? formatDate(selectedAdmin.date_of_birth) : 'Not provided'} />
                    <DetailField label="Age" value={calculateAge(selectedAdmin.date_of_birth) ?? selectedAdmin.age ?? 'Not provided'} />
                    <DetailField label="Gender" value={selectedAdmin.gender || 'Not provided'} />
                    <DetailField label="Civil status" value={selectedAdmin.civil_status || 'Not provided'} />
                  </div>
                </section>
                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contact Information</h3>
                  <DetailField label="Contact number" value={selectedAdmin.contact_number || 'Not provided'} icon={<Phone className="h-3.5 w-3.5" />} />
                </section>
                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Address Information</h3>
                  <DetailField label="Complete address" value={selectedAdmin.address || 'Not provided'} icon={<MapPin className="h-3.5 w-3.5" />} />
                </section>
                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account &amp; Security</h3>
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <DetailField label="Email address" value={selectedAdmin.email} />
                    <DetailField label="Administrator role" value={selectedAdmin.role} />
                    <DetailField label="Account status" value={statusLabel(selectedAdmin.status)} />
                    <DetailField label="Email verification" value={selectedAdmin.email_verified == null ? 'Not available' : selectedAdmin.email_verified ? 'Verified' : 'Not verified'} />
                    <DetailField label="Date added" value={formatDate(selectedAdmin.created_at)} />
                    <DetailField label="Last sign-in" value={formatDateTime(selectedAdmin.last_sign_in_at)} />
                    <DetailField label="Authentication user ID" value={selectedAdmin.id} />
                  </div>
                </section>
                <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Administrator Details</h3>
                  <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <DetailField label="Position / designation" value="Not stored in the current profile schema" />
                    <DetailField label="Office / department" value="Not stored in the current profile schema" />
                  </div>
                </section>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                  {selectedAdmin.id.startsWith('invitation:') ? (
                    <button type="button" onClick={() => setSelectedAdmin(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setSelectedAdmin(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
                      <button type="button" onClick={() => startEditingAdmin(selectedAdmin)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#15418C] px-4 text-sm font-bold text-white hover:bg-[#123873]"><Pencil className="h-4 w-4" />Edit profile</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
