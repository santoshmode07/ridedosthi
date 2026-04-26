const Review = require('../models/Review');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { analyzeSentiment, measureReviewIntensity, detectConflict, calculateFinalRating } = require('../utils/sentimentAnalyzer');

// @desc    Create a review for a user after a ride
// @route   POST /api/reviews/:rideId/:userId
// @access  Private
exports.createReview = async (req, res) => {
  try {
    const { rating: starRating, comment } = req.body;
    const { rideId, userId: subjectId } = req.params;

    // 1. Basic validation (Star rating is mandatory, comment is optional)
    if (!starRating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }

    const reviewComment = comment || "";

    // 2. Fetch Ride and validate
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    // Determine logical completion (Current time > Departure + 6 hours)
    const departureDate = new Date(ride.date);
    const [hours, minutes] = ride.time.split(':').map(Number);
    departureDate.setHours(hours, minutes, 0, 0);
    const now = new Date();
    const isPastRide = now > new Date(departureDate.getTime() + 6 * 60 * 60 * 1000);

    if (ride.status !== 'completed' && !isPastRide) {
      console.warn(`[Review] Validation failed: Ride status is ${ride.status} and ride not yet logically expired. RideID: ${rideId}`);
      return res.status(400).json({ success: false, message: 'You can only leave feedback for completed or concluded rides' });
    }
    
    // But don't allow reviews for explicitly cancelled rides
    if (ride.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'You cannot leave feedback for a journey that was cancelled.' });
    }

    // 3. Logic validation: Reviewer and Subject must be participants
    const driverId = ride.driver.toString();
    const confirmedBookings = ride.bookings.filter(b => b.status === 'confirmed');
    const passengerIds = confirmedBookings.map(b => b.passenger.toString());
    
    const reviewerId = req.user._id.toString();
    
    // Check Reviewer Participation
    const isReviewerInRide = (reviewerId === driverId) || passengerIds.includes(reviewerId);
    if (!isReviewerInRide) {
      return res.status(403).json({ success: false, message: 'Access Denied: You were not a participant in this journey.' });
    }

    // Check Subject Participation
    const isSubjectInRide = (subjectId === driverId) || passengerIds.includes(subjectId);
    if (!isSubjectInRide) {
       console.warn(`[Review] Validation failed: Subject ${subjectId} not found in ride roster. RideID: ${rideId}`);
       return res.status(400).json({ success: false, message: 'The user you are trying to review was not part of this ride roster.' });
    }

    // Prevent self-review
    if (subjectId === reviewerId) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself' });
    }

    // 4. Sentiment Analysis Pipeline
    const sentimentResult = await analyzeSentiment(reviewComment);
    const intensityResult = measureReviewIntensity(reviewComment);
    const conflictResult = detectConflict(starRating, sentimentResult.sentimentScore);
    const finalRatingResult = calculateFinalRating(
      starRating,
      sentimentResult.sentimentScore,
      intensityResult.intensityScore,
      conflictResult
    );

    // 5. Create Review
    try {
      const review = await Review.create({
        reviewer: reviewerId,
        subject: subjectId,
        rideId,
        rating: starRating,
        comment: reviewComment,
        sentimentScore: sentimentResult.sentimentScore,
        sentimentLabel: sentimentResult.label,
        intensityLevel: intensityResult.intensityLevel,
        conflictDetected: conflictResult.conflictDetected,
        finalRating: finalRatingResult.finalRating,
        starWeight: finalRatingResult.starWeight,
        sentimentWeight: finalRatingResult.sentimentWeight,
        sentimentAnalysis: {
          rawPositive: sentimentResult.positiveScore,
          rawNegative: sentimentResult.negativeScore,
          rawNeutral: sentimentResult.neutralScore,
          confidence: sentimentResult.confidence,
          wordCount: intensityResult.wordCount,
          hasStrongEmotion: intensityResult.hasStrongEmotion,
          hasSpecificDetails: intensityResult.hasSpecificDetails
        }
      });

      console.log(`[Review] ⭐ New AI-Verified review from ${reviewerId} for ${subjectId} via Ride ${rideId}`);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          review,
          analysis: {
            yourStars: starRating,
            sentimentDetected: sentimentResult.label,
            finalRatingGiven: finalRatingResult.finalRating,
            conflictDetected: conflictResult.conflictDetected,
            message: finalRatingResult.calculation
          }
        }
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Error: You have already submitted feedback for this specific journey. Duplicate reviews are not allowed.' 
        });
      }
      throw err;
    }

  } catch (error) {
    console.error(`[ReviewError] 💥: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a user
// @route   GET /api/reviews/:userId
// @access  Public
exports.getUserReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ subject: req.params.userId });
    const reviews = await Review.find({ subject: req.params.userId })
      .populate('reviewer', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalReviews: total,
      hasMore: page < Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
