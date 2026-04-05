-- Seed data: default chat rooms and achievement definitions

-- Default chat rooms (player + parent rooms for each age group, plus coaches)
INSERT OR IGNORE INTO chat_rooms (id, name, type, age_group) VALUES
  ('player-u6', 'U6 Team Chat', 'player', 'U6'),
  ('player-u7', 'U7 Team Chat', 'player', 'U7'),
  ('player-u8', 'U8 Team Chat', 'player', 'U8'),
  ('player-u9', 'U9 Team Chat', 'player', 'U9'),
  ('player-u10', 'U10 Team Chat', 'player', 'U10'),
  ('player-u11', 'U11 Team Chat', 'player', 'U11'),
  ('player-u12', 'U12 Team Chat', 'player', 'U12'),
  ('player-u13', 'U13 Team Chat', 'player', 'U13'),
  ('player-u14', 'U14 Team Chat', 'player', 'U14'),
  ('player-u15', 'U15 Team Chat', 'player', 'U15'),
  ('player-u16', 'U16 Team Chat', 'player', 'U16'),
  ('parent-u6', 'U6 Parents', 'parent', 'U6'),
  ('parent-u7', 'U7 Parents', 'parent', 'U7'),
  ('parent-u8', 'U8 Parents', 'parent', 'U8'),
  ('parent-u9', 'U9 Parents', 'parent', 'U9'),
  ('parent-u10', 'U10 Parents', 'parent', 'U10'),
  ('parent-u11', 'U11 Parents', 'parent', 'U11'),
  ('parent-u12', 'U12 Parents', 'parent', 'U12'),
  ('parent-u13', 'U13 Parents', 'parent', 'U13'),
  ('parent-u14', 'U14 Parents', 'parent', 'U14'),
  ('parent-u15', 'U15 Parents', 'parent', 'U15'),
  ('parent-u16', 'U16 Parents', 'parent', 'U16'),
  ('coaches', 'Coaches Room', 'coach', NULL);

-- Default achievement definitions (matching frontend ALL_ACHIEVEMENTS)
INSERT OR IGNORE INTO achievements (id, name, description, icon, category, rarity, color, xp_value) VALUES
  ('ach-first-try', 'First Try', 'Scored your very first try', '🏉', 'milestone', 'common', '#10b981', 25),
  ('ach-iron-player', 'Iron Player', '100% training attendance for a month', '💪', 'attendance', 'rare', '#3b82f6', 50),
  ('ach-hat-trick', 'Hat Trick Hero', 'Scored 3+ tries in a single game', '🎩', 'performance', 'epic', '#8b5cf6', 100),
  ('ach-team-spirit', 'Team Spirit', 'Recognised by coaches for outstanding teamwork', '🤝', 'spirit', 'common', '#f59e0b', 30),
  ('ach-defensive-wall', 'Defensive Wall', '10+ tackles in a single game', '🧱', 'performance', 'rare', '#ef4444', 75),
  ('ach-season-warrior', 'Season Warrior', 'Played every game in the season', '⚔️', 'season', 'epic', '#6366f1', 150),
  ('ach-golden-boot', 'Golden Boot', 'Top goal kicker for the season', '👟', 'season', 'legendary', '#eab308', 200),
  ('ach-rising-star', 'Rising Star', 'Selected for representative pathways', '⭐', 'special', 'legendary', '#f97316', 250);
