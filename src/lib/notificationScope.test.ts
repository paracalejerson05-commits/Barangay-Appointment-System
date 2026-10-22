import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationTargetUserIds } from './notificationScope';

test('resident notifications are scoped to the resident only', () => {
  assert.deepEqual(getNotificationTargetUserIds('resident-123', false), ['resident-123']);
});

test('admin notifications are scoped to the admin inbox only', () => {
  assert.deepEqual(getNotificationTargetUserIds('admin', true), ['admin']);
});
