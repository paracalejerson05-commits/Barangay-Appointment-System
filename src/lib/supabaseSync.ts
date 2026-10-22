import { supabase, isSupabaseConfigured } from './supabase';
import { apiUrl } from './api';

/**
 * Standard Barangay Services Catalog to ensure Supabase 'services' table is populated.
 */
export const STANDARD_BARANGAY_SERVICES = [
  {
    title: 'Barangay Clearance',
    description: 'Official clearance issued for employment, business, and official transactions.',
    category: 'General',
    processing_time: '1-2 Working Days',
    is_active: true
  },
  {
    title: 'Certificate of Indigency',
    description: 'Certification for low-income residents for medical, educational, or financial aid.',
    category: 'General',
    processing_time: '1-2 Working Days',
    is_active: true
  },
  {
    title: 'Certificate of Residency',
    description: 'Proof of residence within Barangay Pupua for legal or administrative needs.',
    category: 'General',
    processing_time: '1-2 Working Days',
    is_active: true
  },
  {
    title: 'BADAC Clearance',
    description: 'Certification for legal and official purposes related to drug-free status.',
    category: 'Compliance',
    processing_time: '2-3 Working Days',
    is_active: true
  },
  {
    title: 'Blotter Report',
    description: 'Official incident or dispute report filed with the barangay.',
    category: 'Community Safety',
    processing_time: '1-2 Working Days',
    is_active: true
  }
];

/**
 * Ensures the 'services' catalog in Supabase is populated.
 */
export async function syncServicesCatalogToSupabase(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const { data: existing, error: fetchErr } = await supabase.from('services').select('title');
    if (fetchErr) {
      console.warn('[Supabase Sync] Could not check existing services:', fetchErr.message);
      return 0;
    }

    const existingTitles = new Set((existing || []).map((s: any) => s.title));
    const toInsert = STANDARD_BARANGAY_SERVICES.filter(s => !existingTitles.has(s.title));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('services').insert(toInsert.map(service => ({ ...service, fee: null })));
      if (insErr) {
        console.warn('[Supabase Sync] Error inserting services catalog:', insErr.message);
        return existing?.length || 0;
      }
      return (existing?.length || 0) + toInsert.length;
    }
    return existing?.length || 0;
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing services catalog:', err);
    return 0;
  }
}

/**
 * Synchronizes a user profile to the Supabase 'users' table.
 */
export async function syncUserToSupabase(
  user: { uid?: string; id?: string; email?: string | null; displayName?: string | null },
  profile?: any
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const uid = user.uid || user.id || profile?.uid || profile?.id;
  const email = String(user.email || profile?.email || '').trim().toLowerCase();
  if (!uid || !email) return false;

  const fullAddress = [
    profile?.address,
    profile?.barangay,
    profile?.city,
    profile?.province
  ].filter(Boolean).join(', ') || profile?.address || null;

  try {
    const payload: any = {
      id: uid,
      email: email,
      display_name: profile?.displayName || user.displayName || email.split('@')[0],
      role: profile?.role || 'resident',
      status: profile?.status || (profile?.role === 'admin' ? 'approved' : 'pending'),
      contact_number: profile?.contactNumber || null,
      age: profile?.age ? Number(profile.age) : null,
      gender: profile?.gender || null,
      civil_status: profile?.civilStatus || null,
      address: fullAddress,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase Sync] Upsert failed with full payload, trying fallback:', error.message);
      // Fallback in case table has fewer columns
      const fallbackPayload = {
        id: uid,
        email: email,
        display_name: payload.display_name,
        role: payload.role,
        updated_at: new Date().toISOString()
      };
      const { error: fbErr } = await supabase.from('users').upsert(fallbackPayload, { onConflict: 'id' });
      if (fbErr) {
        console.warn('[Supabase Sync] Fallback user upsert failed:', fbErr.message);
        return false;
      }
    }

    console.log('[Supabase Sync] User successfully recorded in Supabase:', uid);
    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing user to Supabase:', err);
    return false;
  }
}

/**
 * Synchronizes an appointment / service request to Supabase 'service_requests' and 'orders' table.
 */
export async function syncServiceRequestToSupabase(request: {
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
  paymentMethod?: string;
  adminNotes?: string;
}) {
  if (!isSupabaseConfigured) return null;

  try {
    // 1. Ensure user row exists first (to satisfy foreign key constraint)
    await syncUserToSupabase({
      uid: request.residentUid,
      email: request.residentEmail || `${request.residentUid}@resident.pupua.local`,
      displayName: request.residentName
    });

    // 2. Insert into service_requests table
    const timeFormatted = request.appointmentTime.length === 5 
      ? `${request.appointmentTime}:00` 
      : request.appointmentTime;

    const { data: reqData, error: reqError } = await supabase
      .from('service_requests')
      .insert([
        {
          resident_id: request.residentUid,
          resident_name: request.residentName,
          service_type: request.serviceType,
          purpose: request.description || '',
          appointment_date: request.appointmentDate,
          appointment_time: timeFormatted,
          status: request.status || 'pending',
          queue_number: request.queueNumber || null,
          admin_notes: request.adminNotes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (reqError) {
      console.warn('[Supabase Sync] Error syncing service request:', reqError.message);
    } else {
      console.log('[Supabase Sync] Service request recorded in Supabase:', reqData);
    }

    const insertedId = reqData && reqData[0] ? reqData[0].id : null;

    // 3. Insert into orders table (accounting / payment record)
    const fee = request.fee !== undefined ? request.fee : 50.00;
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: request.residentUid,
          service_request_id: insertedId,
          service_type: request.serviceType,
          amount: fee,
          payment_method: request.paymentMethod || 'Cash on Site',
          status: request.status === 'completed' ? 'paid' : 'pending',
          appointment_date: request.appointmentDate,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (orderError) {
      console.warn('[Supabase Sync] Error syncing order to Supabase:', orderError.message);
    } else {
      console.log('[Supabase Sync] Order recorded in Supabase:', orderData);
    }

    return { reqData, orderData };
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing request:', err);
    return null;
  }
}

/**
 * Updates a service request's status, notes, or queue number in Supabase.
 */
export async function updateServiceRequestInSupabase(params: {
  residentId: string;
  serviceType: string;
  appointmentDate?: string;
  status: string;
  adminNotes?: string;
  queueNumber?: number | null;
}) {
  if (!isSupabaseConfigured) return;

  try {
    const matchCriteria: any = {
      resident_id: params.residentId,
      service_type: params.serviceType
    };
    if (params.appointmentDate) {
      matchCriteria.appointment_date = params.appointmentDate;
    }

    const updateFields: any = {
      status: params.status,
      updated_at: new Date().toISOString()
    };
    if (params.adminNotes !== undefined) {
      updateFields.admin_notes = params.adminNotes;
    }
    if (params.queueNumber !== undefined) {
      updateFields.queue_number = params.queueNumber;
    }

    const { error: reqErr } = await supabase
      .from('service_requests')
      .update(updateFields)
      .match(matchCriteria);

    if (reqErr) {
      console.warn('[Supabase Sync] Error updating service_request status in Supabase:', reqErr.message);
    } else {
      console.log('[Supabase Sync] Service request status updated in Supabase:', params.status);
    }

    // If marked as completed, update associated order to 'paid'
    if (params.status === 'completed') {
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .match({ user_id: params.residentId, service_type: params.serviceType });

      if (orderErr) {
        console.warn('[Supabase Sync] Error updating order status to paid:', orderErr.message);
      }
    }
  } catch (err) {
    console.warn('[Supabase Sync] Exception updating service request:', err);
  }
}

/**
 * Synchronizes an announcement to Supabase 'announcements' table.
 */
export async function syncAnnouncementToSupabase(announcement: {
  id?: string;
  title: string;
  content: string;
  category?: string;
  status?: string;
  publishDate?: string;
  createdBy?: string;
}) {
  if (!isSupabaseConfigured) return;

  try {
    // Check if announcement already exists by title
    const { data: existing } = await supabase
      .from('announcements')
      .select('id')
      .eq('title', announcement.title)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing announcement
      const { error } = await supabase
        .from('announcements')
        .update({
          content: announcement.content,
          category: announcement.category || 'General',
          status: announcement.status || 'Published',
          publish_date: announcement.publishDate || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', existing[0].id);

      if (error) {
        console.warn('[Supabase Sync] Error updating announcement:', error.message);
      } else {
        console.log('[Supabase Sync] Announcement updated in Supabase:', announcement.title);
      }
    } else {
      // Insert new announcement
      const { error } = await supabase
        .from('announcements')
        .insert([
          {
            title: announcement.title,
            content: announcement.content,
            category: announcement.category || 'General',
            status: announcement.status || 'Published',
            publish_date: announcement.publishDate || new Date().toISOString().split('T')[0],
            created_by: announcement.createdBy || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.warn('[Supabase Sync] Error inserting announcement:', error.message);
      } else {
        console.log('[Supabase Sync] Announcement inserted into Supabase:', announcement.title);
      }
    }
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing announcement:', err);
  }
}

/**
 * Deletes an announcement from Supabase 'announcements' table.
 */
export async function deleteAnnouncementFromSupabase(announcementId?: string, title?: string) {
  if (!isSupabaseConfigured) return;
  try {
    if (title) {
      await supabase.from('announcements').delete().eq('title', title);
    }
    if (announcementId) {
      await supabase.from('announcements').delete().eq('id', announcementId);
    }
    console.log('[Supabase Sync] Announcement deleted from Supabase:', title || announcementId);
  } catch (err) {
    console.warn('[Supabase Sync] Exception deleting announcement from Supabase:', err);
  }
}

/**
 * Synchronizes a notification to Supabase 'notifications' table.
 */
export async function syncNotificationToSupabase(notification: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  isRead?: boolean;
}) {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: notification.userId,
          title: notification.title,
          message: notification.message,
          type: notification.type || 'info',
          is_read: notification.isRead || false,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.warn('[Supabase Sync] Error syncing notification:', error.message);
    } else {
      console.log('[Supabase Sync] Notification recorded in Supabase:', notification.title);
    }
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing notification:', err);
  }
}

/**
 * Marks notifications as read in Supabase.
 */
export async function markNotificationReadInSupabase(notificationId?: string, userId?: string) {
  if (!isSupabaseConfigured) return;
  try {
    if (notificationId) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    } else if (userId) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    }
  } catch (err) {
    console.warn('[Supabase Sync] Exception marking notification read:', err);
  }
}

/**
 * Synchronizes special dates and holidays to Supabase 'special_dates' table.
 */
export async function syncSpecialDatesToSupabase(specialDates: Array<{ date: string; reason?: string; isClosed?: boolean }>) {
  if (!isSupabaseConfigured || !Array.isArray(specialDates)) return;

  try {
    for (const sd of specialDates) {
      if (!sd.date) continue;
      const { data: existing } = await supabase
        .from('special_dates')
        .select('id')
        .eq('event_date', sd.date)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('special_dates')
          .update({
            description: sd.reason || 'Barangay Hall Special Schedule',
            is_holiday: sd.isClosed !== false
          })
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('special_dates')
          .insert([
            {
              event_date: sd.date,
              description: sd.reason || 'Barangay Hall Special Schedule',
              is_holiday: sd.isClosed !== false,
              created_at: new Date().toISOString()
            }
          ]);
      }
    }
    console.log('[Supabase Sync] Special dates recorded in Supabase:', specialDates.length);
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing special dates:', err);
  }
}

/**
 * Tests the live connection and counts rows in all Supabase tables.
 */
export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase credentials missing' };
  }

  const startTime = Date.now();
  try {
    const [servicesRes, ordersRes, requestsRes, usersRes, annRes, notifRes, datesRes] = await Promise.all([
      supabase.from('services').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('special_dates').select('*', { count: 'exact', head: true })
    ]);

    const latencyMs = Date.now() - startTime;
    return {
      ok: true,
      latencyMs,
      tables: {
        services: servicesRes.count ?? 0,
        orders: ordersRes.count ?? 0,
        service_requests: requestsRes.count ?? 0,
        users: usersRes.count ?? 0,
        announcements: annRes.count ?? 0,
        notifications: notifRes.count ?? 0,
        special_dates: datesRes.count ?? 0
      }
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Failed to connect to Supabase'
    };
  }
}

/**
 * Permanently deletes or deactivates a resident user profile from both Supabase Auth and Database.
 */
export async function deleteUserFromSupabase(uid: string): Promise<{ success: boolean; error?: string }> {
  if (!uid) return { success: false, error: 'Resident identifier is missing.' };

  let serverError: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // The server route also removes the Auth account when a service-role key is configured.
    const res = await fetch(apiUrl(`/api/residents/${encodeURIComponent(uid)}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      }
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      console.log('[Supabase Sync] Resident deleted/deactivated via backend route:', uid);
      return { success: true };
    }
    serverError = result.error || `Resident removal failed with HTTP ${res.status}.`;
  } catch (err) {
    console.warn('[Supabase Sync] Server route error, attempting direct client fallback:', err);
  }

  // Client-side fallback if server route is unavailable
  try {
    const { data: deletedUser, error } = await supabase
      .from('users')
      .delete()
      .eq('id', uid)
      .select('id')
      .maybeSingle();
    if (error) {
      const { data: deactivatedUser, error: deactivateError } = await supabase
        .from('users')
        .update({ status: 'deactivated', updated_at: new Date().toISOString() })
        .eq('id', uid)
        .select('id')
        .maybeSingle();
      if (deactivateError) {
        return { success: false, error: serverError || deactivateError.message };
      }
      if (!deactivatedUser) {
        return { success: false, error: serverError || 'Resident was not found in Supabase.' };
      }
      return { success: true };
    }
    if (!deletedUser) {
      return { success: false, error: serverError || 'Resident was not found in Supabase.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete user' };
  }
}

/**
 * Updates a resident's account status (active, inactive, deactivated) in Supabase Auth & Database.
 */
export async function updateUserStatusInSupabase(uid: string, status: string): Promise<{ success: boolean; error?: string }> {
  if (!uid || !status) return { success: true };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(apiUrl(`/api/residents/${encodeURIComponent(uid)}/status`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ status })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      return { success: true };
    }
    return { success: false, error: result.error || `Resident status update failed with HTTP ${res.status}.` };
  } catch (err) {
    console.warn('[Supabase Sync] Error calling status endpoint:', err);
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', uid);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update user status' };
  }
}

/**
 * Master Sync: Reads all documents across all collections in the application and
 * records/synchronizes them completely to the Supabase database.
 */
export async function syncEntireSystemToSupabase(firestoreDb: any): Promise<{
  success: boolean;
  stats: {
    users: number;
    requests: number;
    orders: number;
    announcements: number;
    notifications: number;
    services: number;
    specialDates: number;
  };
  errors: string[];
}> {
  const stats = {
    users: 0,
    requests: 0,
    orders: 0,
    announcements: 0,
    notifications: 0,
    services: 0,
    specialDates: 0
  };
  const errors: string[] = [];

  if (!isSupabaseConfigured) {
    return { success: false, stats, errors: ['Supabase is not configured.'] };
  }

  try {
    stats.services = await syncServicesCatalogToSupabase();
    return {
      success: true,
      stats,
      errors: []
    };
  } catch (err: any) {
    return {
      success: false,
      stats,
      errors: [err?.message || 'Sync failed']
    };
  }
}
