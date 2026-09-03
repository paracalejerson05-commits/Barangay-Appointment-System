import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, query, collection, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export function useSchedule() {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'schedule'), (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data());
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/schedule');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for announcements
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  const getAvailableSlots = async (date: string) => {
    if (!schedule || !date) return [];

    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = schedule.weekly?.[dayName];
    const specialDate = schedule.specialDates?.find((d: any) => d.date === date);

    let isClosed = !daySchedule?.enabled || specialDate?.closed;
    let start = daySchedule?.start;
    let end = daySchedule?.end;

    if (specialDate && !specialDate.closed) {
      isClosed = false;
      start = specialDate.start;
      end = specialDate.end;
    }

    if (isClosed || !start || !end) return [];

    const duration = schedule.slotDuration || 30;
    const maxCapacity = schedule.maxCapacityPerSlot || 5;
    
    // Fetch global appointments for this specific date
    const q = query(
      collection(db, 'serviceRequests'),
      where('appointmentDate', '==', date),
      where('status', 'in', ['pending', 'approved'])
    );
    
    let dateBookings: any[] = [];
    try {
      const snapshot = await getDocs(q);
      dateBookings = snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error("Error fetching global appointments:", error);
    }

    const slots = [];
    let current = new Date(`2000-01-01T${start}`);
    const endTime = new Date(`2000-01-01T${end}`);

    while (current < endTime) {
      const timeStr = current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const count = dateBookings.filter(b => b.appointmentTime === timeStr).length;
      const isFull = count >= maxCapacity;

      slots.push({ 
        time: timeStr, 
        display: current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        count,
        isFull
      });
      current.setMinutes(current.getMinutes() + duration);
    }

    return slots;
  };

  const getRecommendation = async (date: string) => {
    if (!schedule || !date) return null;

    let targetDate = date;
    let attempts = 0;
    const maxAttempts = 14; // Look up to 2 weeks ahead

    while (attempts < maxAttempts) {
      const slots = await getAvailableSlots(targetDate);
      
      // Filter out full slots for recommendation
      const availableSlots = slots.filter(s => !s.isFull);
      
      if (availableSlots.length > 0) {
        // Find least busy slot among available ones
        const bestSlot = [...availableSlots].sort((a, b) => a.count - b.count)[0];
        return { date: targetDate, time: bestSlot.time, display: bestSlot.display };
      }

      // Move to next day
      const next = new Date(targetDate);
      next.setDate(next.getDate() + 1);
      targetDate = next.toISOString().split('T')[0];
      attempts++;
    }

    return null;
  };

  const isDateAvailable = (date: string) => {
    if (!schedule) return true;
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const daySchedule = schedule.weekly?.[dayName];
    const specialDate = schedule.specialDates?.find((d: any) => d.date === date);

    if (specialDate) return !specialDate.closed;
    return daySchedule?.enabled;
  };

  return { schedule, loading, getRecommendation, isDateAvailable, getAvailableSlots, announcements };
}
