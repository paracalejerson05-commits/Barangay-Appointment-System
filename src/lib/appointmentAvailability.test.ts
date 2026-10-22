import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableAppointmentSlots, getNextAvailableAppointment, isAppointmentSlotAvailable } from './appointmentAvailability';

const schedule = {
  weekly: {
    Monday: { enabled: true, start: '08:00', end: '17:00' },
    Tuesday: { enabled: true, start: '08:00', end: '17:00' },
    Wednesday: { enabled: true, start: '08:00', end: '17:00' },
    Friday: { enabled: true, start: '08:00', end: '17:00' },
    Saturday: { enabled: false, start: '08:00', end: '12:00' },
    Sunday: { enabled: false, start: '08:00', end: '12:00' }
  },
  slotDuration: 30,
  maxCapacityPerSlot: 1
};

test('starts at the next clear recommendation interval during office hours', () => {
  const result = getNextAvailableAppointment(schedule, '2026-09-15', [], new Date('2026-09-15T10:23:00'));
  assert.equal(result?.date, '2026-09-15');
  assert.equal(result?.time, '10:30');
});

test('skips recommendation intervals containing active bookings', () => {
  const bookings = [
    { appointmentDate: '2026-09-15', appointmentTime: '10:25:00', status: 'pending' },
    { appointmentDate: '2026-09-15', appointmentTime: '10:30:00', status: 'approved' }
  ];
  const result = getNextAvailableAppointment(schedule, '2026-09-15', bookings, new Date('2026-09-15T10:23:00'));
  assert.equal(result?.time, '11:00');
});

test('moves the recommendation to the next interval when someone books at 8:05', () => {
  const bookings = [
    { appointmentDate: '2026-09-15', appointmentTime: '08:05:00', status: 'pending' }
  ];
  const result = getNextAvailableAppointment(schedule, '2026-09-15', bookings, new Date('2026-09-15T00:00:00'));
  assert.equal(result?.time, '08:30');
});

test('does not treat completed bookings as occupying a recommendation interval', () => {
  const bookings = [
    { appointmentDate: '2026-09-15', appointmentTime: '08:05:00', status: 'completed' }
  ];
  const result = getNextAvailableAppointment(schedule, '2026-09-15', bookings, new Date('2026-09-15T00:00:00'));
  assert.equal(result?.time, '08:00');
});

test('skips closed days after office hours', () => {
  const result = getNextAvailableAppointment(schedule, '2026-09-18', [], new Date('2026-09-18T20:00:00'));
  assert.equal(result?.date, '2026-09-21');
  assert.equal(result?.time, '08:00');
});

test('does not generate the closing time or later', () => {
  const slots = getAvailableAppointmentSlots(schedule, '2026-09-15', [], new Date('2026-09-15T00:00:00'));
  assert.equal(slots.at(-1)?.time, '16:55');
  assert.equal(slots.some(slot => slot.time >= '17:00'), false);
});

test('allows tomorrow morning when it is already evening today', () => {
  const now = new Date('2026-09-14T13:35:00.000Z');
  assert.equal(isAppointmentSlotAvailable(schedule, '2026-09-15', '08:00', [], now), true);
});

test('rejects a passed time today but allows a future time today', () => {
  const now = new Date('2026-09-14T01:35:00.000Z');
  assert.equal(isAppointmentSlotAvailable(schedule, '2026-09-14', '08:00', [], now), false);
  assert.equal(isAppointmentSlotAvailable(schedule, '2026-09-14', '10:00', [], now), true);
});

test('rejects a past appointment date', () => {
  const now = new Date('2026-09-14T13:35:00.000Z');
  assert.equal(isAppointmentSlotAvailable(schedule, '2026-09-13', '08:00', [], now), false);
});

test('a closed special date overrides an enabled weekly office day', () => {
  const scheduleWithClosure = {
    ...schedule,
    specialDates: [{ date: '2026-09-15', closed: true }]
  };

  assert.deepEqual(getAvailableAppointmentSlots(scheduleWithClosure, '2026-09-15', [], new Date('2026-09-14T00:00:00')), []);
  assert.equal(getNextAvailableAppointment(scheduleWithClosure, '2026-09-15', [], new Date('2026-09-14T00:00:00'))?.date, '2026-09-16');
});

test('custom special hours override a normally closed weekly day', () => {
  const scheduleWithCustomHours = {
    ...schedule,
    specialDates: [{ date: '2026-09-20', closed: false, start: '10:00', end: '11:00' }]
  };

  const slots = getAvailableAppointmentSlots(scheduleWithCustomHours, '2026-09-20', [], new Date('2026-09-19T00:00:00'));
  assert.equal(slots[0]?.time, '10:00');
  assert.equal(slots.at(-1)?.time, '10:55');
});

test('keeps a slot available while bookings are below the configured capacity', () => {
  const scheduleWithCapacity = {
    ...schedule,
    maxCapacityPerSlot: 3
  };
  const bookings = [
    { appointmentDate: '2026-09-15', appointmentTime: '10:25:00', status: 'pending' },
    { appointmentDate: '2026-09-15', appointmentTime: '10:25:00', status: 'approved' }
  ];

  assert.equal(isAppointmentSlotAvailable(scheduleWithCapacity, '2026-09-15', '10:25', bookings, new Date('2026-09-15T10:00:00')), true);
  assert.equal(getAvailableAppointmentSlots(scheduleWithCapacity, '2026-09-15', bookings, new Date('2026-09-15T10:00:00')).find(slot => slot.time === '10:25')?.isFull, false);
});
