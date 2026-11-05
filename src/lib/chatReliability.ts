export type ChatConnectionStatus = 'connected' | 'connecting' | 'temporarily_unavailable' | 'offline';

export interface ChatServiceInfo {
  title: string;
  description?: string | null;
  processing_time?: string | null;
}

export interface ChatRequestInfo {
  service_type: string;
  status: string;
}

export interface ChatFallbackContext {
  schedule?: unknown;
  services: ChatServiceInfo[] | null;
  requests: ChatRequestInfo[] | null;
}

const OFFLINE_SERVICE_LABELS = [
  'Barangay Clearance',
  'Certificate of Indigency',
  'Certificate of Residency',
  'Blotter / Incident Report',
  'BADAC Clearance'
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MAX_RETRY_WAIT_MS = 5_000;

function getErrorStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0;
  const value = error as { status?: unknown; statusCode?: unknown };
  return Number(value.status ?? value.statusCode) || 0;
}

export function getGeminiRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as {
    retryAfter?: unknown;
    retryAfterMs?: unknown;
    retryDelay?: unknown;
    headers?: { get?: (name: string) => string | null };
    response?: { headers?: { get?: (name: string) => string | null } };
    details?: Array<{ retryDelay?: unknown }>;
    error?: { details?: Array<{ retryDelay?: unknown }> };
  };
  const retryInfo = value.details?.find(detail => detail?.retryDelay !== undefined)
    ?? value.error?.details?.find(detail => detail?.retryDelay !== undefined);
  const retryAfterHeader = value.headers?.get?.('retry-after')
    ?? value.response?.headers?.get?.('retry-after');
  if (typeof value.retryAfterMs === 'number' && Number.isFinite(value.retryAfterMs)) {
    return value.retryAfterMs;
  }
  const instruction = retryAfterHeader ?? value.retryAfter ?? value.retryDelay ?? retryInfo?.retryDelay;
  if (typeof instruction === 'number' && Number.isFinite(instruction)) return instruction * 1000;
  if (typeof instruction !== 'string') return null;

  const seconds = instruction.trim().match(/^(\d+(?:\.\d+)?)\s*s?$/i);
  if (seconds) return Number(seconds[1]) * 1000;
  const duration = instruction.trim().match(/^(\d+(?:\.\d+)?)ms$/i);
  if (duration) return Number(duration[1]);
  const date = Date.parse(instruction);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export function isRetryableGeminiError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  if (status) return false;
  if (!error || typeof error !== 'object') return false;

  const value = error as { name?: unknown; message?: unknown; cause?: unknown };
  const name = typeof value.name === 'string' ? value.name : '';
  const message = typeof value.message === 'string' ? value.message : '';
  return ['AbortError', 'TimeoutError', 'FetchError', 'NetworkError'].includes(name)
    || error instanceof TypeError
    || /timed?\s*out|network|fetch failed|socket/i.test(message)
    || (value.cause !== error && isRetryableGeminiError(value.cause));
}

export function getGeminiRetryDelay(error: unknown, retryNumber: number): number | null {
  const retryAfterMs = getGeminiRetryAfterMs(error);
  if (retryAfterMs !== null) {
    return retryAfterMs <= MAX_RETRY_WAIT_MS ? retryAfterMs : null;
  }
  return Math.min(400 * (2 ** Math.max(0, retryNumber - 1)), 1_600);
}

export function getGeminiConnectionStatus(
  keyConfigured: boolean,
  lastStatus: 'connected' | 'temporarily_unavailable' | null,
  checkedAt: number | null,
  now = Date.now(),
  freshnessMs = 120_000
): ChatConnectionStatus {
  if (!keyConfigured) return 'temporarily_unavailable';
  if (checkedAt === null || now - checkedAt > freshnessMs) return 'connecting';
  return lastStatus ?? 'connecting';
}

function weeklyOfficeHours(schedule: unknown): string | null {
  if (!schedule || typeof schedule !== 'object') return null;
  const weekly = (schedule as { weekly?: Record<string, { enabled?: boolean; start?: string; end?: string }> }).weekly;
  if (!weekly) return null;

  const hours = WEEKDAYS.flatMap(day => {
    const entry = weekly[day];
    if (!entry || entry.enabled === false || !entry.start || !entry.end) return [];
    return [`${day}: ${entry.start}-${entry.end}`];
  });
  return hours.length ? hours.join('; ') : null;
}

function serviceNameMatches(message: string, title: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  if (normalizedMessage.includes(normalizedTitle)) return true;
  if (normalizedTitle.includes('indigency') && normalizedMessage.includes('indigency')) return true;
  if (normalizedTitle.includes('residency') && normalizedMessage.includes('residency')) return true;
  if (normalizedTitle.includes('blotter') && normalizedMessage.includes('blotter')) return true;
  if (normalizedTitle.includes('badac') && normalizedMessage.includes('badac')) return true;
  return normalizedTitle.includes('clearance') && normalizedMessage.includes('clearance');
}

function statusExplanation(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending': return 'Pending means the request is awaiting administrator review.';
    case 'approved': return 'Approved means the request has been approved. Check My Requests for any administrator remarks or next steps.';
    case 'disapproved': return 'Disapproved means the request was not approved. Check My Requests for the administrator remarks.';
    case 'completed': return 'Completed means the request has been marked complete.';
    default: return 'For the latest status and any administrator remarks, open My Requests.';
  }
}

function getMentionedStatus(query: string): string | undefined {
  return ['pending', 'approved', 'disapproved', 'completed']
    .find(status => query.includes(status));
}

export function buildFallbackReply(message: string, context: ChatFallbackContext): string {
  const query = message.toLowerCase();

  if (/office hours|opening hours|when (?:is|are).*open|what time.*open/.test(query)) {
    const hours = weeklyOfficeHours(context.schedule);
    return hours
      ? `The current appointment schedule lists these office hours: ${hours}. Check the appointment calendar for special-date changes.`
      : 'I cannot verify the current office hours from the available system information. Please check the appointment calendar or contact the barangay office.';
  }

  if (/requirement|what (?:do i|should i) bring|documents? (?:do i|should i)/.test(query)) {
    return 'The service information available to this assistant does not list official document requirements. Open the selected service form for its current fields, or confirm required documents with the barangay office. I do not want to guess.';
  }

  const mentionedStatus = getMentionedStatus(query);
  if (/my .*request|my application|my status|track|request status|status check|check .*status|progress/.test(query)) {
    if (context.requests === null) {
      return 'I cannot retrieve your request status right now. When the service is available, open My Requests to see your requests and administrator remarks.';
    }
    if (!context.requests.length) {
      return 'I could not find a service request associated with your account. Open My Requests to check again.';
    }
    const ownRequests = context.requests.slice(0, 5).map(request => (
      `- ${request.service_type}: ${statusExplanation(request.status)}`
    ));
    return `Here are the latest requests associated with your account:\n${ownRequests.join('\n')}\nOpen My Requests for full details and administrator remarks.`;
  }

  if (mentionedStatus && /what|mean|explain|status/.test(query)) {
    return statusExplanation(mentionedStatus);
  }

  if (/appointment|book|schedule|slot/.test(query)) {
    return 'To request an appointment, open Services, choose a service, complete its form, then select an available date and time before submitting. The request will appear under My Requests; check there for its current status. Availability is not confirmed while the assistant is using offline information.';
  }

  if (/service|clearance|indigency|residency|blotter|badac/.test(query)) {
    if (context.services === null) {
      return `The system's service categories include ${OFFLINE_SERVICE_LABELS.join(', ')}. I cannot verify which services are currently active while offline; check Services when the application reconnects.`;
    }
    const matchingService = context.services.find(service => serviceNameMatches(query, service.title));
    if (matchingService) {
      const description = matchingService.description?.trim();
      const processingTime = matchingService.processing_time?.trim();
      return [
        `${matchingService.title}${description ? `: ${description}` : '.'}`,
        processingTime ? `The service information lists a processing time of ${processingTime}.` : '',
        'Exact document requirements are not listed in the information available to this assistant; confirm them in the service form or with the barangay office.'
      ].filter(Boolean).join('\n');
    }
    if (!context.services.length) {
      return 'I cannot verify the currently active services from the available system information. Open Services to see the current list.';
    }
    return `Active services listed in the system: ${context.services.map(service => service.title).join(', ')}. Open Services for details and to start a request.`;
  }

  return 'I can help with the service catalog, office hours, appointment steps, and request status. Use Services to start a request and My Requests to track your own submissions. For information not shown in the system, please check with the barangay office.';
}

export function buildOfflineFallbackReply(message: string): string {
  const query = message.toLowerCase();
  if (/office hours|opening hours|when (?:is|are).*open|what time.*open/.test(query)) {
    return 'I cannot verify current office hours while the application server is unreachable. Please check the appointment calendar or contact the barangay office when you reconnect.';
  }
  if (/requirement|what (?:do i|should i) bring|documents? (?:do i|should i)/.test(query)) {
    return 'I cannot verify official document requirements while offline. Please check the selected service form or confirm with the barangay office when you reconnect.';
  }
  if (/my .*request|my application|my status|track|request status|status check|check .*status|progress/.test(query)) {
    return 'I cannot access your private request status while offline. When the server is reachable, open My Requests to see your submissions and administrator remarks.';
  }
  const mentionedStatus = getMentionedStatus(query);
  if (mentionedStatus && /what|mean|explain|status/.test(query)) {
    return statusExplanation(mentionedStatus);
  }
  if (/appointment|book|schedule|slot/.test(query)) {
    return 'When the application reconnects, open Services, choose a service, complete its form, select an available date and time, and submit your request. Availability cannot be checked offline.';
  }
  if (/service|clearance|indigency|residency|blotter|badac/.test(query)) {
    return `The system's service categories include ${OFFLINE_SERVICE_LABELS.join(', ')}. I cannot confirm current availability or service details while offline.`;
  }
  return 'I can provide basic navigation help while offline: use Services to start a request and My Requests to track your own submissions after reconnecting. I cannot verify live schedules, service requirements, or request records right now.';
}
