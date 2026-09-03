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
      <p>Dear ${params.residentName},</p>
      <p>Your request for <strong>${params.serviceType}</strong> has been <strong>APPROVED</strong>.</p>
      <div style="background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${params.referenceNumber}</p>
        <p style="margin: 5px 0;"><strong>Appointment Date:</strong> ${params.appointmentDate}</p>
        <p style="margin: 5px 0;"><strong>Appointment Time:</strong> ${params.appointmentTime}</p>
      </div>
      <p>Please present this reference number upon your visit.</p>
      <br/>
      <p>Best regards,<br/>Barangay Smart Appointment System</p>
    </div>
  `;

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: params.residentEmail,
      subject: 'Barangay Smart Appointment – Request Approved',
      html,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send approval email');
  }
  return data;
};

export const sendDisapprovalEmail = async (params: DisapprovalEmailParams) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Request Disapproved</h2>
      <p>Dear ${params.residentName},</p>
      <p>We regret to inform you that your request for <strong>${params.serviceType}</strong> has been <strong>DISAPPROVED</strong>.</p>
      <div style="background-color: #FEF2F2; padding: 15px; border-radius: 8px; margin: 20px 0; color: #991B1B;">
        <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${params.referenceNumber}</p>
        <p style="margin: 5px 0;"><strong>Reason:</strong> ${params.reason}</p>
        ${params.adminNotes ? `<p style="margin: 5px 0;"><strong>Admin Notes:</strong> ${params.adminNotes}</p>` : ''}
      </div>
      <p>If you have any questions, please visit the Barangay Hall for clarification.</p>
      <br/>
      <p>Best regards,<br/>Barangay Smart Appointment System</p>
    </div>
  `;

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: params.residentEmail,
      subject: 'Barangay Smart Appointment – Request Disapproved',
      html,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to send disapproval email');
  }
  return data;
};
