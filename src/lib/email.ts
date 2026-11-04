import { apiUrl } from './api';
import { SYSTEM_NAME } from '../constants';
import { supabase } from './supabase';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}

async function sendAdminEmail(to: string, subject: string, html: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(apiUrl('/api/send-email'), {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ to, subject, html })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send email');
  }
  return data;
}

export interface ApprovalEmailParams {
  residentName: string;
  residentEmail: string;
  serviceType: string;
  approvalDate: string;
  referenceNumber: string;
  appointmentDate: string;
  appointmentTime: string;
}

export interface DisapprovalEmailParams {
  residentName: string;
  residentEmail: string;
  serviceType: string;
  referenceNumber: string;
  reason: string;
  adminNotes: string;
}

export const sendApprovalEmail = async (params: ApprovalEmailParams) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Request Approved</h2>
      <p>Dear ${escapeHtml(params.residentName)},</p>
      <p>Your request for <strong>${escapeHtml(params.serviceType)}</strong> has been <strong>APPROVED</strong>.</p>
      <div style="background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${escapeHtml(params.referenceNumber)}</p>
        <p style="margin: 5px 0;"><strong>Appointment Date:</strong> ${escapeHtml(params.appointmentDate)}</p>
        <p style="margin: 5px 0;"><strong>Appointment Time:</strong> ${escapeHtml(params.appointmentTime)}</p>
      </div>
      <p>Please present this reference number upon your visit.</p>
      <br/>
      <p>Best regards,<br/>${SYSTEM_NAME}</p>
    </div>
  `;

  return sendAdminEmail(params.residentEmail, `${SYSTEM_NAME} – Request Approved`, html);
};

export const sendDisapprovalEmail = async (params: DisapprovalEmailParams) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Request Disapproved</h2>
      <p>Dear ${escapeHtml(params.residentName)},</p>
      <p>We regret to inform you that your request for <strong>${escapeHtml(params.serviceType)}</strong> has been <strong>DISAPPROVED</strong>.</p>
      <div style="background-color: #FEF2F2; padding: 15px; border-radius: 8px; margin: 20px 0; color: #991B1B;">
        <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${escapeHtml(params.referenceNumber)}</p>
        <p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
        ${params.adminNotes ? `<p style="margin: 5px 0;"><strong>Admin Notes:</strong> ${escapeHtml(params.adminNotes)}</p>` : ''}
      </div>
      <p>If you have any questions, please visit the Barangay Hall for clarification.</p>
      <br/>
      <p>Best regards,<br/>${SYSTEM_NAME}</p>
    </div>
  `;

  return sendAdminEmail(params.residentEmail, `${SYSTEM_NAME} – Request Disapproved`, html);
};
