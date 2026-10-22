export const PRIMARY_ADMIN_EMAIL = 'paracalejerson05@gmail.com';

export function isPrimaryAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
