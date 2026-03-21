const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.header('Authorization');
    if (!header) return res.status(401).json({ error: 'No auth token' });

    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yjrl-dev-secret-change-me');

    const user = await User.findById(decoded.userId || decoded.id).select('-password');
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = auth;
