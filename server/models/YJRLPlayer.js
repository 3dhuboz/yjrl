const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ['training', 'game'], required: true },
  attended: { type: Boolean, default: true },
  notes: { type: String, default: '' }
}, { _id: false });

const PlayerStatsSchema = new mongoose.Schema({
  season: { type: String, required: true },
  gamesPlayed: { type: Number, default: 0 },
  tries: { type: Number, default: 0 },
  goals: { type: Number, default: 0 },
  fieldGoals: { type: Number, default: 0 },
  tackles: { type: Number, default: 0 },
  runMetres: { type: Number, default: 0 },
  manOfMatch: { type: Number, default: 0 }
}, { _id: false });

const YJRLPlayerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date },
  ageGroup: { type: String, default: '' },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'YJRLTeam' },
  position: { type: String, default: '' }, // 'fullback','wing','centre','five-eighth','halfback','hooker','prop','lock','second-row'
  jerseyNumber: { type: Number },
  guardianName: { type: String, default: '' },
  guardianPhone: { type: String, default: '' },
  guardianEmail: { type: String, default: '' },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relationship: { type: String, default: '' }
  },
  medicalNotes: { type: String, default: '' },
  registrationStatus: { type: String, enum: ['pending', 'active', 'inactive', 'transferred'], default: 'pending' },
  registrationYear: { type: String, default: () => new Date().getFullYear().toString() },
  playHQId: { type: String, default: '' },
  stats: [PlayerStatsSchema],
  achievements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'YJRLAchievement' }],
  achievementDates: [{
    achievement: { type: mongoose.Schema.Types.ObjectId, ref: 'YJRLAchievement' },
    date: { type: Date, default: Date.now },
    season: { type: String },
    notes: { type: String, default: '' }
  }],
  attendanceRecords: [AttendanceRecordSchema],
  coachNotes: { type: String, default: '' },
  pathwayProgress: {
    level: { type: String, enum: ['grassroots', 'development', 'rep', 'pathways', 'elite'], default: 'grassroots' },
    notes: { type: String, default: '' }
  },
  photo: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

YJRLPlayerSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

YJRLPlayerSchema.virtual('currentStats').get(function () {
  const season = new Date().getFullYear().toString();
  return this.stats.find(s => s.season === season) || {
    season, gamesPlayed: 0, tries: 0, goals: 0, fieldGoals: 0, tackles: 0, runMetres: 0, manOfMatch: 0
  };
});

YJRLPlayerSchema.virtual('attendanceRate').get(function () {
  if (!this.attendanceRecords.length) return 100;
  const attended = this.attendanceRecords.filter(r => r.attended).length;
  return Math.round((attended / this.attendanceRecords.length) * 100);
});

YJRLPlayerSchema.set('toJSON', { virtuals: true });
YJRLPlayerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('YJRLPlayer', YJRLPlayerSchema);
