const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      /\.pages\.dev$/,
      /\.workers\.dev$/,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Database ──
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yjrl';

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  // Auto in-memory DB for development
  const isPlaceholder = !process.env.MONGODB_URI || process.env.MONGODB_URI.includes('<password>');
  if (isPlaceholder && process.env.NODE_ENV !== 'production') {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      MONGODB_URI = mongod.getUri();
      console.log('[Dev] In-memory MongoDB started');
    } catch (err) {
      console.warn('[Dev] mongodb-memory-server not installed, using local MongoDB');
    }
  }

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });
  console.log('MongoDB connected');

  // Auto-seed admin user
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@yepponjrl.com.au').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(adminPassword, salt);
    await User.collection.insertOne({
      firstName: 'Admin',
      lastName: 'YJRL',
      email: adminEmail,
      password: hashed,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('[Admin] Created:', adminEmail);
  }
}

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'yjrl-api' }));

// DB middleware
app.use('/api', async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(503).json({ error: 'Database unavailable' }); }
});

// ── Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/yjrl', require('./routes/yjrl'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

// ── Start ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`YJRL API running on port ${PORT}`);
});

module.exports = app;
