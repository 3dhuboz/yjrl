const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'yjrl-dev-secret-change-me';
const makeToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    if (!firstName || !email || !password) {
      return res.status(400).json({ error: 'First name, email, and password are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const requestedRole = typeof role === 'string' ? role.toLowerCase().trim() : 'player';
    if (['coach', 'admin', 'dev'].includes(requestedRole)) {
      return res.status(403).json({ error: 'Adult and staff roles must be created by a verified club administrator' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({
      firstName,
      lastName: lastName || '',
      email: email.toLowerCase().trim(),
      password,
      role: requestedRole === 'parent' ? 'parent' : 'player'
    });
    await user.save();

    const token = makeToken(user._id);
    res.status(201).json({
      token,
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = makeToken(user._id);
    res.json({
      token,
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
