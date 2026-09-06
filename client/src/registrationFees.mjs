// Reject stale or incomplete fee responses before a family can submit.
export function validateRegistrationFees(data, expectedSeason) {
  if (!data || data.season !== expectedSeason) {
    throw new Error('Registration details are being updated. Please try again shortly.');
  }
  const fees = data.fees;
  if (!fees || typeof fees !== 'object' || Array.isArray(fees) || !Object.keys(fees).length
    || Object.values(fees).some(fee => !Number.isFinite(fee) || fee < 0)) {
    throw new Error('Registration fees could not be loaded. Please try again.');
  }
  if (typeof data.earlyBirdActive !== 'boolean'
    || !Number.isFinite(data.earlyBirdDiscount) || data.earlyBirdDiscount < 0
    || (data.earlyBirdActive && Object.values(fees).some(fee => fee < data.earlyBirdDiscount))
    || typeof data.paymentOptions?.paypal !== 'boolean'
    || data.paymentOptions?.offline !== true) {
    throw new Error('Registration options could not be loaded. Please try again.');
  }
  return data;
}

export function registrationFee(details, ageGroup) {
  if (!details || !Object.hasOwn(details.fees, ageGroup)) return null;
  return details.fees[ageGroup] - (details.earlyBirdActive ? details.earlyBirdDiscount : 0);
}
