import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { syncSpecialDatesToSupabase } from '../lib/supabaseSync';
import { dbGetSchedule, dbSaveSchedule, dbGetAnnouncements, dbSaveAnnouncement, dbNotifyResidentsOfAnnouncement, dbDeleteAnnouncement } from '../lib/supabaseDb';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DEFAULT_WEEKLY_SCHEDULE = {
  Monday: { enabled: true, start: '08:00', end: '17:00' },
  Tuesday: { enabled: true, start: '08:00', end: '17:00' },
  Wednesday: { enabled: true, start: '08:00', end: '17:00' },
  Thursday: { enabled: true, start: '08:00', end: '17:00' },
  Friday: { enabled: true, start: '08:00', end: '17:00' },
  Saturday: { enabled: false, start: '08:00', end: '12:00' },
  Sunday: { enabled: false, start: '08:00', end: '12:00' },
};

type SpecialDate = { date: string; closed: boolean; start: string; end: string; reason?: string };
type AnnouncementDraft = {
  id?: string;
  title: string;
  content: string;
  category: string;
  status: string;
};
type SectionName = 'weekly' | 'capacity' | 'announcements';

const makeSnapshot = (weekly: unknown, specialDates: SpecialDate[], capacity: string) =>
  JSON.stringify({ weekly, specialDates, maxCapacityPerSlot: Number(capacity) });

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTime(value: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function Section({
  id,
  title,
  description,
  icon: Icon,
  expanded,
  onToggle,
  children
}: {
  id: SectionName;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `schedule-section-${id}`;
  return (
    <section className="overflow-hidden rounded-xl border border-blue-200/80 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-[64px] w-full items-center justify-between gap-3 bg-blue-50/40 px-4 py-3 text-left transition-colors hover:bg-blue-50/80 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-5 text-[#0F172A] sm:text-base">{title}</span>
              <span className="mt-0.5 block text-xs leading-4 text-[#64748B]">{description}</span>
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-slate-500 transition-transform', expanded && 'rotate-180')} />
        </button>
      </h2>
      {expanded && <div id={panelId} className="border-t border-blue-100 px-4 py-3 sm:px-5 sm:py-4">{children}</div>}
    </section>
  );
}

export function ScheduleManager() {
  const [schedule, setSchedule] = useState<any>(DEFAULT_WEEKLY_SCHEDULE);
  const [maxCapacityPerSlot, setMaxCapacityPerSlot] = useState('5');
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [capacityError, setCapacityError] = useState('');
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementFeedback, setAnnouncementFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>({
    weekly: true,
    capacity: false,
    announcements: false
  });
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<AnnouncementDraft>({
    title: '',
    content: '',
    category: 'General',
    status: 'Published'
  });
  const savedSnapshot = useRef<string | null>(null);
  const latestSnapshot = useRef('');

  const snapshot = makeSnapshot(schedule, specialDates, maxCapacityPerSlot);
  latestSnapshot.current = snapshot;

  const validateSchedule = (): string | null => {
    const capacity = Number(maxCapacityPerSlot);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return 'Maximum appointments per slot must be a positive whole number.';
    }
    const enabledDays = WEEKDAYS.filter(day => schedule[day]?.enabled);
    if (enabledDays.length === 0) return 'At least one day must be enabled.';
    for (const day of enabledDays) {
      const { start, end } = schedule[day];
      if (!isValidTime(start) || !isValidTime(end) || start >= end) {
        return `Enter valid start and end times for ${day}; the end must be later than the start.`;
      }
    }
    const seenDates = new Set<string>();
    for (const item of specialDates) {
      if (!isValidDate(item.date)) return `Enter a valid date for special date ${item.date || ''}.`;
      if (seenDates.has(item.date)) return `There is more than one special-date entry for ${item.date}.`;
      seenDates.add(item.date);
      if (!item.closed && (!isValidTime(item.start) || !isValidTime(item.end) || item.start >= item.end)) {
        return `Enter valid custom hours for ${item.date}; the end must be later than the start.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateSchedule();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }
    const savingSnapshot = snapshot;
    setSaving(true);
    setMessage(null);
    try {
      const scheduleData = {
        weekly: schedule,
        specialDates,
        slotDuration: 30,
        maxCapacityPerSlot: Number(maxCapacityPerSlot),
        updatedAt: new Date().toISOString()
      };
      if (!(await dbSaveSchedule(scheduleData))) {
        throw new Error('The schedule could not be synchronized to the application database.');
      }
      await syncSpecialDatesToSupabase(specialDates.map(item => ({
        date: item.date,
        reason: item.reason || 'Barangay Hall Special Schedule',
        isClosed: item.closed
      })));
      savedSnapshot.current = savingSnapshot;
      const stillDirty = latestSnapshot.current !== savingSnapshot;
      setDirty(stillDirty);
      setMessage({ type: 'success', text: stillDirty ? 'Saved. Newer changes are still pending.' : 'Schedule updated successfully.' });
      if (!stillDirty) window.setTimeout(() => setMessage(current => current?.type === 'success' ? null : current), 3000);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: 'Failed to save schedule. Your changes are still available to retry.' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchSchedule = async () => {
      try {
        const data = await dbGetSchedule();
        if (!active) return;
        const weekly = data?.weekly ? { ...DEFAULT_WEEKLY_SCHEDULE, ...data.weekly } : DEFAULT_WEEKLY_SCHEDULE;
        const loadedSpecialDates = Array.isArray(data?.specialDates) ? data.specialDates : [];
        const loadedCapacity = data?.maxCapacityPerSlot == null ? '5' : String(data.maxCapacityPerSlot);
        setSchedule(weekly);
        setSpecialDates(loadedSpecialDates);
        setMaxCapacityPerSlot(loadedCapacity);
        savedSnapshot.current = makeSnapshot(weekly, loadedSpecialDates, loadedCapacity);
      } catch (error) {
        console.error('Error fetching schedule:', error);
        setMessage({ type: 'error', text: 'Could not load the saved schedule.' });
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSchedule();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || savedSnapshot.current === null || snapshot === savedSnapshot.current) return;
    setDirty(true);
    setMessage(null);
    const timer = window.setTimeout(() => { void handleSave(); }, 900);
    return () => window.clearTimeout(timer);
  }, [schedule, specialDates, maxCapacityPerSlot, loading]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  const refreshAnnouncements = async () => {
    setAnnouncements(await dbGetAnnouncements());
  };

  useEffect(() => {
    let active = true;
    dbGetAnnouncements().then(list => { if (active) setAnnouncements(list); });
    return () => { active = false; };
  }, []);

  const toggleSection = (section: SectionName) => {
    setExpandedSections(current => ({ ...current, [section]: !current[section] }));
  };

  const handleDayChange = (day: typeof WEEKDAYS[number], field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    setSchedule((current: any) => ({
      ...current,
      [day]: { ...current[day], [field]: value }
    }));
  };

  const openAnnouncement = (announcement?: any) => {
    setAnnouncementError('');
    setAnnouncementFeedback(null);
    setCurrentAnnouncement(announcement ? {
      id: announcement.id,
      title: announcement.title || '',
      content: announcement.content || announcement.message || '',
      category: announcement.category || 'General',
      status: announcement.status || 'Published'
    } : { title: '', content: '', category: 'General', status: 'Published' });
    setIsAnnouncementModalOpen(true);
  };

  const saveAnnouncement = async () => {
    if (!currentAnnouncement.title.trim() || !currentAnnouncement.content.trim()) {
      setAnnouncementError('Enter a title and announcement content.');
      return;
    }
    setAnnouncementSaving(true);
    setAnnouncementError('');
    setAnnouncementFeedback(null);
    try {
      const savedId = await dbSaveAnnouncement(currentAnnouncement);
      if (!savedId) throw new Error('The announcement was not saved.');
      await refreshAnnouncements();
      setIsAnnouncementModalOpen(false);
      setAnnouncementFeedback({ type: 'success', text: 'Announcement saved successfully.' });
      if (currentAnnouncement.status === 'Published') {
        try {
          const notifiedCount = await dbNotifyResidentsOfAnnouncement(savedId);
          setAnnouncementFeedback({
            type: 'success',
            text: `Announcement saved and residents notified (${notifiedCount}).`
          });
        } catch (notificationError) {
          console.error('Error notifying residents about announcement:', notificationError);
          const reason = notificationError instanceof Error ? notificationError.message : 'Unknown notification error.';
          setAnnouncementFeedback({
            type: 'error',
            text: `Announcement saved, but resident notifications could not be sent: ${reason}`
          });
        }
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
      setAnnouncementError(error instanceof Error
        ? `Could not save the announcement: ${error.message}`
        : 'Could not save the announcement. Please try again.');
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      if (!(await dbDeleteAnnouncement(id))) throw new Error('The announcement could not be deleted.');
      await refreshAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setAnnouncementError('Could not delete the announcement. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  }

  const fieldClass = 'h-11 w-full min-w-0 rounded-lg border border-blue-200 bg-white px-3 text-base font-medium text-[#0F172A] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
  const compactFieldClass = 'h-11 w-full min-w-0 rounded-lg border border-blue-200 bg-white px-3 text-base font-medium text-[#0F172A] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="schedule-manager space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/80 pb-3">
        <p className="max-w-2xl text-[13px] leading-5 text-[#64748B] sm:text-sm">
          Manage office hours, capacity settings, and public announcements.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span role="status" aria-live="polite" className="hidden text-xs font-medium text-[#64748B] sm:inline">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : message?.type === 'success' ? 'All changes saved' : ''}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E293B] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message" className="ml-auto p-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <Section
          id="weekly"
          title="Weekly Office Hours"
          description="Set operating days and the hours available for appointments."
          icon={CalendarDays}
          expanded={expandedSections.weekly}
          onToggle={() => toggleSection('weekly')}
        >
          <div className="space-y-2">
            {WEEKDAYS.map(day => {
              const config = schedule[day];
              return (
                <div key={day} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)] sm:items-center">
                  <label className="flex min-h-8 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(config.enabled)}
                      onChange={event => handleDayChange(day, 'enabled', event.target.checked)}
                      className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={cn('text-sm font-semibold', config.enabled ? 'text-[#0F172A]' : 'text-slate-500')}>{day}</span>
                    {!config.enabled && <span className="text-xs text-slate-500">Closed</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0 space-y-1 text-xs font-semibold text-[#64748B]">
                      <span>Start</span>
                      <input
                        aria-label={`${day} start time`}
                        type="time"
                        value={config.start}
                        disabled={!config.enabled}
                        onChange={event => handleDayChange(day, 'start', event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="min-w-0 space-y-1 text-xs font-semibold text-[#64748B]">
                      <span>End</span>
                      <input
                        aria-label={`${day} end time`}
                        type="time"
                        value={config.end}
                        disabled={!config.enabled}
                        onChange={event => handleDayChange(day, 'end', event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          id="capacity"
          title="Capacity Settings"
          description={`Current limit: ${maxCapacityPerSlot || '—'} appointments per time slot.`}
          icon={Clock}
          expanded={expandedSections.capacity}
          onToggle={() => toggleSection('capacity')}
        >
          <div className="max-w-sm space-y-2">
            <label htmlFor="max-capacity" className="block text-sm font-semibold text-[#0F172A]">
              Maximum appointments per time slot
            </label>
            <input
              id="max-capacity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={maxCapacityPerSlot}
              onChange={event => {
                setMaxCapacityPerSlot(event.target.value);
                const value = Number(event.target.value);
                setCapacityError(!Number.isInteger(value) || value < 1 ? 'Enter a positive whole number.' : '');
              }}
              aria-invalid={Boolean(capacityError)}
              aria-describedby={capacityError ? 'capacity-error' : 'capacity-help'}
              className={compactFieldClass}
            />
            {capacityError ? (
              <p id="capacity-error" className="text-sm text-red-700">{capacityError}</p>
            ) : (
              <p id="capacity-help" className="text-xs leading-5 text-[#64748B]">
                Number of residents allowed to book the same appointment time.
              </p>
            )}
          </div>
        </Section>

        <Section
          id="announcements"
          title="Announcements"
          description={`${announcements.length} saved ${announcements.length === 1 ? 'announcement' : 'announcements'}.`}
          icon={Megaphone}
          expanded={expandedSections.announcements}
          onToggle={() => toggleSection('announcements')}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-5 text-[#64748B]">Public notices and community advisories.</p>
            <button
              type="button"
              onClick={() => openAnnouncement()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> New Announcement
            </button>
          </div>
          {announcementFeedback && (
            <p
              role={announcementFeedback.type === 'error' ? 'alert' : 'status'}
              className={cn(
                'mb-3 rounded-lg border px-3 py-2 text-sm',
                announcementFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              )}
            >
              {announcementFeedback.text}
            </p>
          )}
          {announcementError && <p role="alert" className="mb-2 text-sm text-red-700">{announcementError}</p>}
          {announcements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-blue-200 bg-slate-50 px-3 py-4 text-center">
              <p className="text-sm text-[#64748B]">No announcements yet.</p>
              <button type="button" onClick={() => openAnnouncement()} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">
                Create your first announcement
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {announcements.map(announcement => {
                const publishedDate = announcement.createdAt
                  ? new Date(announcement.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Date unavailable';
                return (
                  <li key={announcement.id} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">{announcement.title || 'Untitled announcement'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B]">
                        <span className={cn(
                          'rounded-full border px-2 py-0.5 font-semibold',
                          announcement.status === 'Published'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : announcement.status === 'Draft'
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-slate-100 text-slate-700'
                        )}>{announcement.status || 'Published'}</span>
                        <span>{announcement.category || 'General'}</span>
                        <span>{publishedDate}</span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button type="button" onClick={() => openAnnouncement(announcement)} aria-label={`Edit ${announcement.title}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void deleteAnnouncement(announcement.id)} aria-label={`Delete ${announcement.title}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setIsAnnouncementModalOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="announcement-title" className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3">
              <h3 id="announcement-title" className="text-base font-bold text-[#0F172A]">{currentAnnouncement.id ? 'Edit Announcement' : 'New Announcement'}</h3>
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} aria-label="Close announcement form" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              <label className="block space-y-1 text-sm font-semibold text-[#0F172A]">
                <span>Title</span>
                <input autoFocus value={currentAnnouncement.title} onChange={event => setCurrentAnnouncement(current => ({ ...current, title: event.target.value }))} className={compactFieldClass} />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-semibold text-[#0F172A]">
                  <span>Category</span>
                  <input value={currentAnnouncement.category} onChange={event => setCurrentAnnouncement(current => ({ ...current, category: event.target.value }))} className={compactFieldClass} />
                </label>
                <label className="block space-y-1 text-sm font-semibold text-[#0F172A]">
                  <span>Publication status</span>
                  <select value={currentAnnouncement.status} onChange={event => setCurrentAnnouncement(current => ({ ...current, status: event.target.value }))} className={compactFieldClass}>
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Archived">Archived</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm font-semibold text-[#0F172A]">
                <span>Content</span>
                <textarea value={currentAnnouncement.content} onChange={event => setCurrentAnnouncement(current => ({ ...current, content: event.target.value }))} className="min-h-28 w-full resize-y rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-base font-medium text-[#0F172A] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              {announcementError && <p role="alert" className="text-sm text-red-700">{announcementError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-blue-100 bg-slate-50 px-4 py-3">
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
              <button type="button" onClick={() => void saveAnnouncement()} disabled={announcementSaving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {announcementSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {announcementSaving ? 'Saving…' : 'Save Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
