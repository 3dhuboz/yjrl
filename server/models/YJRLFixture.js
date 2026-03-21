const mongoose = require('mongoose');

const PlayerGameStatSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'YJRLPlayer' },
  playerName: { type: String, default: '' },
  tries: { type: Number, default: 0 },
  goals: { type: Number, default: 0 },
  fieldGoals: { type: Number, default: 0 },
  tackles: { type: Number, default: 0 },
  runMetres: { type: Number, default: 0 },
  played: { type: Boolean, default: true }
}, { _id: false });

const YJRLFixtureSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'YJRLTeam' },
  ageGroup: { type: String, required: true },
  season: { type: String, default: () => new Date().getFullYear().toString() },
  round: { type: Number, required: true },
  homeTeamName: { type: String, required: true },
  awayTeamName: { type: String, required: true },
  isHomeGame: { type: Boolean, default: true }, // Is YJRL the home team?
  date: { type: Date, required: true },
  time: { type: String, default: '' },
  venue: { type: String, default: 'Nev Skuse Oval, Yeppoon' },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'postponed', 'forfeit'],
    default: 'scheduled'
  },
  homeScore: { type: Number },
  awayScore: { type: Number },
  playerStats: [PlayerGameStatSchema],
  manOfMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'YJRLPlayer' },
  manOfMatchName: { type: String, default: '' },
  matchReport: { type: String, default: '' },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

YJRLFixtureSchema.virtual('result').get(function () {
  if (this.status !== 'completed') return null;
  const yjrlScore = this.isHomeGame ? this.homeScore : this.awayScore;
  const oppScore = this.isHomeGame ? this.awayScore : this.homeScore;
  if (yjrlScore > oppScore) return 'win';
  if (yjrlScore < oppScore) return 'loss';
  return 'draw';
});

YJRLFixtureSchema.virtual('opponent').get(function () {
  return this.isHomeGame ? this.awayTeamName : this.homeTeamName;
});

YJRLFixtureSchema.set('toJSON', { virtuals: true });
YJRLFixtureSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('YJRLFixture', YJRLFixtureSchema);
