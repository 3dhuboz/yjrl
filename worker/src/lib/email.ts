// Email via Resend API - simple fetch-based wrapper

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(apiKey: string, from: string, options: EmailOptions, idempotencyKey?: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
      signal: AbortSignal.timeout(5000),
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

type RegistrationNotice = { registrationId: string; season: string; amount: number };

export function registrationPaidEmail({ registrationId, season, amount }: RegistrationNotice): { subject: string; html: string } {
  const reference = escapeHtml(registrationId);
  const safeSeason = escapeHtml(season);
  return {
    subject: 'Registration payment received | Yeppoon Seagulls JRL',
    html: registrationEmailShell(
      'Payment received',
      'Registration Payment Confirmation',
      `
        <p>Payment has been received for your <strong>${safeSeason}</strong> club registration.</p>
        <p><strong>Registration reference:</strong> ${reference}</p>
        <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="margin: 0;"><strong>Payment:</strong> $${amount.toFixed(2)} AUD - Paid</p>
        </div>
        <h3 style="color: #1d4ed8;">Next steps</h3>
        <ul style="line-height: 1.8;">
          <li>The registrar will complete the club review and team allocation.</li>
          <li>The club will confirm any remaining competition registration requirements.</li>
          <li>Watch the parent portal for team, training, and uniform updates.</li>
        </ul>
      `,
    ),
  };
}

export function registrationOfflineEmail({ registrationId, season, amount }: RegistrationNotice): { subject: string; html: string } {
  const reference = escapeHtml(registrationId);
  const safeSeason = escapeHtml(season);
  return {
    subject: 'Registration received - payment required | Yeppoon Seagulls JRL',
    html: registrationEmailShell(
      'Registration received',
      'Awaiting Payment and Club Review',
      `
        <p>Your <strong>${safeSeason}</strong> club registration has been received by Yeppoon Seagulls JRL.</p>
        <p><strong>Registration reference:</strong> ${reference}</p>
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

export function adminRegistrationNotification(registrationId: string, season: string, paymentStatus: string): { subject: string; html: string } {
  const reference = escapeHtml(registrationId);
  const safeSeason = escapeHtml(season);
  const safeStatus = escapeHtml(paymentStatus);
  return {
    subject: 'Registration update | Yeppoon Seagulls JRL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New Player Registration</h2>
        <p><strong>Registration reference:</strong> ${reference}</p>
        <p><strong>Season:</strong> ${safeSeason}</p>
        <p><strong>Payment Status:</strong> ${safeStatus}</p>
        <p>Log into the Admin Portal to view full details and manage the registration.</p>
      </div>
    `,
  };
}
