const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['player', 'parent', 'coach', 'admin', 'dev'], default: 'player' },
  phone: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

UserSchema.virtual('name').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
