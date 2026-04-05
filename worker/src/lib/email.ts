// Email via Resend API — simple fetch-based wrapper

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

export function registrationConfirmationEmail(playerName: string, ageGroup: string, amount: number): { subject: string; html: string } {
  return {
    subject: `Registration Confirmed — ${playerName} | Yeppoon Seagulls JRL`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1d4ed8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Yeppoon Seagulls JRL</h1>
          <p style="margin: 5px 0 0; opacity: 0.9;">Registration Confirmation</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1d4ed8; margin-top: 0;">Welcome to the Seagulls!</h2>
          <p>Great news — <strong>${playerName}</strong> is now registered for the <strong>${ageGroup}</strong> age group for the 2026 season.</p>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="margin: 0;"><strong>Payment:</strong> $${amount.toFixed(2)} AUD — Confirmed</p>
          </div>
          <h3 style="color: #1d4ed8;">Next Steps</h3>
          <ul style="line-height: 1.8;">
            <li>Collect your team jersey and shorts from the canteen on registration day</li>
            <li>Complete the PlayHQ registration (link will be emailed separately)</li>
            <li>Check the fixtures page for your first training session</li>
            <li>Join the team chat in your Player Portal</li>
          </ul>
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Go Seagulls! See you at Nev Skuse Oval.</p>
        </div>
      </div>
    `,
  };
}

export function eventReminderEmail(eventTitle: string, eventDate: string, eventVenue: string): { subject: string; html: string } {
  return {
    subject: `Reminder: ${eventTitle} — Yeppoon Seagulls JRL`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1d4ed8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Yeppoon Seagulls JRL</h1>
          <p style="margin: 5px 0 0; opacity: 0.9;">Event Reminder</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1d4ed8; margin-top: 0;">Upcoming: ${eventTitle}</h2>
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${eventDate}</p>
            <p style="margin: 4px 0;"><strong>Venue:</strong> ${eventVenue}</p>
          </div>
          <p>This is a friendly reminder about the upcoming event. We look forward to seeing you there!</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Go Seagulls!</p>
        </div>
      </div>
    `,
  };
}

export function adminRegistrationNotification(playerName: string, ageGroup: string, guardianName: string): { subject: string; html: string } {
  return {
    subject: `New Registration: ${playerName} (${ageGroup})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New Player Registration</h2>
        <p><strong>Player:</strong> ${playerName}</p>
        <p><strong>Age Group:</strong> ${ageGroup}</p>
        <p><strong>Guardian:</strong> ${guardianName}</p>
        <p>Log into the Admin Portal to view full details and manage the registration.</p>
      </div>
    `,
  };
}
