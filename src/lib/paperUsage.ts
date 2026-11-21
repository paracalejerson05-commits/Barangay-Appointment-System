import { apiUrl } from './api';
import { supabase } from './supabase';

export interface PaperUsageSubmission {
  requestId: string;
  pagesPrinted: number;
  sheetsUsed: number;
  idempotencyKey: string;
}

export async function recordPaperUsage(submission: PaperUsageSubmission): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your administrator session has expired. Paper usage could not be recorded.');
  }

  const response = await fetch(apiUrl('/api/admin/reports/paper-usage'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(submission)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || `Paper usage could not be recorded (HTTP ${response.status}).`);
  }
}
