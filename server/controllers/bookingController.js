const Ride = require('../models/Ride');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { calculatePartialFare } = require('../utils/fareHelper');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const stripe = require('../config/stripe');
const socketManager = require('../utils/socketManager');

// @desc    Create Stripe Payment Intent for booking
// @route   POST /api/bookings/checkout
// @access  Private
exports.createBookingIntent = async (req, res) => {
  try {
    const { rideId, dropoffCoordinates } = req.body;
    
    // 1. Validate ride
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'available' || ride.seatsAvailable < 1) {
      return res.status(400).json({ success: false, message: 'No seats available' });
    }

    // 2. Calculate fare
    let initialFare = calculatePartialFare(
      ride.fromCoordinates.coordinates,
      ride.toCoordinates.coordinates,
      dropoffCoordinates,
      ride.price
    );
    const isPriorityUser = req.user.priorityBadgeExpires && new Date(req.user.priorityBadgeExpires) > new Date();
    let fareCharged = isPriorityUser ? Math.floor(initialFare * 0.9) : initialFare;

    // 3. Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fareCharged * 100, // paise
      currency: 'inr',
      metadata: {
        userId: req.user._id.toString(),
        rideId: ride._id.toString(),
        type: 'ride_booking'
      }
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      fare: fareCharged
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Book a ride
// @route   POST /api/bookings
// @access  Private
exports.bookRide = async (req, res) => {
  try {
    const { rideId, boardingAddress, boardingCoordinates, dropoffAddress, dropoffCoordinates, paymentMethod, paymentIntentId } = req.body;

    if (!rideId || !boardingCoordinates || !dropoffCoordinates) {
        return res.status(400).json({
            success: false,
            message: 'Please provide all required booking details'
        });
    }

    // STEP 1 — Validate ride exists and is available
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }
    if (ride.status !== 'available' && !paymentIntentId) { // If paying, we already checked, but seat might be taken while paying. 
                                                         // Ideally we'd hold the seat, but for now we check again.
      return res.status(400).json({
        success: false,
        message: 'This ride is no longer available'
      });
    }
    if (ride.expiresAt && new Date() > new Date(ride.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'This ride has expired'
      });
    }

    // STEP 2 — Prevent driver from booking own ride
    if (ride.driver.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot book your own ride'
      });
    }

    // STEP 3 — GENDER CHECK
    if (ride.driverGender === 'female' && req.user.gender === 'male') {
      return res.status(403).json({
        success: false,
        message: 'This ride is for female passengers only'
      });
    }

    const alreadyBooked = ride.bookings.some(
      b => b.passenger.toString() === req.user._id.toString() && b.status === 'confirmed'
    );
    if (alreadyBooked) {
      return res.status(409).json({
        success: false,
        message: 'You have already booked this ride'
      });
    }

    // STEP 5 — Economic Calculations
    let initialFare = calculatePartialFare(
      ride.fromCoordinates.coordinates,
      ride.toCoordinates.coordinates,
      dropoffCoordinates,
      ride.price
    );

    const originalFare = initialFare;
    const isPriorityUser = req.user.priorityBadgeExpires && new Date(req.user.priorityBadgeExpires) > new Date();
    
    let fareCharged = isPriorityUser ? Math.floor(originalFare * 0.9) : originalFare;
    let systemSubsidy = originalFare - fareCharged;

    const commissionAmount = Math.floor(originalFare * 0.20);
    const finalRiderEarnings = originalFare - commissionAmount;

    // STEP 6 — Financial Operations
    const admin = await User.findOne({ role: 'admin' });
    const passenger = await User.findById(req.user._id);

    if (paymentMethod === 'wallet') {
        if (passenger.walletBalance < fareCharged) {
          return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }

        const updatedPassenger = await User.findOneAndUpdate(
          { _id: req.user._id, walletBalance: { $gte: fareCharged } },
          { $inc: { walletBalance: -fareCharged } },
          { new: true }
        );

        if (!updatedPassenger) {
          return res.status(400).json({ success: false, message: 'Transaction error. Please try again.' });
        }
      
        if (admin) {
          await User.findByIdAndUpdate(admin._id, { $inc: { walletBalance: fareCharged } });
          await Transaction.create({
            userId: admin._id,
            type: 'ESCROW_HOLD',
            amount: fareCharged,
            rideId: ride._id,
            description: `Escrow Hold (Wallet) - Passenger ${passenger.name} for Ride to ${ride.to}`
          });
        }

        await Transaction.create({
          userId: passenger._id,
          type: 'RIDE_PAYMENT',
          amount: -fareCharged,
          rideId: ride._id,
          description: `Ride Payment - To ${ride.to} (Escrow Hold)`
        });
    } else if (paymentMethod === 'online') {
        // VERIFY STRIPE PAYMENT
        if (!paymentIntentId) {
            return res.status(400).json({ success: false, message: 'Payment confirmation required' });
        }
        
        try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (pi.status !== 'succeeded') {
                return res.status(400).json({ success: false, message: 'Stripe payment has not succeeded' });
            }
            
            // Log for Admin Wallet (Escrow)
            if (admin) {
                admin.walletBalance += fareCharged;
                await admin.save();
                
                await Transaction.create({
                    userId: admin._id,
                    type: 'ESCROW_HOLD',
                    amount: fareCharged,
                    rideId: ride._id,
                    description: `Escrow Hold (Stripe) - Passenger ${passenger.name} for Ride to ${ride.to}`,
                    metadata: { paymentIntentId }
                });
            }

            // Log for Passenger Ledger (Completeness)
            await Transaction.create({
                userId: passenger._id,
                type: 'RIDE_PAYMENT',
                amount: -fareCharged,
                rideId: ride._id,
                description: `Ride Payment - To ${ride.to} (Online Hold)`,
                metadata: { paymentIntentId }
            });

            console.log(`[Escrow] 💳 Verified Stripe Payment ₹${fareCharged} from Passenger ${passenger.name}`);
        } catch (err) {
            return res.status(400).json({ success: false, message: 'Invalid payment verification' });
        }
    } else {
      console.log(`[Escrow] 💵 Ride booked via Cash. Commission debt will be settled at completion.`);
    }

    const driverEarnings = Math.floor(originalFare * 0.8);

    // STEP 7 — ATOMIC seat decrement + booking creation
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        seatsAvailable: { $gte: 1 },
        status: 'available'
      },
      {
        $inc: { seatsAvailable: -1 },
        $push: {
          bookings: {
            passenger: req.user._id,
            status: 'confirmed',
            boardingPoint: { address: ride.from, coordinates: ride.fromCoordinates.coordinates },
            dropoffPoint: { address: dropoffAddress || ride.to, coordinates: dropoffCoordinates },
            fareCharged,
            systemSubsidy,
            totalDriverEarnings: driverEarnings, 
            paymentMethod: paymentMethod || 'cash',
            bookedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!updatedRide) {
      return res.status(400).json({ success: false, message: 'No seats available' });
    }

    // STEP 8 — If seats now 0, mark ride as full
    if (updatedRide.seatsAvailable === 0) {
      await Ride.findByIdAndUpdate(rideId, { status: 'full' });
    }

    // STEP 9 — Create Notification for Driver
    await Notification.create({
      user: ride.driver,
      type: 'NEW_BOOKING',
      title: 'New Booking!',
      message: `${req.user.name} has joined your ride to ${ride.to}`,
      rideId: ride._id,
      passengerId: req.user._id
    });

    // STEP 10 — Real Time Updates
    socketManager.emitToRide(rideId, 'seat_updated', {
        rideId,
        seatsAvailable: updatedRide.seatsAvailable,
        totalSeats: ride.seatsAvailable + ride.bookings.length // Approximate 
    });

    socketManager.emitToUser(ride.driver, 'new_booking_received', {
        rideId: ride._id,
        passengerName: req.user.name,
        passengerGender: req.user.gender,
        fareAmount: fareCharged,
        boardingPoint: ride.from
    });

    // Notify Admin Dashboard
    socketManager.emitToAdmin('new_booking_received', {
        rideId,
        passengerName: req.user.name,
        amountConsumed: fareCharged,
        paymentMethod: paymentMethod || 'cash'
    });

    // Also trigger global notification update for UI
    const unreadCount = await Notification.countDocuments({ user: ride.driver, isRead: false });
    socketManager.emitToUser(ride.driver, 'new_notification', {
        notification: {
            title: 'New Booking!',
            message: `${req.user.name} has joined your ride to ${ride.to}`,
            type: 'NEW_BOOKING',
            rideId: ride._id,
            createdAt: new Date()
        },
        unreadCount
    });

    res.status(201).json({
        success: true,
        message: 'Ride booked successfully',
        data: {
          fareCharged,
          paymentMethod: paymentMethod || 'cash',
          status: 'confirmed',
          seatsAvailable: updatedRide.seatsAvailable
        }
    });

  } catch (error) {
    console.error('Booking Error:', error.message);
    res.status(500).json({
        success: false,
        message: error.message
    });
  }
};

// @desc    Get current bookings for logged-in user
// @route   GET /api/bookings/my
// @access  Private
exports.getMyBookings = async (req, res) => {
  try {
    const rides = await Ride.find({
      'bookings': {
        $elemMatch: {
          passenger: req.user._id,
          status: 'confirmed'
        }
      }
    })
    .populate('driver', 'name averageRating isVerified profilePhoto phone')
    .select('from to date time carModel carNumber price seatsAvailable status bookings driver')
    .lean();

    const myBookings = await Promise.all(rides.map(async ride => {
      const myBooking = ride.bookings.find(
        b => b.passenger.toString() === req.user._id.toString() && b.status === 'confirmed'
      );

      // Check if this user has already reviewed this ride
      const Review = mongoose.model('Review');
      const hasReviewed = await Review.exists({
        reviewer: req.user._id,
        rideId: ride._id
      });

      return {
        ride: {
          _id: ride._id,
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          carModel: ride.carModel,
          carNumber: ride.carNumber,
          status: ride.status,
          driver: ride.driver
        },
        booking: {
          ...myBooking,
          isReviewed: !!hasReviewed
        }
      };
    }));

    res.status(200).json({
      success: true,
      data: myBookings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel booking
// @route   DELETE /api/bookings/:rideId
// @access  Private
exports.cancelBooking = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Check if ride has already started
    const now = new Date();
    const departureTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}`);

    if (now >= departureTime) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel after ride has already started'
      });
    }

    // ATOMIC cancellation + seat restore
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        'bookings.passenger': req.user._id,
        'bookings.status': 'confirmed'
      },
      {
        $inc: { seatsAvailable: 1 },
        $set: { 'bookings.$.status': 'cancelled' }
      },
      { new: true }
    );

    if (!updatedRide) {
      return res.status(404).json({
        success: false,
        message: 'Active booking not found for this ride'
      });
    }

    // If ride was full before, set back to available
    if (updatedRide.status === 'full') {
      await Ride.findByIdAndUpdate(rideId, {
        status: 'available'
      });
    }

    // STEP 6 — Escrow Refund Logic (TREASURY RELEASE)
    // We fetch the ride AGAIN to be absolutely sure we have the correct booking state
    const rideWithBooking = await Ride.findById(rideId);
    const userBooking = rideWithBooking?.bookings.find(b => b.passenger.toString() === req.user._id.toString());
    
    if (userBooking && (userBooking.paymentMethod === 'online' || userBooking.paymentMethod === 'wallet')) {
       console.log(`[Escrow] 🔄 Initializing Release: ₹${userBooking.fareCharged} (${userBooking.paymentMethod}) for Passenger ${req.user.name}`);
       
       const admin = await User.findOne({ role: 'admin' });
       const refundAmount = userBooking.fareCharged || 0;

       if (refundAmount > 0) {
          // 1. Credit Passenger Wallet
          const passenger = await User.findById(req.user._id);
          if (passenger) {
             passenger.walletBalance += refundAmount;
             await passenger.save();
             
             await Transaction.create({
               userId: passenger._id,
               type: 'REFUND',
               amount: refundAmount,
               rideId: ride._id,
               description: `Refund - Cancelled ride to ${ride.to}`
             });
          }
          
          // 2. Debit Admin Wallet (Release from Escrow)
          if (admin) {
             admin.walletBalance -= refundAmount;
             await admin.save();
             
             await Transaction.create({
               userId: admin._id,
               type: 'ESCROW_RELEASE',
               amount: -refundAmount,
               rideId: ride._id,
               description: `Escrow Release: Refunded ₹${refundAmount} to Passenger ${passenger?.name || 'User'}`,
               metadata: {
                  event: 'CANCELLATION',
                  originalHoldAmount: refundAmount,
                  refundRecipient: passenger?._id
               }
             });
             console.log(`[Escrow] ✅ Synergy Ledger Updated: ESCROW_RELEASE recorded for admin.`);
          }
       } else {
          console.log(`[Escrow] ℹ️ Skipping Release: fareCharged was 0.`);
       }
    } else {
       console.log(`[Escrow] ℹ️ No refund required for this booking method or booking not found.`);
    }

    // STEP 7 — Notify Driver
    await Notification.create({
      user: ride.driver,
      type: 'BOOKING_CANCELLED',
      title: 'Booking Cancelled',
      message: `${req.user.name} cancelled their booking for your ride to ${ride.to}`,
      rideId: ride._id,
      passengerId: req.user._id
    });

    // STEP 8 — Real Time Updates
    socketManager.emitToRide(rideId, 'seat_updated', {
        rideId,
        seatsAvailable: updatedRide.seatsAvailable,
        totalSeats: ride.seatsAvailable + ride.bookings.length // Approximate
    });

    const unreadCount = await Notification.countDocuments({ user: ride.driver, isRead: false });
    socketManager.emitToUser(ride.driver, 'new_notification', {
        notification: {
            title: 'Booking Cancelled',
            message: `${req.user.name} cancelled their booking for your ride to ${ride.to}`,
            type: 'BOOKING_CANCELLED',
            rideId: ride._id,
            createdAt: new Date()
        },
        unreadCount
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get passenger list (driver only)
// @route   GET /api/bookings/ride/:rideId
// @access  Private (Driver)
exports.getPassengerList = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId)
      .populate('bookings.passenger', 'name gender averageRating isVerified profilePhoto phone');

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Only driver can access this
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the ride driver can view passengers'
      });
    }

    const confirmedPassengers = ride.bookings
      .filter(b => b.status === 'confirmed')
      .map(b => {
          // Mask Aadhaar would go here if it was on the passenger model in this populate
          // but we already mask sensitive data in user model or manually
          return b;
      });

    res.status(200).json({
      success: true,
      data: confirmedPassengers,
      totalPassengers: confirmedPassengers.length,
      seatsRemaining: ride.seatsAvailable
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
