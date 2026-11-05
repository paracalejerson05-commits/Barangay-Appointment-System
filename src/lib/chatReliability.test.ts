import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackReply,
  buildOfflineFallbackReply,
  getGeminiConnectionStatus,
  getGeminiRetryDelay,
  isRetryableGeminiError
} from './chatReliability';

const context = {
  schedule: {
    weekly: {
      Monday: { enabled: true, start: '08:00', end: '17:00' },
      Tuesday: { enabled: true, start: '08:00', end: '17:00' },
      Saturday: { enabled: false, start: '08:00', end: '12:00' }
    }
  },
  services: [{
    title: 'Barangay Clearance',
    description: 'For employment, ID application, and official requirements.',
    processing_time: '1-2 Working Days'
  }],
  requests: [{ service_type: 'Barangay Clearance', status: 'pending' }]
};

test('connection state reflects configured, recent success, failure, and recovery', () => {
  assert.equal(getGeminiConnectionStatus(false, null, null), 'temporarily_unavailable');
  assert.equal(getGeminiConnectionStatus(true, null, null, 10_000), 'connecting');
  assert.equal(getGeminiConnectionStatus(true, 'connected', 9_000, 10_000), 'connected');
  assert.equal(getGeminiConnectionStatus(true, 'temporarily_unavailable', 9_000, 10_000), 'temporarily_unavailable');
  assert.equal(getGeminiConnectionStatus(true, 'temporarily_unavailable', 1, 200_000), 'connecting');
  assert.equal(getGeminiConnectionStatus(true, 'connected', 199_000, 200_000), 'connected');
});

test('only temporary provider and network errors are retried', () => {
  assert.equal(isRetryableGeminiError({ status: 429 }), true);
  assert.equal(isRetryableGeminiError({ status: 503 }), true);
  assert.equal(isRetryableGeminiError(new TypeError('fetch failed')), true);
  assert.equal(isRetryableGeminiError({ name: 'TimeoutError', message: 'request timed out' }), true);
  assert.equal(isRetryableGeminiError({ status: 400 }), false);
  assert.equal(isRetryableGeminiError({ status: 401 }), false);
  assert.equal(isRetryableGeminiError({ status: 403 }), false);
  assert.equal(isRetryableGeminiError({ status: 404 }), false);
});

test('retry delay backs off and respects provider retry instructions', () => {
  assert.equal(getGeminiRetryDelay({ status: 503 }, 1), 400);
  assert.equal(getGeminiRetryDelay({ status: 503 }, 2), 800);
  assert.equal(getGeminiRetryDelay({ status: 429, retryAfter: '2' }, 1), 2_000);
  assert.equal(getGeminiRetryDelay({ status: 429, details: [{ retryDelay: '1.5s' }] }, 1), 1_500);
  assert.equal(getGeminiRetryDelay({ status: 429, retryAfter: '30' }, 1), null);
});

test('fallback answers office hours from the supplied schedule and avoids invented requirements', () => {
  assert.match(buildFallbackReply('What are the office hours?', context), /Monday: 08:00-17:00/);
  assert.match(buildFallbackReply('What are the office hours?', { ...context, schedule: null }), /cannot verify the current office hours/);
  assert.match(buildFallbackReply('What documents do I need for clearance?', context), /does not list official document requirements/);
  assert.match(buildFallbackReply('Tell me about Barangay Clearance', context), /For employment, ID application/);
});

test('fallback reports only supplied account request records', () => {
  const reply = buildFallbackReply('Check my request status', context);
  assert.match(reply, /Barangay Clearance: Pending means the request is awaiting administrator review/);
  assert.doesNotMatch(reply, /appointment_date|resident_id|email/i);
  assert.match(buildFallbackReply('Check my request status', { ...context, requests: null }), /cannot retrieve your request status/);
  assert.match(buildFallbackReply('What does pending mean?', context), /awaiting administrator review/);
  assert.match(buildFallbackReply('What is my pending request status?', context), /latest requests associated with your account/);
});

test('server-offline fallback discloses missing live and private information', () => {
  assert.match(buildOfflineFallbackReply('What are the office hours?'), /cannot verify current office hours/);
  assert.match(buildOfflineFallbackReply('Check my request status'), /cannot access your private request status/);
  assert.match(buildOfflineFallbackReply('What does pending mean?'), /awaiting administrator review/);
  assert.match(buildOfflineFallbackReply('How do I book an appointment?'), /cannot be checked offline/);
});
