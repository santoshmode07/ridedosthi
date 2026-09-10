require('dotenv').config();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const User = require('../models/User');
const { analyzeSentiment, measureReviewIntensity, detectConflict, calculateFinalRating } = require('./sentimentAnalyzer');

const migrate = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ridedosthi';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB for migration...');

    const reviews = await Review.find({});
    console.log(`Found ${reviews.length} reviews to migrate.`);

    for (const review of reviews) {
      console.log(`Analyzing review: ${review._id} - "${review.comment.substring(0, 30)}..."`);
      
      const sentimentResult = await analyzeSentiment(review.comment);
      const intensityResult = measureReviewIntensity(review.comment);
      const conflictResult = detectConflict(review.rating, sentimentResult.sentimentScore);
      const finalRatingResult = calculateFinalRating(
        review.rating,
        sentimentResult.sentimentScore,
        intensityResult.intensityScore,
        conflictResult
      );

      review.sentimentScore = sentimentResult.sentimentScore;
      review.sentimentLabel = sentimentResult.label;
      review.intensityLevel = intensityResult.intensityLevel;
      review.conflictDetected = conflictResult.conflictDetected;
      review.finalRating = finalRatingResult.finalRating;
      review.starWeight = finalRatingResult.starWeight;
      review.sentimentWeight = finalRatingResult.sentimentWeight;
      review.sentimentAnalysis = {
        rawPositive: sentimentResult.positiveScore,
        rawNegative: sentimentResult.negativeScore,
        rawNeutral: sentimentResult.neutralScore,
        confidence: sentimentResult.confidence,
        wordCount: intensityResult.wordCount,
        hasStrongEmotion: intensityResult.hasStrongEmotion,
        hasSpecificDetails: intensityResult.hasSpecificDetails
      };

      await review.save();
    }

    console.log('All reviews updated. Recalculating user ratings...');

    // Recalculate average ratings for all users who have been reviewed
    const users = await Review.distinct('subject');
    for (const userId of users) {
      await Review.getAverageRating(userId);
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
