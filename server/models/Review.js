const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Please add a rating between 1 and 5'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
    default: 0
  },
  sentimentLabel: {
    type: String,
    enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'],
    default: 'NEUTRAL'
  },
  intensityLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'LOW'
  },
  conflictDetected: {
    type: Boolean,
    default: false
  },
  finalRating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  starWeight: {
    type: Number,
    default: 0.7
  },
  sentimentWeight: {
    type: Number,
    default: 0.3
  },
  sentimentAnalysis: {
    rawPositive: Number,
    rawNegative: Number,
    rawNeutral: Number,
    confidence: Number,
    wordCount: Number,
    hasStrongEmotion: Boolean,
    hasSpecificDetails: Boolean
  },
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  }
}, {
  timestamps: true
});

// Prevent user from submitting more than one review per person per ride
reviewSchema.index({ reviewer: 1, subject: 1, rideId: 1 }, { unique: true });

// Static method to get avg rating and save
reviewSchema.statics.getAverageRating = async function(userId) {
  const result = await this.aggregate([
    { $match: { subject: userId } },
    { $group: {
      _id: null,
      avgFinalRating: { $avg: '$finalRating' },
      avgStarRating: { $avg: '$rating' },
      totalReviews: { $sum: 1 }
    }}
  ]);

  try {
    if (result[0]) {
      await mongoose.model('User').findByIdAndUpdate(userId, {
        averageRating: Math.round(result[0].avgFinalRating * 100) / 100,
        starOnlyRating: Math.round(result[0].avgStarRating * 100) / 100,
        totalRatings: result[0].totalReviews
      });
    } else {
      await mongoose.model('User').findByIdAndUpdate(userId, {
        averageRating: 0,
        starOnlyRating: 0,
        totalRatings: 0
      });
    }
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
reviewSchema.post('save', async function() {
  await this.constructor.getAverageRating(this.subject);
});

// Call getAverageRating before remove
reviewSchema.pre('remove', async function() {
  await this.constructor.getAverageRating(this.subject);
});

module.exports = mongoose.model('Review', reviewSchema);
