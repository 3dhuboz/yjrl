export function fixtureError(body: Record<string, unknown>, partial = false): string {
  for (const [camel, snake, label] of [['homeTeamName', 'home_team_name', 'home team'], ['awayTeamName', 'away_team_name', 'away team'], ['ageGroup', 'age_group', 'age group']]) {
    const value = body[camel] ?? body[snake];
    if ((!partial || value !== undefined) && (typeof value !== 'string' || !value.trim() || value.length > 150)) return `Enter the ${label}. Use TBC if the opponent is not confirmed.`;
  }
  if (!partial || body.date !== undefined) {
    const date = String(body.date || '');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return 'Choose a valid fixture date.';
  }
  if ((!partial || body.round !== undefined) && (!Number.isInteger(Number(body.round)) || Number(body.round) < 1)) return 'Enter a round number of 1 or more.';
  if (body.time && (typeof body.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))) return 'Choose a valid kick-off time.';
  return '';
}
