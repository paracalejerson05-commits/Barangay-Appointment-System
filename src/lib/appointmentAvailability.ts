export interface AppointmentSchedule {
  weekly?: Record<string, { enabled?: boolean; start?: string; end?: string }>;
  specialDates?: Array<{ date: string; closed?: boolean; start?: string; end?: string }>;
  slotDuration?: number;
  maxCapacityPerSlot?: number;
}

export interface AppointmentBooking {
  appointmentDate?: string;
  appointmentTime?: string;
  status?: string;
}

export interface AvailableAppointmentSlot {
  time: string;
  display: string;
  count: number;
  isFull: boolean;
}

const ACTIVE_STATUSES = new Set(['pending', 'approved']);
const SLOT_INTERVAL_MINUTES = 5;
const DEFAULT_RECOMMENDATION_INTERVAL_MINUTES = 30;
const APPOINTMENT_TIME_ZONE = 'Asia/Manila';

export function getAppointmentDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function normalizeTime(value: unknown): string {
  return String(value || '').slice(0, 5);
}

function dateAtLocalMidnight(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function localDateKey(date: Date): string {
  return getAppointmentDateKey(date);
}

function localMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function getDateSchedule(schedule: AppointmentSchedule, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_TIME_ZONE,
    weekday: 'long'
  }).format(dateAtLocalMidnight(date));
  const weekly = schedule.weekly?.[dayName];
  const specialDate = schedule.specialDates?.find(item => item.date === date);

  if (specialDate?.closed || (!specialDate && weekly?.enabled === false) || !weekly && !specialDate) {
    return null;
  }

  const source = specialDate && !specialDate.closed ? specialDate : weekly;
  const start = normalizeTime(source?.start);
  const end = normalizeTime(source?.end);
  if (!start || !end || start >= end) return null;

  return { start, end };
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function formatDisplay(time: string): string {
  const date = new Date(`2000-01-01T${time}:00`);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getAvailableAppointmentSlots(
  schedule: AppointmentSchedule,
  date: string,
  bookings: AppointmentBooking[],
  now = new Date()
): AvailableAppointmentSlot[] {
  const dateSchedule = getDateSchedule(schedule, date);
  if (!dateSchedule) return [];

  const today = localDateKey(now);
  const minimumMinutes = date === today ? localMinutes(now) + 1 : -1;
  const start = toMinutes(dateSchedule.start);
  const end = toMinutes(dateSchedule.end);
  const capacity = Math.max(1, Number(schedule.maxCapacityPerSlot) || 1);
  const activeBookings = bookings.filter(booking =>
    booking.appointmentDate === date && ACTIVE_STATUSES.has(String(booking.status || '').toLowerCase())
  );

  const slots: AvailableAppointmentSlot[] = [];
  for (let current = start; current < end; current += SLOT_INTERVAL_MINUTES) {
    if (current < minimumMinutes) continue;
    const time = toTime(current);
    const count = activeBookings.filter(booking => normalizeTime(booking.appointmentTime) === time).length;
    slots.push({ time, display: formatDisplay(time), count, isFull: count >= capacity });
  }
  return slots;
}

export function isAppointmentSlotAvailable(
  schedule: AppointmentSchedule,
  date: string,
  time: string,
  bookings: AppointmentBooking[],
  now = new Date()
): boolean {
  return getAvailableAppointmentSlots(schedule, date, bookings, now)
    .some(slot => slot.time === normalizeTime(time) && !slot.isFull);
}

export function getNextAvailableAppointment(
  schedule: AppointmentSchedule,
  requestedDate: string,
  bookings: AppointmentBooking[],
  now = new Date(),
  maxDays = 366
): AvailableAppointmentSlot & { date: string } | null {
  const requested = dateAtLocalMidnight(requestedDate);
  const configuredInterval = Number(schedule.slotDuration);
  const recommendationInterval = Number.isFinite(configuredInterval) && configuredInterval >= SLOT_INTERVAL_MINUTES
    ? Math.round(configuredInterval / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES
    : DEFAULT_RECOMMENDATION_INTERVAL_MINUTES;

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const candidate = new Date(requested);
    candidate.setDate(requested.getDate() + offset);
    const date = localDateKey(candidate);
    const dateSchedule = getDateSchedule(schedule, date);
    if (!dateSchedule) continue;

    const availableSlots = getAvailableAppointmentSlots(schedule, date, bookings, now);
    const activeBookings = bookings.filter(booking =>
      booking.appointmentDate === date && ACTIVE_STATUSES.has(String(booking.status || '').toLowerCase())
    );
    const start = toMinutes(dateSchedule.start);
    const end = toMinutes(dateSchedule.end);

    for (let intervalStart = start; intervalStart < end; intervalStart += recommendationInterval) {
      const time = toTime(intervalStart);
      const slot = availableSlots.find(available => available.time === time);
      if (!slot || slot.isFull) continue;

      const intervalEnd = Math.min(intervalStart + recommendationInterval, end);
      const count = activeBookings.filter(booking => {
        const bookingTime = normalizeTime(booking.appointmentTime);
        if (!/^\d{2}:\d{2}$/.test(bookingTime)) return false;
        const minutes = toMinutes(bookingTime);
        return minutes >= intervalStart && minutes < intervalEnd;
      }).length;
      if (count === 0) return { ...slot, date, count };
    }
  }
  return null;
}

export function isAppointmentTimeInSchedule(schedule: AppointmentSchedule, date: string, time: string): boolean {
  return getAvailableAppointmentSlots(schedule, date, [], new Date('2999-01-01T00:00:00')).some(slot => slot.time === normalizeTime(time));
}

export function isAppointmentDateAvailable(schedule: AppointmentSchedule, date: string): boolean {
  return Boolean(getDateSchedule(schedule, date));
}
