import type { Env } from '../types';
import season from '../../../shared/season.json';

export const registrationClosedMessage = `Sign-ups for ${season.season} are being prepared. The club will publish the opening date, fees and payment details when confirmed.`;
export const memberClosedMessage = 'Member access is being prepared. Please check back when the club announces opening.';

export function memberAccessOpen(env: Env) {
  return env.MEMBER_ACCESS_OPEN === 'true' && env.CHILD_SAFETY_SIGNOFF === 'approved';
}

export function registrationOpen(env: Env) {
  return memberAccessOpen(env) && env.REGISTRATIONS_OPEN === 'true'
    && env.SEASON_DETAILS_CONFIRMED === season.season;
}
