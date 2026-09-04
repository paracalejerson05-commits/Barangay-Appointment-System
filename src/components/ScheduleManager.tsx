import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, deleteDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
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
  Megaphone,
  Edit2
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
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState({
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0],
    category: 'General',
    status: 'Published'
  });

  const validateSchedule = () => {
    const anyEnabled = Object.values(schedule).some((day: any) => day.enabled);
    if (!anyEnabled) return "At least one day must be enabled.";
    for (const day in schedule) {
      if (schedule[day].enabled) {
        if (schedule[day].start >= schedule[day].end) {
          return `End time must be after start time for ${day}.`;
        }
      }
    }
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
        slotDuration: 30,
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

  const handleOpenAnnouncementModal = (ann?: any) => {
    if (ann) {
      setCurrentAnnouncement({
        id: ann.id,
        title: ann.title || '',
        content: ann.content || ann.message || '',
        date: ann.date || new Date().toISOString().split('T')[0],
        category: ann.category || 'General',
        status: ann.status || 'Published'
      } as any);
    } else {
      setCurrentAnnouncement({
        title: '',
        content: '',
        date: new Date().toISOString().split('T')[0],
        category: 'General',
        status: 'Published'
      });
    }
    setIsAnnouncementModalOpen(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!currentAnnouncement.title.trim() || !currentAnnouncement.content.trim()) return;
    try {
      if ((currentAnnouncement as any).id) {
        await updateDoc(doc(db, 'announcements', (currentAnnouncement as any).id), {
          title: currentAnnouncement.title,
          content: currentAnnouncement.content,
          date: currentAnnouncement.date,
          category: currentAnnouncement.category,
          status: currentAnnouncement.status,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'announcements'), {
          title: currentAnnouncement.title,
          content: currentAnnouncement.content,
          date: currentAnnouncement.date,
          category: currentAnnouncement.category,
          status: currentAnnouncement.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsAnnouncementModalOpen(false);
    } catch (error) {
      console.error("Error saving announcement:", error);
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
          if (data.weekly) setSchedule(data.weekly);
          if (data.specialDates) setSpecialDates(data.specialDates);
          if (data.maxCapacityPerSlot) setMaxCapacityPerSlot(data.maxCapacityPerSlot);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  const handleDayChange = (day: string, field: string, value: any) => {
    setSchedule((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const addSpecialDate = () => {
    if (!newSpecialDate.date) return;
    if (specialDates.some(d => d.date === newSpecialDate.date)) return;
    
    setSpecialDates([...specialDates, newSpecialDate]);
    setNewSpecialDate({ date: '', closed: true, start: '08:00', end: '12:00' });
  };

  const removeSpecialDate = (dateToRemove: string) => {
    setSpecialDates(specialDates.filter(d => d.date !== dateToRemove));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Schedule & Announcements</h2>
          <p className="text-sm text-neutral-500 mt-1">Manage office hours, special dates, and public announcements.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-sm text-neutral-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-neutral-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-neutral-900">Weekly Office Hours</h3>
            </div>
            <div className="p-2">
              {Object.entries(schedule).map(([day, config]: [string, any]) => (
                <div key={day} className="flex items-center gap-4 p-4 hover:bg-neutral-50 rounded-2xl transition-colors">
                  <label className="flex items-center gap-3 w-32 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => handleDayChange(day, 'enabled', e.target.checked)}
                      className="w-5 h-5 rounded-md border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className={cn(
                      "font-bold text-sm",
                      config.enabled ? "text-neutral-900" : "text-neutral-400"
                    )}>{day}</span>
                  </label>
                  
                  {config.enabled ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input 
                        type="time" 
                        value={config.start}
                        onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                        className="bg-neutral-100 border-none rounded-xl px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full"
                      />
                      <span className="text-neutral-400 font-medium">to</span>
                      <input 
                        type="time" 
                        value={config.end}
                        onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                        className="bg-neutral-100 border-none rounded-xl px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 text-sm font-bold text-neutral-400 bg-neutral-100/50 py-1.5 px-4 rounded-xl inline-flex">
                      Closed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-neutral-900">Capacity Settings</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-neutral-700 mb-2">Maximum Appointments Per Slot</label>
              <input 
                type="number"
                min="1"
                max="50"
                value={maxCapacityPerSlot}
                onChange={(e) => setMaxCapacityPerSlot(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-neutral-500 mt-2 font-medium">This controls how many residents can book the exact same time slot.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900">Announcements</h3>
              </div>
              <button
                onClick={() => handleOpenAnnouncementModal()}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {announcements.length === 0 ? (
                  <p className="text-center py-8 text-neutral-400 text-sm italic">No announcements found.</p>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group relative flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-neutral-900 text-sm">{ann.title || 'Untitled'}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              ann.status === 'Published' ? "bg-green-50 text-green-600 border-green-200" :
                              ann.status === 'Draft' ? "bg-amber-50 text-amber-600 border-amber-200" :
                              "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {ann.status || 'Published'}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-semibold">{ann.category || 'General'}</span>
                            <span className="text-[10px] text-neutral-400">&bull; {ann.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenAnnouncementModal(ann)}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-600 pr-8 whitespace-pre-wrap">{ann.content || ann.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-neutral-900">Special Dates & Holidays</h3>
            </div>
            
            <div className="p-6">
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 mb-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Date</label>
                    <input 
                      type="date"
                      value={newSpecialDate.date}
                      onChange={(e) => setNewSpecialDate({...newSpecialDate, date: e.target.value})}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Status</label>
                    <select
                      value={newSpecialDate.closed ? 'closed' : 'custom'}
                      onChange={(e) => setNewSpecialDate({...newSpecialDate, closed: e.target.value === 'closed'})}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="closed">Closed (Holiday)</option>
                      <option value="custom">Custom Hours</option>
                    </select>
                  </div>
                </div>
                
                {!newSpecialDate.closed && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input 
                        type="time"
                        value={newSpecialDate.start}
                        onChange={(e) => setNewSpecialDate({...newSpecialDate, start: e.target.value})}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button 
                        onClick={() => setNewSpecialDate({...newSpecialDate, start: getCurrentTime()})}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-blue-600 transition-colors"
                        title="Set to current time"
                      >
                        <Clock className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <span className="text-neutral-400 font-medium">to</span>
                    <div className="flex-1 relative">
                      <input 
                        type="time"
                        value={newSpecialDate.end}
                        onChange={(e) => setNewSpecialDate({...newSpecialDate, end: e.target.value})}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button 
                        onClick={() => setNewSpecialDate({...newSpecialDate, end: getCurrentTime()})}
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

      {/* Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">
                {(currentAnnouncement as any).id ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Title</label>
                <input
                  type="text"
                  value={currentAnnouncement.title}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, title: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Barangay Office Schedule"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Date</label>
                  <input
                    type="date"
                    value={currentAnnouncement.date}
                    onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, date: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Category</label>
                  <input
                    type="text"
                    value={currentAnnouncement.category}
                    onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, category: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Advisory"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Status</label>
                <select
                  value={currentAnnouncement.status}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, status: e.target.value as any})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Content</label>
                <textarea
                  value={currentAnnouncement.content}
                  onChange={(e) => setCurrentAnnouncement({...currentAnnouncement, content: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                  placeholder="Type the announcement details..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50">
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-6 py-2 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={!currentAnnouncement.title || !currentAnnouncement.content}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Announcement
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
