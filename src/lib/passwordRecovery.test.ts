import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRecoverySecondsRemaining,
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_OTP_EXPIRY_MS,
  RECOVERY_OTP_LENGTH,
  RECOVERY_RESEND_COOLDOWN_MS,
  sanitizeRecoveryOtp
} from './passwordRecovery';

test('recovery OTP policy uses six digits, five minutes, resend delay, and bounded attempts', () => {
  assert.equal(RECOVERY_OTP_LENGTH, 6);
  assert.equal(RECOVERY_OTP_EXPIRY_MS, 300_000);
  assert.equal(RECOVERY_RESEND_COOLDOWN_MS, 60_000);
  assert.equal(RECOVERY_MAX_ATTEMPTS, 5);
});

test('OTP input is numeric and limited to six digits', () => {
  assert.equal(sanitizeRecoveryOtp('12a-345 678'), '123456');
  assert.equal(sanitizeRecoveryOtp('abc'), '');
});

test('recovery countdown rounds up and never goes below zero', () => {
  assert.equal(getRecoverySecondsRemaining(10_001, 10_000), 1);
  assert.equal(getRecoverySecondsRemaining(10_999, 10_000), 1);
  assert.equal(getRecoverySecondsRemaining(9_999, 10_000), 0);
  assert.equal(getRecoverySecondsRemaining(null, 10_000), 0);
});
