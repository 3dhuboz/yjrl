export function checkoutFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.get('success') !== 'true' && params.get('cancelled') !== 'true') return null;
  return {
    registrationId: params.get('reg') || '',
    state: params.get('state') || '',
    action: params.get('cancelled') === 'true' ? 'resume' : 'capture',
  };
}

export function confirmationEmailMessage(status, email) {
  if (status === 'sent') return `A confirmation email has been sent to ${email}. Please check your inbox and junk folder.`;
  if (status === 'unavailable' || status === 'failed') return 'Your registration is saved, but we could not send a confirmation email. Keep your reference and check the parent portal for updates.';
  return 'Keep your registration reference and check the parent portal for updates.';
}
