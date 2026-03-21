const mongoose = require('mongoose');

const YJRLTeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ageGroup: { type: String, required: true }, // 'U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','Womens','Mens'
  division: { type: String, default: '' },
  season: { type: String, default: () => new Date().getFullYear().toString() },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  coachName: { type: String, default: '' },
  assistant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assistantName: { type: String, default: '' },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  managerName: { type: String, default: '' },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'YJRLPlayer' }],
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  byes: { type: Number, default: 0 },
  pointsFor: { type: Number, default: 0 },
  pointsAgainst: { type: Number, default: 0 },
  trainingDay: { type: String, default: '' },
  trainingTime: { type: String, default: '' },
  trainingVenue: { type: String, default: 'Nev Skuse Oval, Yeppoon' },
  colors: {
    primary: { type: String, default: '#0c1d35' },
    secondary: { type: String, default: '#f0a500' }
  },
  photo: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

YJRLTeamSchema.virtual('played').get(function () {
  return this.wins + this.losses + this.draws;
});

YJRLTeamSchema.virtual('points').get(function () {
  return (this.wins * 2) + this.draws;
});

YJRLTeamSchema.virtual('pointsDiff').get(function () {
  return this.pointsFor - this.pointsAgainst;
});

YJRLTeamSchema.set('toJSON', { virtuals: true });
YJRLTeamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('YJRLTeam', YJRLTeamSchema);
