import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProfileCompletion } from './profileUtils';

function ageFor(dateOfBirth: string) {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function completeResidentProfile() {
  const dateOfBirth = '1990-01-01';
  return {
    display_name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    date_of_birth: dateOfBirth,
    age: ageFor(dateOfBirth),
    gender: 'Male',
    civil_status: 'Single',
    contact_number: '09171234567',
    house_street: '12 Main Street',
    purok_sitio: 'Purok 1',
    barangay: 'Barangay Pupua',
    municipality_city: 'Catbalogan',
    province: 'Samar',
    address: '12 Main Street, Purok 1, Barangay Pupua, Catbalogan, Samar',
    id_type: 'PhilSys National ID',
    id_front_path: 'resident-1/id-front-123.jpg',
    face_photo_path: 'resident-1/face-123.jpg',
    face_registration_method: 'camera',
    privacy_consent_at: new Date().toISOString()
  };
}

test('resident profile is complete with valid personal and manual identity details', () => {
  assert.deepEqual(checkProfileCompletion(completeResidentProfile()), {
    isComplete: true,
    missingFields: []
  });
});

test('in-person face verification is an accessible alternative to a face image', () => {
  const profile = {
    ...completeResidentProfile(),
    face_registration_method: 'in_person',
    face_photo_path: null
  };
  assert.equal(checkProfileCompletion(profile).isComplete, true);
});

test('profile stays incomplete when contact number or private ID document is missing', () => {
  const profile = {
    ...completeResidentProfile(),
    contact_number: '12345',
    id_front_path: null,
    face_photo_path: null
  };
  const result = checkProfileCompletion(profile);
  assert.equal(result.isComplete, false);
  assert.ok(result.missingFields.includes('Contact Number'));
  assert.ok(result.missingFields.includes('Identity Verification'));
  assert.ok(result.missingFields.includes('Face Verification'));
});
