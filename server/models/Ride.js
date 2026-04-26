const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  from: {
    type: String,
    required: [true, 'Pickup location is required'],
    trim: true
  },
  to: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true
  },
  fromCoordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  toCoordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  routePoints: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString'
    },
    coordinates: {
      type: [[Number]], // array of [lng, lat] pairs
      default: []
    }
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  time: {
    type: String,
    required: [true, 'Time is required']
  },
  seatsAvailable: {
    type: Number,
    required: [true, 'Number of available seats is required'],
    min: [0, 'Available seats cannot be negative']
  },
  vehicleType: {
    type: String,
    enum: ['Car', 'Bike'],
    default: 'Car'
  },
  carModel: {
    type: String,
    required: [true, 'Vehicle Model is required']
  },
  carNumber: {
    type: String,
    required: [true, 'Vehicle Number is required'],
    uppercase: true
  },
  price: {
    type: Number,
    required: [true, 'Price per seat is required'],
    min: [0, 'Price cannot be negative']
  },
  genderPreference: {
    type: String,
    enum: ['any', 'male-only', 'female-only'],
    default: 'any'
  },
  driverGender: {
    type: String,
    enum: ['male', 'female']
  },
  expiresAt: {
    type: Date
  },
  waitingTime: {
    type: Number,
    default: 10  // minutes after departure time
  },
  status: {
    type: String,
    enum: ['available', 'full', 'ongoing', 'completed', 'cancelled'],
    default: 'available'
  },
  simplifiedFrom: {
    type: String,
    trim: true,
    index: true
  },
  simplifiedTo: {
    type: String,
    trim: true,
    index: true
  },
  routePointsStatus: {
    type: String,
    enum: ['pending', 'saved', 'failed'],
    default: 'saved'
  },
  bookings: [{
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed'
    },
    boardingPoint: {
      address:     { type: String, default: '' },
      coordinates: { type: [Number], default: [] }
    },
    dropoffPoint: {
      address:     { type: String, default: '' },
      coordinates: { type: [Number], default: [] }
    },
    fareCharged: {
      type: Number,
      default: 0
    },
    systemSubsidy: {
      type: Number,
      default: 0
    },
    totalDriverEarnings: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'online', 'wallet'],
      default: 'cash'
    },
    bookedAt: {
      type: Date,
      default: Date.now
    },
    wasAffected: {
      type: Boolean,
      default: false
    },
    priorityBadgeGiven: {
      type: Boolean,
      default: false
    },
    alternativesShown: {
      type: Boolean,
      default: false
    },
    // OTP Fields - NEW
    otp: { type: String, default: null },
    otpVerified: { type: Boolean, default: false },
    otpVerifiedAt: { type: Date, default: null },
    otpGeneratedAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLocked: { type: Boolean, default: false },
    boardingStatus: {
      type: String,
      enum: ['arrived', 'not_arrived', 'pending'],
      default: 'pending'
    },
    moneyReleased: { type: Boolean, default: false },
    refundProcessed: { type: Boolean, default: false },
    // Safe Dropoff Fields
    dropoffStatus: {
      type: String,
      enum: ['pending', 'dropped', 'confirmed', 'disputed', 'auto_released', 'refunded'],
      default: 'pending'
    },
    driverDroppedAt: { type: Date, default: null },
    passengerConfirmedAt: { type: Date, default: null },
    autoReleaseAt: { type: Date, default: null },
    fareReleased: { type: Boolean, default: false },
    disputeRaised: { type: Boolean, default: false },
    disputeRaisedAt: { type: Date, default: null }
  }],
  boardingStartedAt: { type: Date, default: null },
  journeyStartedAt: { type: Date, default: null },
  markedArrivedAt: { type: Date, default: null },
  markArrivedAvailableAt: { type: Date },
  cancellationReason: {
    type: String
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  noShowReports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  wasAffectedByCancel: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for fast GPS-based location search
rideSchema.index({ routePoints:      '2dsphere' });
rideSchema.index({ fromCoordinates:  '2dsphere' });
rideSchema.index({ toCoordinates:    '2dsphere' });
rideSchema.index({ from: 'text', to: 'text' });
rideSchema.index({ status: 1, date: 1 });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ status: 1, expiresAt: 1, driverGender: 1 });
rideSchema.index({ status: 1, expiresAt: 1 });
rideSchema.index({ status: 1, date: 1, time: 1 });
rideSchema.index({ 'bookings.passenger': 1 });

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;
