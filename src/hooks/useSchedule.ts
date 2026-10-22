import { useState, useEffect } from 'react';
import { dbGetSchedule, dbGetAnnouncements } from '../lib/supabaseDb';
import { supabase } from '../lib/supabase';
import { getAvailableAppointmentSlots, isAppointmentDateAvailable } from '../lib/appointmentAvailability';
import { apiUrl } from '../lib/api';

export function useSchedule() {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const sched = await dbGetSchedule();
        if (sched) setSchedule(sched);
        const anns = await dbGetAnnouncements();
        setAnnouncements(anns);
      } catch (err) {
        console.error('Error loading schedule/announcements:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const isDateAvailable = (dateStr: string) => {
    return Boolean(schedule && dateStr && isAppointmentDateAvailable(schedule, dateStr));
  };

  const getAvailableSlots = async (date: string) => {
    if (!schedule || !date) return [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl(`/api/appointment-slots?date=${encodeURIComponent(date)}`), {
        credentials: 'omit',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      });
      if (!response.ok) throw new Error('Availability request failed');
      const result = await response.json();
      return result.slots || [];
    } catch (error) {
      console.error("Error fetching global appointments:", error);
      // Keep the form usable when the availability request is temporarily
      // unavailable. The server still performs the final booking validation.
      return getAvailableAppointmentSlots(schedule, date, []);
    }
  };

  const getRecommendation = async (date: string, serviceType?: string) => {
    if (!schedule || !date) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl(`/api/appointment-recommendation?date=${encodeURIComponent(date)}`), {
        credentials: 'omit',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      });
      if (!response.ok) {
        throw new Error(`Recommendation request failed (${response.status}).`);
      }
      const { recommendation: recommendedSlot } = await response.json();
      if (!recommendedSlot) return null;
      return toRecommendation(recommendedSlot, date);
    } catch (error) {
      console.error('Error fetching appointment recommendation:', error);
      return null;
    }
  };

  return {
    schedule,
    loading,
    announcements,
    isDateAvailable,
    getAvailableSlots,
    getRecommendation
  };
}

function toRecommendation(recommendedSlot: any, requestedDate: string) {
  const queueLevel = recommendedSlot.count === 0 ? 'Low' : recommendedSlot.count < 3 ? 'Moderate' : 'High';
  const waitStart = Math.max(5, recommendedSlot.count * 10);
  return {
    date: recommendedSlot.date,
    time: recommendedSlot.time,
    display: recommendedSlot.display,
    queueLevel,
    estimatedWait: `${waitStart}-${waitStart + 5} minutes`,
    queueCount: recommendedSlot.count,
    slot: recommendedSlot,
    reason: recommendedSlot.date === requestedDate
      ? `${queueLevel} expected queue during this available time.`
      : `Today's remaining schedule was closed, passed, or full. This is the next available ${recommendedSlot.display} slot.`
  };
}
