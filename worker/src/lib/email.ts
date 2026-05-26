// Email via Resend API - simple fetch-based wrapper

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(apiKey: string, from: string, options: EmailOptions): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function registrationEmailShell(title: string, subtitle: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1d4ed8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Yeppoon Seagulls JRL</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">${subtitle}</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1d4ed8; margin-top: 0;">${title}</h2>
        ${body}
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Go Seagulls! See you at Nev Skuse Oval.</p>
      </div>
    </div>
  `;
}

export function registrationPaidEmail(playerName: string, ageGroup: string, amount: number): { subject: string; html: string } {
  const safeName = escapeHtml(playerName);
  const safeAgeGroup = escapeHtml(ageGroup);
  return {
    subject: `Registration paid - ${safeName} | Yeppoon Seagulls JRL`,
    html: registrationEmailShell(
      'Payment received',
      'Registration Payment Confirmation',
      `
        <p>Great news - payment has been received for <strong>${safeName}</strong>'s <strong>${safeAgeGroup}</strong> registration.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="margin: 0;"><strong>Payment:</strong> $${amount.toFixed(2)} AUD - Paid</p>
        </div>
        <h3 style="color: #1d4ed8;">Next steps</h3>
        <ul style="line-height: 1.8;">
          <li>The registrar will complete the club review and team allocation.</li>
          <li>Complete PlayHQ registration if the club has not already matched it.</li>
          <li>Watch the parent portal for team, training, and uniform updates.</li>
        </ul>
      `,
    ),
  };
}

export function registrationOfflineEmail(playerName: string, ageGroup: string, amount: number): { subject: string; html: string } {
  const safeName = escapeHtml(playerName);
  const safeAgeGroup = escapeHtml(ageGroup);
  return {
    subject: `Registration received - payment required | ${safeName}`,
    html: registrationEmailShell(
      'Registration received',
      'Awaiting Payment and Club Review',
      `
        <p><strong>${safeName}</strong>'s <strong>${safeAgeGroup}</strong> registration has been received by Yeppoon Seagulls JRL.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="margin: 0;"><strong>Amount due:</strong> $${amount.toFixed(2)} AUD - Awaiting payment</p>
        </div>
        <h3 style="color: #1d4ed8;">Next steps</h3>
        <ul style="line-height: 1.8;">
          <li>The registrar will review the registration details.</li>
          <li>Please pay by bank transfer or at the club as directed by the registrar.</li>
          <li>The registration is not finalised until payment and club review are complete.</li>
        </ul>
      `,
    ),
  };
}

export function registrationConfirmationEmail(playerName: string, ageGroup: string, amount: number): { subject: string; html: string } {
  return registrationPaidEmail(playerName, ageGroup, amount);
}

export function eventReminderEmail(eventTitle: string, eventDate: string, eventVenue: string): { subject: string; html: string } {
  const safeTitle = escapeHtml(eventTitle);
  const safeDate = escapeHtml(eventDate);
  const safeVenue = escapeHtml(eventVenue);
  return {
    subject: `Reminder: ${safeTitle} - Yeppoon Seagulls JRL`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1d4ed8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Yeppoon Seagulls JRL</h1>
          <p style="margin: 5px 0 0; opacity: 0.9;">Event Reminder</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1d4ed8; margin-top: 0;">Upcoming: ${safeTitle}</h2>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${safeDate}</p>
            <p style="margin: 4px 0;"><strong>Venue:</strong> ${safeVenue}</p>
          </div>
          <p>This is a friendly reminder about the upcoming event. We look forward to seeing you there!</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Go Seagulls!</p>
        </div>
      </div>
    `,
  };
}

export function adminRegistrationNotification(playerName: string, ageGroup: string, guardianName: string, paymentStatus = 'received'): { subject: string; html: string } {
  const safeName = escapeHtml(playerName);
  const safeAgeGroup = escapeHtml(ageGroup);
  const safeGuardian = escapeHtml(guardianName);
  const safeStatus = escapeHtml(paymentStatus);
  return {
    subject: `New Registration: ${safeName} (${safeAgeGroup})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New Player Registration</h2>
        <p><strong>Player:</strong> ${safeName}</p>
        <p><strong>Age Group:</strong> ${safeAgeGroup}</p>
        <p><strong>Guardian:</strong> ${safeGuardian}</p>
        <p><strong>Payment Status:</strong> ${safeStatus}</p>
        <p>Log into the Admin Portal to view full details and manage the registration.</p>
      </div>
    `,
  };
}
