import { supabase, isSupabaseConfigured } from './supabase';
import { getNotificationTargetUserIds } from './notificationScope';
import { getRequestReference } from './requestPresentation';
import { apiUrl } from './api';

/**
 * Centralized Supabase Database Client replacing Firestore
 */

// --- USERS ---
export async function dbGetUsers() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
}

export async function dbGetUserById(userId: string) {
  if (!isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export async function dbUpsertUser(profile: any) {
  if (!isSupabaseConfigured) return false;
  const normalizedProfile = {
    ...profile,
    email: typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : profile.email,
    display_name: typeof profile.display_name === 'string' ? profile.display_name.trim() : profile.display_name
  };
  const { error } = await supabase.from('users').upsert(normalizedProfile, { onConflict: 'id' });
  if (error) {
    console.error('Error upserting user:', error);
    return false;
  }
  return true;
}

export async function dbDeleteUser(userId: string) {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    console.error('Error deleting user:', error);
    return false;
  }
  return true;
}

// --- SERVICE REQUESTS ---
export async function dbGetServiceRequests(userId?: string, isAdmin?: boolean) {
  if (!isSupabaseConfigured) return [];
  let query = supabase.from('service_requests').select('*').order('created_at', { ascending: false });
  if (!isAdmin && userId) {
    query = query.eq('resident_id', userId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching service requests:', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    referenceNumber: r.reference_number || getRequestReference(r.id, r.created_at),
    residentUid: r.resident_id,
    residentName: r.resident_name,
    serviceType: r.service_type,
    description: r.purpose || r.description,
    appointmentDate: r.appointment_date,
    appointmentTime: r.appointment_time,
    status: r.status,
    queueNumber: r.queue_number,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    completionAction: r.completion_action,
    completionEmailStatus: r.completion_email_status,
    completionEmailError: r.completion_email_error,
    completionNotificationStatus: r.completion_notification_status,
    completionNotificationError: r.completion_notification_error,
    certificateData: r.certificate_data,
    fee: r.fee || 50
  }));
}

export async function dbCreateServiceRequest(req: {
  residentUid: string;
  residentName: string;
  residentEmail?: string;
  serviceType: string;
  description?: string;
  appointmentDate: string;
  appointmentTime: string;
  status?: string;
  queueNumber?: number | null;
  fee?: number;
  adminNotes?: string;
}) {
  if (!isSupabaseConfigured) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(apiUrl('/api/service-requests'), {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(req)
  });
  if ((import.meta as any).env?.DEV) {
    console.debug('[Appointment Submit]', {
      requestUrl: apiUrl('/api/service-requests'),
      requestMethod: 'POST',
      requestBody: {
        appointmentDate: req.appointmentDate,
        appointmentTime: req.appointmentTime,
        serviceType: req.serviceType
      },
      appointmentDate: req.appointmentDate,
      appointmentTime: req.appointmentTime,
      responseStatus: response.status
    });
  }
  const responseText = await response.text();
  let responseBody: any = {};
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = { rawBody: responseText };
  }
  if (!response.ok) {
    if ((import.meta as any).env?.DEV) {
      console.error('[Submit Request Error]', {
        responseStatus: response.status,
        responseBody: {
          error: responseBody.error,
          code: responseBody.code,
          suggestion: responseBody.suggestion,
          debug: responseBody.debug,
          rawBody: responseBody.rawBody
        }
      });
    }
    const suggestion = responseBody.suggestion?.date && responseBody.suggestion?.display
      ? ` Next available: ${responseBody.suggestion.date} at ${responseBody.suggestion.display}.`
      : '';
    throw new Error(responseBody.error
      ? `${responseBody.error}${suggestion}`
      : `Request failed with HTTP ${response.status}${responseBody.rawBody ? `: ${responseBody.rawBody.slice(0, 200)}` : '.'}`);
  }
  const result = responseBody;
  return {
    ...(result.request || {}),
    referenceNumber: result.referenceNumber || getRequestReference(result.request?.id, result.request?.created_at)
  };
}

export async function dbUpdateServiceRequest(id: string, updates: any) {
  if (!isSupabaseConfigured) return false;
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.status) payload.status = updates.status;
  if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;
  if (updates.queueNumber !== undefined) payload.queue_number = updates.queueNumber;
  if (updates.appointmentDate) payload.appointment_date = updates.appointmentDate;
  if (updates.appointmentTime) payload.appointment_time = updates.appointmentTime;
  if (updates.certificateData !== undefined) payload.certificate_data = updates.certificateData;

  const { error } = await supabase.from('service_requests').update(payload).eq('id', id);
  if (error) {
    console.error('Error updating service request:', error);
    return false;
  }
  return true;
}

export async function dbDeleteServiceRequest(id: string) {
  if (!isSupabaseConfigured || !id) {
    throw new Error('The request could not be deleted. Please try again.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(apiUrl(`/api/service-requests/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Request deletion failed with HTTP ${response.status}.`);
  }
  return true;
}

export async function dbCompleteServiceRequest(id: string, action: 'PRINT' | 'DOWNLOAD') {
  if (!isSupabaseConfigured || !id) {
    throw new Error('The request could not be marked completed. Please try again.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(apiUrl(`/api/service-requests/${encodeURIComponent(id)}/complete`), {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ action })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Request completion failed with HTTP ${response.status}.`);
  }
  const raw = result.request || {};
  return {
    ...result,
    request: {
      id: raw.id,
      referenceNumber: raw.reference_number || getRequestReference(raw.id, raw.created_at),
      residentUid: raw.resident_id,
      residentName: raw.resident_name,
      serviceType: raw.service_type,
      description: raw.purpose || raw.description,
      appointmentDate: raw.appointment_date,
      appointmentTime: raw.appointment_time,
      status: raw.status,
      queueNumber: raw.queue_number,
      adminNotes: raw.admin_notes,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      completedAt: raw.completed_at,
      completedBy: raw.completed_by,
      completionAction: raw.completion_action,
      completionEmailStatus: raw.completion_email_status,
      completionEmailError: raw.completion_email_error,
      completionNotificationStatus: raw.completion_notification_status,
      completionNotificationError: raw.completion_notification_error,
      certificateData: raw.certificate_data,
      fee: raw.fee || 50
    }
  } as { request: any; emailStatus: string; notificationStatus: string };
}

export async function dbUpdateUser(userId: string, updates: any) {
  if (!isSupabaseConfigured || !userId) return false;
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.contactNumber !== undefined) payload.contact_number = updates.contactNumber;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.age !== undefined) payload.age = updates.age;
  if (updates.gender !== undefined) payload.gender = updates.gender;
  if (updates.civilStatus !== undefined) payload.civil_status = updates.civilStatus;
  if (updates.status !== undefined) payload.status = updates.status;
  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  if (error) {
    console.error('Error updating user:', error);
    return false;
  }
  return true;
}

// --- NOTIFICATIONS ---
export async function dbGetNotifications(userId: string) {
  if (!isSupabaseConfigured || !userId) return [];

  const targetUserIds = getNotificationTargetUserIds(userId, userId === 'admin');
  const notificationQuery = supabase.from('notifications').select('*').order('created_at', { ascending: false });

  const scopedQuery = targetUserIds.length === 1
    ? notificationQuery.eq('user_id', targetUserIds[0])
    : notificationQuery.in('user_id', targetUserIds);

  const { data, error } = await scopedQuery;

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return (data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    read: Boolean(n.is_read),
    createdAt: n.created_at
  }));
}

export async function dbAddNotification(notif: { userId: string; title: string; message: string; type?: string }) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('notifications').insert([{
    user_id: notif.userId,
    title: notif.title,
    message: notif.message,
    type: notif.type || 'info',
    is_read: false,
    created_at: new Date().toISOString()
  }]).select();

  if (error) {
    console.error('Error adding notification:', error);
    return null;
  }
  return data?.[0] || null;
}

export async function dbMarkNotificationRead(id: string) {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
  return true;
}

// --- ANNOUNCEMENTS ---
export async function dbGetAnnouncements() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    category: a.category || 'General',
    status: a.status || 'Published',
    visibility: a.visibility || 'Public',
    createdAt: a.created_at
  }));
}

export async function dbSaveAnnouncement(ann: { id?: string; title: string; content: string; category?: string; status?: string; visibility?: string }) {
  if (!isSupabaseConfigured) return null;
  if (ann.id) {
    const { data, error } = await supabase.from('announcements').update({
      title: ann.title,
      content: ann.content,
      category: ann.category || 'General',
      status: ann.status || 'Published',
      updated_at: new Date().toISOString()
    }).eq('id', ann.id).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('The announcement could not be found.');
    return ann.id;
  } else {
    const { data, error } = await supabase.from('announcements').insert([{
      title: ann.title,
      content: ann.content,
      category: ann.category || 'General',
      status: ann.status || 'Published',
      created_at: new Date().toISOString()
    }]).select();
    if (error) throw new Error(error.message);
    if (!data?.[0]?.id) throw new Error('The announcement was not returned after saving.');
    return data[0].id;
  }
}

export async function dbNotifyResidentsOfAnnouncement(announcementId: string): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(apiUrl(`/api/announcements/${encodeURIComponent(announcementId)}/notify`), {
    method: 'POST',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Resident notifications failed with HTTP ${response.status}.`);
  }
  return Number(result.notifiedCount) || 0;
}

export async function dbDeleteAnnouncement(id: string) {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return false;
  return true;
}

// --- SCHEDULE ---
export async function dbGetSchedule() {
  const localSchedule = getLocalSchedule();
  if (!isSupabaseConfigured) return localSchedule;
  let { data, error } = await supabase.from('settings').select('*').eq('key', 'schedule').maybeSingle();
  if (error) {
    ({ data, error } = await supabase.from('settings').select('*').eq('id', 'schedule').maybeSingle());
  }
  if (error || !data) {
    return localSchedule;
  }
  const schedule = data.value || data;
  if (typeof schedule === 'string') {
    try {
      return JSON.parse(schedule);
    } catch {
      return null;
    }
  }
  return schedule;
}

export async function dbSaveSchedule(scheduleData: any) {
  saveLocalSchedule(scheduleData);
  if (!isSupabaseConfigured) return true;
  const updatedAt = new Date().toISOString();

  // The deployed settings table uses the id/value shape.
  let { error } = await supabase.from('settings').upsert({
    id: 'schedule',
    value: scheduleData,
    updated_at: updatedAt
  }, { onConflict: 'id' });

  if (error) {
    // Support older deployments that use a key/value shape.
    ({ error } = await supabase.from('settings').upsert({
      key: 'schedule',
      value: scheduleData,
      updated_at: updatedAt
    }, { onConflict: 'key' }));
  }

  if (error) {
    console.error('Error saving schedule:', error);
    return false;
  }
  return true;
}

function getLocalSchedule() {
  try {
    const stored = window.localStorage.getItem('barangay_schedule');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveLocalSchedule(scheduleData: any) {
  try {
    window.localStorage.setItem('barangay_schedule', JSON.stringify(scheduleData));
  } catch {
    // Local storage can be unavailable in private browsing or restricted webviews.
  }
}
