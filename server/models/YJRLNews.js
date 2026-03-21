const mongoose = require('mongoose');

const YJRLNewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  excerpt: { type: String, default: '' },
  category: {
    type: String,
    enum: ['news', 'results', 'events', 'club', 'pathways', 'community', 'sponsors'],
    default: 'news'
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: 'Yeppoon JRL' },
  image: { type: String, default: '' },
  published: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  tags: [{ type: String }],
  publishDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('YJRLNews', YJRLNewsSchema);
