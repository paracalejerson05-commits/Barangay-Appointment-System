import test from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRequestTrend } from './serviceRequestTrend';

test('this week shows Sunday through today with actual status counts', () => {
  const requests = [
    { createdAt: new Date(2026, 10, 15, 9), status: 'pending' },
    { createdAt: new Date(2026, 10, 15, 10), status: 'approved' },
    { createdAt: new Date(2026, 10, 21, 12), status: 'completed' },
    { createdAt: new Date(2026, 10, 14, 12), status: 'disapproved' }
  ];

  const trend = getServiceRequestTrend(requests, 'week', new Date(2026, 10, 21, 16));
  assert.equal(trend.data.length, 7);
  assert.equal(trend.data[0].name, 'Nov 15');
  assert.equal(trend.data[0].Total, 2);
  assert.equal(trend.data[0].Pending, 1);
  assert.equal(trend.data[0].Approved, 1);
  assert.equal(trend.data[6].Completed, 1);
  assert.match(trend.description, /Week to date/);
});

test('this month aggregates from the first of the month through today only', () => {
  const requests = [
    { createdAt: new Date(2026, 9, 31, 23), status: 'completed' },
    { createdAt: new Date(2026, 10, 1, 8), status: 'disapproved' },
    { createdAt: new Date(2026, 10, 21, 9), status: 'pending' },
    { createdAt: new Date(2026, 10, 22, 8), status: 'approved' }
  ];

  const trend = getServiceRequestTrend(requests, 'month', new Date(2026, 10, 21, 16));
  assert.equal(trend.data.length, 21);
  assert.equal(trend.data[0].name, '1');
  assert.equal(trend.data[0].Disapproved, 1);
  assert.equal(trend.data[20].Pending, 1);
  assert.equal(trend.data.reduce((total, day) => total + day.Total, 0), 2);
  assert.match(trend.description, /Month to date/);
});
