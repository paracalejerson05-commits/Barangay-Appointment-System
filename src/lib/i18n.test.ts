import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocale, translate } from './i18n';

test('translates portal labels and falls back to English for untranslated content', () => {
  assert.equal(translate('fil', 'My Requests'), 'Aking mga Kahilingan');
  assert.equal(translate('fil', 'Barangay Clearance'), 'Barangay Clearance');
  assert.equal(translate('en', 'My Requests'), 'My Requests');
});

test('uses Philippines locales for dates and formatting', () => {
  assert.equal(getLocale('en'), 'en-PH');
  assert.equal(getLocale('fil'), 'fil-PH');
});
