import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateServiceProcessingPerformance,
  formatProcessingDuration,
  getPaperUsageAnalytics,
  getSheetsUsedForPrint,
  getPhilippinesYearMonth,
  getReportingPeriodBounds,
  type PaperUsageRecord
} from './reportAnalytics';

test('reporting periods use Manila midnight boundaries', () => {
  assert.deepEqual(getReportingPeriodBounds(2026, 1), {
    from: '2025-12-31T16:00:00.000Z',
    to: '2026-01-31T16:00:00.000Z'
  });
  assert.deepEqual(getReportingPeriodBounds(2026), {
    from: '2025-12-31T16:00:00.000Z',
    to: '2026-12-31T16:00:00.000Z'
  });
  assert.deepEqual(getPhilippinesYearMonth('2025-12-31T16:00:00.000Z'), { year: 2026, month: 1 });
});

test('processing metrics count only final outcomes and use available completion timestamps', () => {
  const result = calculateServiceProcessingPerformance([
    { status: 'completed', createdAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-02T00:00:00Z' },
    { status: 'completed', createdAt: '2026-01-01T00:00:00Z' },
    { status: 'disapproved', createdAt: '2026-01-01T00:00:00Z' },
    { status: 'approved' },
    { status: 'pending' }
  ]);
  assert.deepEqual(result, {
    totalProcessed: 3,
    completed: 2,
    completionRate: (2 / 3) * 100,
    averageProcessingMs: 24 * 60 * 60 * 1000,
    pending: 1,
    approved: 1,
    disapproved: 1
  });
  assert.equal(formatProcessingDuration(30 * 60 * 60 * 1000), '1.3 days');
  assert.equal(formatProcessingDuration(null), 'Not available');
  assert.equal(calculateServiceProcessingPerformance([{ status: 'pending' }]).completionRate, 0);
});

test('paper usage analytics aggregate documents, sheets, services, and Manila months', () => {
  const records: PaperUsageRecord[] = [
    {
      id: '1', requestId: null, residentId: null, residentName: 'Resident A', serviceType: 'Barangay Clearance',
      documentType: 'Barangay Clearance', pagesPrinted: 2, sheetsUsed: 2, printedAt: '2026-01-01T00:00:00Z', adminUserId: 'admin-1', adminName: 'Admin'
    },
    {
      id: '2', requestId: null, residentId: null, residentName: 'Resident B', serviceType: 'Barangay Clearance',
      documentType: 'Barangay Clearance', pagesPrinted: 2, sheetsUsed: 1, printedAt: '2025-12-31T16:00:00Z', adminUserId: 'admin-1', adminName: 'Admin'
    }
  ];
  const result = getPaperUsageAnalytics(records);
  assert.equal(result.totalDocuments, 2);
  assert.equal(result.totalSheets, 3);
  assert.deepEqual(result.byService, [{ service: 'Barangay Clearance', documents: 2, pages: 4, sheets: 3 }]);
  assert.deepEqual(result.monthly[0], { month: 'Jan', documents: 2, pages: 4, sheets: 3 });
});

test('paper sheets reflect single-sided and duplex page counts', () => {
  assert.equal(getSheetsUsedForPrint(1, false), 1);
  assert.equal(getSheetsUsedForPrint(2, false), 2);
  assert.equal(getSheetsUsedForPrint(2, true), 1);
  assert.equal(getSheetsUsedForPrint(3, true), 2);
  assert.throws(() => getSheetsUsedForPrint(0, false), /between 1 and 100/);
});
