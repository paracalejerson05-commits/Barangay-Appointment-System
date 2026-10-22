import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPasswordRequirementError,
  getResidentAge,
  isPhilippineMobileNumber,
  MAX_RESIDENT_IMAGE_BYTES,
  validateResidentImage
} from './residentRegistrationValidation';

test('calculates age based on whether the birthday has passed this year', () => {
  const today = new Date();
  const birthdayPassed = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate() - 1);
  const birthdayUpcoming = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate() + 1);
  const asDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  assert.equal(getResidentAge(asDateInput(birthdayPassed)), 20);
  assert.equal(getResidentAge(asDateInput(birthdayUpcoming)), 19);
  assert.equal(getResidentAge(''), null);
});

test('accepts only 11-digit Philippine mobile numbers beginning with 09', () => {
  assert.equal(isPhilippineMobileNumber('09171234567'), true);
  assert.equal(isPhilippineMobileNumber('0917123456'), false);
  assert.equal(isPhilippineMobileNumber('091712345678'), false);
  assert.equal(isPhilippineMobileNumber('+639171234567'), false);
});

test('enforces password length and character requirements', () => {
  assert.equal(getPasswordRequirementError('Password1'), null);
  assert.notEqual(getPasswordRequirementError('password1'), null);
  assert.notEqual(getPasswordRequirementError('PASSWORD1'), null);
  assert.notEqual(getPasswordRequirementError('Password'), null);
});

test('validates image format signatures and the 5 MB size limit', async () => {
  const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'id.jpg', { type: 'image/jpeg' });
  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'id.png', { type: 'image/png' });
  const webp = new File([
    new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  ], 'face.webp', { type: 'image/webp' });
  const spoofed = new File(['not an image'], 'spoof.jpg', { type: 'image/jpeg' });
  const oversized = new File([new Uint8Array(MAX_RESIDENT_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' });

  await assert.doesNotReject(validateResidentImage(jpeg));
  await assert.doesNotReject(validateResidentImage(png));
  await assert.doesNotReject(validateResidentImage(webp));
  await assert.rejects(validateResidentImage(spoofed), /not a readable/);
  await assert.rejects(validateResidentImage(oversized), /5 MB or smaller/);
});
