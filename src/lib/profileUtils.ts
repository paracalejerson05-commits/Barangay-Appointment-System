export type AccountStatus = 'pending' | 'approved' | 'rejected';

/**
 * Normalizes and checks the account approval status of a resident.
 * Admin account is always considered approved.
 * Newly registered residents default to 'pending' (Pending Approval).
 */
export function getAccountStatus(profile: any, email?: string): AccountStatus {
  if (profile?.role === 'admin' || email === 'paracalejerson05@gmail.com') {
    return 'approved';
  }

  const raw = (profile?.status || '').toString().toLowerCase().trim();
  if (raw === 'approved' || raw === 'active') {
    return 'approved';
  }
  if (raw === 'rejected' || raw === 'disapproved' || raw === 'inactive' || raw === 'deactivated') {
    return 'rejected';
  }
  
  // Default for all newly registered residents
  return 'pending';
}

export interface ProfileCompletionResult {
  isComplete: boolean;
  missingFields: string[];
}

/**
 * Validates that all required resident profile fields are completed:
 * Full Name, Email Address, Contact Number, Age, Gender, Civil Status, Complete Address
 */
export function checkProfileCompletion(profile: any, fallbackEmail?: string): ProfileCompletionResult {
  const missing: string[] = [];
  const displayName = profile?.displayName ?? profile?.display_name;
  const contactNumber = profile?.contactNumber ?? profile?.contact_number;
  const civilStatus = profile?.civilStatus ?? profile?.civil_status;
  const dateOfBirth = profile?.dateOfBirth ?? profile?.date_of_birth;

  // 1. Full Name
  if (!displayName || String(displayName).trim() === '') {
    missing.push('Full Name');
  }

  // 2. Email Address
  const email = String(profile?.email || fallbackEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    missing.push('Email Address');
  }

  // 3. Contact Number
  if (!/^09\d{9}$/.test(String(contactNumber || '').trim())) {
    missing.push('Contact Number');
  }

  // 4. Age
  const ageNum = Number(profile?.age);
  if (profile?.age === undefined || profile?.age === null || String(profile.age).trim() === '' || isNaN(ageNum) || ageNum < 0) {
    missing.push('Age');
  }

  const birthDateKey = String(dateOfBirth || '').slice(0, 10);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateKey) || birthDateKey > todayKey) {
    missing.push('Date of Birth');
  }

  // 5. Gender
  if (!profile?.gender || String(profile.gender).trim() === '') {
    missing.push('Gender');
  }

  // 6. Civil Status
  if (!civilStatus || String(civilStatus).trim() === '') {
    missing.push('Civil Status');
  }

  // 7. Complete Address
  const houseStreet = profile?.houseStreet ?? profile?.house_street;
  const purokSitio = profile?.purokSitio ?? profile?.purok_sitio;
  const barangay = profile?.barangay;
  const municipalityCity = profile?.municipalityCity ?? profile?.municipality_city;
  const province = profile?.province;
  const addressParts = [houseStreet, purokSitio, barangay, municipalityCity, province];
  const hasAddressParts = addressParts.every((part, index) => index === 0 || Boolean(String(part || '').trim()));
  if (!hasAddressParts) missing.push('Complete Address');

  const idType = profile?.idType ?? profile?.id_type;
  const idFrontPath = profile?.idFrontPath ?? profile?.id_front_path;
  const facePath = profile?.facePhotoPath ?? profile?.face_photo_path;
  const faceMethod = profile?.faceRegistrationMethod ?? profile?.face_registration_method;
  const consentAt = profile?.privacyConsentAt ?? profile?.privacy_consent_at;
  if (!idType || !idFrontPath || !consentAt) missing.push('Identity Verification');
  if (!['camera', 'upload', 'in_person'].includes(faceMethod) || (faceMethod !== 'in_person' && !facePath)) {
    missing.push('Face Verification');
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing
  };
}

export function isProfileComplete(profile: any, fallbackEmail?: string): boolean {
  return checkProfileCompletion(profile, fallbackEmail).isComplete;
}

export function getMissingProfileFields(profile: any, fallbackEmail?: string): string[] {
  return checkProfileCompletion(profile, fallbackEmail).missingFields;
}
