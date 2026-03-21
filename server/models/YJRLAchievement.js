const mongoose = require('mongoose');

// Achievement definitions — admin creates these, then awards them to players
const YJRLAchievementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🏆' }, // emoji or lucide icon name
  category: {
    type: String,
    enum: ['milestone', 'performance', 'attendance', 'spirit', 'special', 'season'],
    default: 'milestone'
  },
  criteria: { type: String, default: '' }, // Human-readable description of how to earn it
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  color: { type: String, default: '#f0a500' },
  xpValue: { type: Number, default: 10 }, // Points awarded when earned
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('YJRLAchievement', YJRLAchievementSchema);
