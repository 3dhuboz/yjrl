const mongoose = require('mongoose');

const RSVPSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, default: '' },
  status: { type: String, enum: ['attending', 'not-attending', 'maybe'], default: 'attending' },
  adults: { type: Number, default: 1 },
  children: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  rsvpDate: { type: Date, default: Date.now }
}, { _id: false });

const YJRLEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['training', 'game', 'fundraiser', 'social', 'presentation', 'registration', 'photo-day', 'gala-day', 'other'],
    default: 'other'
  },
  date: { type: Date, required: true },
  endDate: { type: Date },
  time: { type: String, default: '' },
  endTime: { type: String, default: '' },
  venue: { type: String, default: '' },
  address: { type: String, default: '' },
  ageGroups: [{ type: String }],
  isPublic: { type: Boolean, default: true },
  capacity: { type: Number },
  rsvps: [RSVPSchema],
  image: { type: String, default: '' },
  color: { type: String, default: '#f0a500' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

YJRLEventSchema.virtual('attendingCount').get(function () {
  return this.rsvps.filter(r => r.status === 'attending').length;
});

YJRLEventSchema.set('toJSON', { virtuals: true });
YJRLEventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('YJRLEvent', YJRLEventSchema);
