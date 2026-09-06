export type RegistrationData = {
  season: string; firstName: string; lastName: string; dateOfBirth: string; ageGroup: string;
  position: string; email: string; password: string; guardianName: string; guardianPhone: string;
  guardianEmail: string; emergencyContact: { name: string; phone: string; relationship: string };
  medicalNotes: string; agreeToTerms: boolean; agreeToPhotoPolicy: boolean; paymentMethod: 'offline' | 'paypal'; quotedAmount: number;
};
type Result = { data: RegistrationData; error?: never; step?: never }
  | { data?: never; error: string; step: number };

export function validateRegistration(input: unknown, season: string, ageGroups: string[], throughStep = 4): Result {
  const fail = (error: string, step: number): Result => ({ error, step });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Please submit a registration form.', 1);
  const body = input as Record<string, unknown>;
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const validText = (value: unknown, max: number, required = true) =>
    (value === undefined && !required) || (typeof value === 'string' && value.trim().length <= max && (!required || !!value.trim()));
  const validPhone = (value: unknown) => validText(value, 40) && /^[+()\d\s.-]+$/.test(text(value)) && /^\d{7,15}$/.test(text(value).replace(/\D/g, ''));
  const validEmail = (value: unknown) => validText(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  if (body.season !== season) return fail('Season details have changed. Please refresh this page before submitting your registration.', 1);
  if (!validText(body.firstName, 100) || !validText(body.lastName, 100)) return fail('Please enter the player’s first and last names (up to 100 characters each).', 1);
  const dob = text(body.dateOfBirth);
  const date = new Date(`${dob}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob
    || dob < '1900-01-01' || dob > new Date().toISOString().slice(0, 10)) return fail('Please enter a valid date of birth that is not in the future.', 1);
  if (typeof body.ageGroup !== 'string' || !ageGroups.includes(body.ageGroup)) return fail('Please select an available age group.', 1);
  if (!validText(body.position, 100, false)) return fail('Please enter a position of up to 100 characters.', 1);
  if (throughStep >= 2) {
    if (!validText(body.guardianName, 150)) return fail('Please enter the parent or guardian’s full name.', 2);
    if (!validPhone(body.guardianPhone)) return fail('Please enter a valid guardian phone number, including the area or country code.', 2);
    if (!validEmail(body.email) || !validEmail(body.guardianEmail)) return fail('Please enter a valid guardian email address.', 2);
    if (text(body.email).toLowerCase() !== text(body.guardianEmail).toLowerCase()) return fail('Please use the guardian email address for the parent account.', 2);
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return fail('Please enter a password between 8 and 128 characters.', 2);
  }
  const contact = body.emergencyContact;
  const emergency = contact && typeof contact === 'object' && !Array.isArray(contact)
    ? contact as Record<string, unknown> : { name: body.emergencyName, phone: body.emergencyPhone, relationship: body.emergencyRelationship };
  if (throughStep >= 3) {
    if (!validText(emergency.name, 150)) return fail('Please enter the emergency contact’s full name.', 3);
    if (!validPhone(emergency.phone)) return fail('Please enter a valid emergency contact phone number.', 3);
    if (!validText(emergency.relationship, 100, false)) return fail('Please enter an emergency relationship of up to 100 characters.', 3);
    if (!validText(body.medicalNotes, 5000, false)) return fail('Please keep medical notes to 5,000 characters or fewer.', 3);
  }
  if (throughStep >= 4) {
    if (body.agreeToTerms !== true) return fail('Please agree to the terms and conditions.', 4);
    if (body.agreeToPhotoPolicy !== undefined && typeof body.agreeToPhotoPolicy !== 'boolean') return fail('Please choose whether to give photo consent.', 4);
    if (body.paymentMethod !== 'paypal' && body.paymentMethod !== 'offline') return fail('Please choose an available payment method.', 4);
    if (typeof body.quotedAmount !== 'number' || !Number.isFinite(body.quotedAmount) || body.quotedAmount < 0) return fail('Please reload the registration fee before submitting.', 4);
  }
  return { data: {
    season, firstName: text(body.firstName), lastName: text(body.lastName), dateOfBirth: dob,
    ageGroup: text(body.ageGroup), position: text(body.position), email: text(body.email).toLowerCase(),
    password: typeof body.password === 'string' ? body.password : '', guardianName: text(body.guardianName),
    guardianPhone: text(body.guardianPhone), guardianEmail: text(body.guardianEmail).toLowerCase(),
    emergencyContact: { name: text(emergency.name), phone: text(emergency.phone), relationship: text(emergency.relationship) },
    medicalNotes: text(body.medicalNotes), agreeToTerms: body.agreeToTerms === true,
    agreeToPhotoPolicy: body.agreeToPhotoPolicy === true, paymentMethod: body.paymentMethod === 'paypal' ? 'paypal' : 'offline',
    quotedAmount: typeof body.quotedAmount === 'number' ? body.quotedAmount : 0,
  } };
}
