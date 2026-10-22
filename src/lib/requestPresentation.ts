export function getRequestReference(id?: string, createdAt?: string): string {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  const token = String(id || 'request').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase().padEnd(8, '0');
  return `BSA-${year}-${token}`;
}

export function getStatusLabel(status?: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'approved': return 'Approved';
    case 'completed': return 'Completed';
    case 'disapproved': return 'Disapproved';
    default: return 'Under Review';
  }
}
