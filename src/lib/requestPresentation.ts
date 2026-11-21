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

export function formatUnavailableSlotMessage(date?: string, display?: string): string {
  if (!date || !display) {
    return 'This appointment time is no longer available. Please choose another date and time, then submit the request again.';
  }

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `This appointment time is no longer available. The next available slot is ${formattedDate} at ${display}. The form has been updated—please review the new schedule and submit the request again.`;
}
