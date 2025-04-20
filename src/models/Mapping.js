const mongoose = require('mongoose');

const MappingSchema = new mongoose.Schema({
  s3Key: {
    type: String,
    required: true,
    index: true
  },
  ipfsCid: {
    type: String,
    required: true,
    index: true
  },
  size: {
    type: Number
  },
  mimeType: {
    type: String
  },
  metadata: {
    type: Object
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add timestamps to track when the mapping was last updated
MappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for faster lookups
MappingSchema.index({ s3Key: 1 });
MappingSchema.index({ ipfsCid: 1 });

module.exports = mongoose.model('Mapping', MappingSchema); 