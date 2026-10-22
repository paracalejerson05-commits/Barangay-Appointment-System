export const MAX_RESIDENT_IMAGE_BYTES = 5 * 1024 * 1024;

export function getResidentAge(value: string) {
  if (!value) return null;
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayHasNotPassed =
    today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (birthdayHasNotPassed) age -= 1;
  return age;
}

export function isPhilippineMobileNumber(value: string) {
  return /^09\d{9}$/.test(value);
}

export function getPasswordRequirementError(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
    ? null
    : 'Use at least 8 characters, including uppercase, lowercase, and a number.';
}

export async function validateResidentImage(file: File) {
  if (file.size <= 0 || file.size > MAX_RESIDENT_IMAGE_BYTES) {
    throw new Error('Choose a non-empty image that is 5 MB or smaller.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPG, PNG, and WebP images are accepted.');
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) {
    throw new Error('The selected file is not a readable JPG, PNG, or WebP image.');
  }
}
