import assert from 'node:assert/strict';
import test from 'node:test';
import { isPunongBarangaySignatory } from './PunongBarangaySignature';

test('matches Elpidio Dioctons with or without the printed middle initial', () => {
  assert.equal(isPunongBarangaySignatory('ELPIDIO DIOCTON'), true);
  assert.equal(isPunongBarangaySignatory('HON. ELPIDIO D. DIOCTON'), true);
});

test('does not match other signatories or unrelated names', () => {
  assert.equal(isPunongBarangaySignatory('HON. MARIEVELOU P. DIOCTON'), false);
  assert.equal(isPunongBarangaySignatory('ELPIDIO X. DIOCTON'), false);
});
