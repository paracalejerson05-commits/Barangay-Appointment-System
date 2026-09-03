import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, deleteDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Calendar, 
  Clock, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  CalendarDays,
  XCircle,
  Megaphone
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function ScheduleManager() {
  const [schedule, setSchedule] = useState<any>({
    Monday: { enabled: true, start: '08:00', end: '17:00' },
    Tuesday: { enabled: true, start: '08:00', end: '17:00' },
    Wednesday: { enabled: true, start: '08:00', end: '17:00' },
    Thursday: { enabled: true, start: '08:00', end: '17:00' },
    Friday: { enabled: true, start: '08:00', end: '17:00' },
    Saturday: { enabled: false, start: '08:00', end: '12:00' },
    Sunday: { enabled: false, start: '08:00', end: '12:00' },
  });
  const [maxCapacityPerSlot, setMaxCapacityPerSlot] = useState(5);
  const [specialDates, setSpecialDates] = useState<any[]>([]);
  const [newSpecialDate, setNewSpecialDate] = useState({ date: '', closed: true, start: '08:00', end: '12:00' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');

  const validateSchedule = () => {
    // Check if at least one day is enabled
    const anyEnabled = Object.values(schedule).some((day: any) => day.enabled);
    if (!anyEnabled) return "At least one day must be enabled.";

    // Check time ranges for enabled days
    for (const day in schedule) {
      if (schedule[day].enabled) {
        if (schedule[day].start >= schedule[day].end) {
          return `End time must be after start time for ${day}.`;
        }
      }
    }

    // Check special dates
    for (const item of specialDates) {
      if (!item.closed) {
        if (item.start >= item.end) {
          return `End time must be after start time for special date ${item.date}.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const error = validateSchedule();
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'settings', 'schedule'), {
        weekly: schedule,
        specialDates,
        slotDuration: 30, // Default to 30 mins
        maxCapacityPerSlot,
        updatedAt: serverTimestamp(),
      });
      setMessage({ type: 'success', text: 'Schedule updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving schedule:", error);
      setMessage({ type: 'error', text: 'Failed to save schedule.' });
    } finally {
      setSaving(false);
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (loading) return;
    
    const timer = setTimeout(() => {
      if (isInitialLoad) {
        setIsInitialLoad(false);
        return;
      }
      handleSave();
    }, 1500);

    return () => clearTimeout(timer);
  }, [schedule, specialDates, maxCapacityPerSlot]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        message: newAnnouncement,
        createdAt: serverTimestamp()
      });
      setNewAnnouncement('');
    } catch (error) {
      console.error("Error adding announcement:", error);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      console.error("Error deleting announcement:", error);
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const docRef = doc(db, 'settings', 'schedule');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const weekly = data.weekly || schedule;
          
          // Update current day's start time to now
          const now = new Date();
          const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
          const currentTime = getCurrentTime();
          
          if (weekly[currentDay]) {
            weekly[currentDay].start = currentTime;
          }
          
          setSchedule(weekly);
          setSpecialDates(data.specialDates || []);
          setMaxCapacityPerSlot(data.maxCapacityPerSlot || 5);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  const toggleDay = (day: string) => {
    setSchedule({
      ...schedule,
      [day]: { ...schedule[day], enabled: !schedule[day].enabled }
    });
  };

  const updateTime = (day: string, field: 'start' | 'end', value: string) => {
    setSchedule({
      ...schedule,
      [day]: { ...schedule[day], [field]: value }
    });
  };

  const addSpecialDate = () => {
    if (newSpecialDate.date && !specialDates.find(d => d.date === newSpecialDate.date)) {
      setSpecialDates([...specialDates, newSpecialDate].sort((a, b) => a.date.localeCompare(b.date)));
      setNewSpecialDate({ date: '', closed: true, start: '08:00', end: '12:00' });
    }
  };

  const removeSpecialDate = (date: string) => {
    setSpecialDates(specialDates.filter(d => d.date !== date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Schedule Settings</h2>
            <p className="text-sm text-neutral-500">Configure office hours and appointment slots.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
            <span className="text-xs font-bold text-neutral-500 uppercase">Capacity</span>
            <input 
              type="number"
              min={1}
              max={50}
              value={maxCapacityPerSlot}
              onChange={(e) => setMaxCapacityPerSlot(Number(e.target.value))}
              className="bg-transparent font-bold text-sm text-blue-600 outline-none w-12 text-center"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-100 font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-900">Weekly Schedule</h3>
              <p className="text-sm text-neutral-500">Standard operating hours for the Barangay Hall.</p>
            </div>
            <div className="p-6 space-y-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 rounded-2xl gap-4">
                  <div className="flex items-center gap-4 min-w-[140px]">
                    <button
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out",
                        schedule[day].enabled ? "bg-blue-600" : "bg-neutral-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200",
                        schedule[day].enabled && "translate-x-6"
                      )} />
                    </button>
                    <span className={cn(
                      "font-bold text-sm",
                      schedule[day].enabled ? "text-neutral-900" : "text-neutral-400"
                    )}>
                      {day}
                    </span>
                  </div>

                  {schedule[day].enabled ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Start</span>
                        <div className="relative group/time">
                          <input
                            type="time"
                            value={schedule[day].start}
                            onChange={(e) => updateTime(day, 'start', e.target.value)}
                            className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                          />
                          <button
                            onClick={() => updateTime(day, 'start', getCurrentTime())}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-blue-600 transition-colors"
                            title="Set to current time"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="w-4 h-px bg-neutral-300" />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">End</span>
                        <div className="relative group/time">
                          <input
                            type="time"
                            value={schedule[day].end}
                            onChange={(e) => updateTime(day, 'end', e.target.value)}
                            className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-8"
                          />
                          <button
                            onClick={() => updateTime(day, 'end', getCurrentTime())}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-blue-600 transition-colors"
                            title="Set to current time"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400 italic">Office is closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-neutral-900">Announcements</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type an announcement..."
                  value={newAnnouncement}
                  onChange={(e) => setNewAnnouncement(e.target.value)}
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleAddAnnouncement}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group relative">
                    <p className="text-sm text-neutral-800 pr-8">{ann.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                        {ann.createdAt?.toDate ? ann.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </span>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-900">Special Dates</h3>
              <p className="text-sm text-neutral-500">Holidays or custom hours.</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <input
                  type="date"
                  value={newSpecialDate.date}
                  onChange={(e) => setNewSpecialDate({ ...newSpecialDate, date: e.target.value })}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-neutral-700">Closed All Day</label>
                  <button
                    onClick={() => setNewSpecialDate({ ...newSpecialDate, closed: !newSpecialDate.closed })}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-colors duration-200",
                      newSpecialDate.closed ? "bg-red-600" : "bg-neutral-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform duration-200",
                      newSpecialDate.closed && "translate-x-5"
                    )} />
                  </button>
                </div>
                {!newSpecialDate.closed && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative group/time">
                      <input
                        type="time"
                        value={newSpecialDate.start}
                        onChange={(e) => setNewSpecialDate({ ...newSpecialDate, start: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none pr-7"
                      />
                      <button
                        onClick={() => setNewSpecialDate({ ...newSpecialDate, start: getCurrentTime() })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-blue-600 transition-colors"
                        title="Set to current time"
                      >
                        <Clock className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <div className="relative group/time">
                      <input
                        type="time"
                        value={newSpecialDate.end}
                        onChange={(e) => setNewSpecialDate({ ...newSpecialDate, end: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none pr-7"
                      />
                      <button
                        onClick={() => setNewSpecialDate({ ...newSpecialDate, end: getCurrentTime() })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-blue-600 transition-colors"
                        title="Set to current time"
                      >
                        <Clock className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={addSpecialDate}
                  className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Special Date
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {specialDates.length === 0 ? (
                  <p className="text-center py-8 text-neutral-400 text-sm italic">No special dates added.</p>
                ) : (
                  specialDates.map((item) => (
                    <div key={item.date} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-neutral-900">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => removeSpecialDate(item.date)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.closed ? (
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-md">Closed</span>
                      ) : (
                        <span className="text-xs font-medium text-neutral-500">
                          Custom: {item.start} – {item.end}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "fixed bottom-8 right-8 p-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50",
            message.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-2 hover:opacity-70">
            <XCircle className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
