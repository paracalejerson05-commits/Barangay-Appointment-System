export const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REPORT_TIME_ZONE = 'Asia/Manila';

export interface PaperUsageRecord {
  id: string;
  requestId: string | null;
  residentId: string | null;
  residentName: string;
  serviceType: string;
  documentType: string;
  pagesPrinted: number;
  sheetsUsed: number;
  printedAt: string;
  adminUserId: string | null;
  adminName: string;
}

export function getPhilippinesYearMonth(value: unknown): { year: number; month: number } | null {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  return Number.isInteger(year) && Number.isInteger(month) ? { year, month } : null;
}

export function getReportingPeriodBounds(year: number, month?: number): { from: string; to: string } {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error('Reporting year is invalid.');
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error('Reporting month is invalid.');
  }

  const startMonth = month ?? 1;
  const endYear = month === undefined || month === 12 ? year + 1 : year;
  const endMonth = month === undefined ? 1 : month === 12 ? 1 : month + 1;
  const localMidnightAsUtc = (targetYear: number, targetMonth: number) =>
    new Date(Date.UTC(targetYear, targetMonth - 1, 1) - 8 * 60 * 60 * 1000).toISOString();

  return {
    from: localMidnightAsUtc(year, startMonth),
    to: localMidnightAsUtc(endYear, endMonth)
  };
}

export function calculateServiceProcessingPerformance(requests: any[]) {
  const normalizedStatus = (request: any) => String(request.status ?? '').trim().toLowerCase();
  const completed = requests.filter(request => normalizedStatus(request) === 'completed');
  const pending = requests.filter(request => normalizedStatus(request) === 'pending').length;
  const approved = requests.filter(request => normalizedStatus(request) === 'approved').length;
  const disapproved = requests.filter(request => normalizedStatus(request) === 'disapproved').length;
  const processed = completed.length + disapproved;
  const processingDurations = completed
    .map(request => {
      const submittedAt = new Date(request.createdAt ?? '').getTime();
      const completedAt = new Date(request.completedAt ?? '').getTime();
      return Number.isFinite(submittedAt) && Number.isFinite(completedAt) && completedAt >= submittedAt
        ? completedAt - submittedAt
        : null;
    })
    .filter((duration): duration is number => duration !== null);
  const averageProcessingMs = processingDurations.length
    ? processingDurations.reduce((total, duration) => total + duration, 0) / processingDurations.length
    : null;

  return {
    totalProcessed: processed,
    completed: completed.length,
    completionRate: processed ? (completed.length / processed) * 100 : 0,
    averageProcessingMs,
    pending,
    approved,
    disapproved
  };
}

export function formatProcessingDuration(durationMs: number | null): string {
  if (durationMs === null) return 'Not available';
  const hours = durationMs / (60 * 60 * 1000);
  return hours >= 24
    ? `${(hours / 24).toFixed(1)} days`
    : `${hours.toFixed(1)} hours`;
}

export function getSheetsUsedForPrint(pagesPrinted: number, duplex: boolean): number {
  if (!Number.isInteger(pagesPrinted) || pagesPrinted < 1 || pagesPrinted > 100) {
    throw new Error('Printed page count must be between 1 and 100.');
  }
  return duplex ? Math.ceil(pagesPrinted / 2) : pagesPrinted;
}

export function getPaperUsageAnalytics(records: PaperUsageRecord[]) {
  const monthly = REPORT_MONTHS.map((month, index) => {
    const monthRecords = records.filter(record => getPhilippinesYearMonth(record.printedAt)?.month === index + 1);
    return {
      month,
      documents: monthRecords.length,
      pages: monthRecords.reduce((total, record) => total + record.pagesPrinted, 0),
      sheets: monthRecords.reduce((total, record) => total + record.sheetsUsed, 0)
    };
  });
  const serviceGroups = new Map<string, { service: string; documents: number; pages: number; sheets: number }>();
  records.forEach(record => {
    const service = record.serviceType || 'Other';
    const group = serviceGroups.get(service) || { service, documents: 0, pages: 0, sheets: 0 };
    group.documents += 1;
    group.pages += record.pagesPrinted;
    group.sheets += record.sheetsUsed;
    serviceGroups.set(service, group);
  });

  return {
    totalDocuments: records.length,
    totalSheets: records.reduce((total, record) => total + record.sheetsUsed, 0),
    byService: Array.from(serviceGroups.values()).sort((a, b) => b.sheets - a.sheets || a.service.localeCompare(b.service)),
    monthly
  };
}
