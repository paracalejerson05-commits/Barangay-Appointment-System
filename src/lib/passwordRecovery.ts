export const RECOVERY_OTP_LENGTH = 6;
export const RECOVERY_OTP_EXPIRY_MS = 5 * 60 * 1000;
export const RECOVERY_RESEND_COOLDOWN_MS = 60 * 1000;
export const RECOVERY_MAX_ATTEMPTS = 5;

export function sanitizeRecoveryOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, RECOVERY_OTP_LENGTH);
}

export function getRecoverySecondsRemaining(until: number | null, now = Date.now()): number {
  if (until === null) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}
