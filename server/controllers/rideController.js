const Ride = require('../models/Ride');
const User = require('../models/User');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { haversineDistance, calculatePartialFare } = require('../utils/fareHelper');
const socketManager = require('../utils/socketManager');

// @desc    Complete a ride (Driver only)
// @route   PATCH /api/rides/:id/complete
// @access  Private (Driver)
exports.completeRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (ride.status === 'completed') return res.status(400).json({ success: false, message: 'Ride already completed' });
    if (ride.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot complete a cancelled ride' });

    // JUSTICE SYSTEM CHECK: If majority reported No-Show, driver is blocked from completing
    const confirmedCount = ride.bookings.filter(b => b.status === 'confirmed').length;
    if (confirmedCount > 0 && ride.noShowReports.length > confirmedCount / 2) {
       return res.status(403).json({ 
         success: false, 
         message: 'Critical: The majority of confirmed passengers reported your absence at the pickup point. You are blocked from completing this ride, and your account has been flagged.' 
       });
    }

    // Departure Time Validation: Cannot complete ride before it even starts
    // Construct local departure time matching the creation logic in offerRide
    const dateStr = ride.date.toISOString().split('T')[0];
    const departureDate = new Date(`${dateStr}T${ride.time}`);
    const now = new Date();
    
    if (now < new Date(departureDate.getTime() - 5 * 60 * 1000)) {
       return res.status(400).json({ 
         success: false, 
         message: `Safety Protocol: You cannot mark the journey as completed before the departure time (${ride.time}).` 
       });
    }

    // 1. UPDATE RIDE STATUS
    ride.status = 'completed';
    await ride.save();

    // 2. ESCROW DISTRIBUTION: Release funds to Rider and Platform
    const confirmedBookings = ride.bookings.filter(b => b.status === 'confirmed');
    const admin = await User.findOne({ role: 'admin' });
    let totalRiderBalanceChange = 0;
    let totalAdminBalanceChange = 0;
    const transactions = [];

    for (const booking of confirmedBookings) {
      const riderCut = booking.totalDriverEarnings; // 80% of original fare
      const originalFare = Math.round(riderCut / 0.8);
      const commission = Math.round(originalFare * 0.2); // Platform's gross cut
      const subsidy = originalFare - (booking.fareCharged || 0); // Amount paid by system (if any)

      if (booking.paymentMethod === 'online') {
          // Admin already holds total fare from ESCROW_HOLD during booking
          totalRiderBalanceChange += riderCut;
          totalAdminBalanceChange -= riderCut;

          // Transactions for audit trail
          transactions.push({
            userId: req.user._id,
            type: 'RIDE_EARNING',
            amount: riderCut,
            rideId: ride._id,
            description: `Ride Earnings (Online) - ${ride.to}`
          });

          if (admin) {
             // 1. Release the full held amount from escrow visibility
             transactions.push({
               userId: admin._id,
               type: 'ESCROW_RELEASE',
               amount: -booking.fareCharged,
               rideId: ride._id,
               description: `Escrow Released: Ride to ${ride.to}`
             });
             // 2. Recognize Gross Commission
             transactions.push({
               userId: admin._id,
               type: 'COMMISSION',
               amount: commission,
               rideId: ride._id,
               description: `Platform Gross Commission - Ride ${ride._id}`
             });
             // 3. Recognize Subsidy Expense (if applicable)
             if (subsidy > 0) {
                transactions.push({
                  userId: admin._id,
                  type: 'SUBSIDY',
                  amount: -subsidy,
                  rideId: ride._id,
                  description: `Justice Subsidy - Ride ${ride._id}`
                });
             }
          }
      } else {
          // CASH PAYMENT: Rider has full cash, they owe netCommission (commission - subsidy)
          const netCommission = commission - subsidy;
          totalRiderBalanceChange -= netCommission; 
          totalAdminBalanceChange += netCommission;

          // Driver's account is adjusted for the platform's cut
          transactions.push({
             userId: req.user._id,
             type: 'RIDE_EARNING',
             amount: 0,
             rideId: ride._id,
             description: `Fare Collected (Cash) - ₹${originalFare}`
          });

          transactions.push({
            userId: req.user._id,
            type: 'COMMISSION',
            amount: -netCommission,
            rideId: ride._id,
            description: `Platform Commission Share - Ride ${ride._id}`
          });

          if (admin) {
            // Admin sees the breakdown
            transactions.push({
               userId: admin._id,
               type: 'COMMISSION',
               amount: commission,
               rideId: ride._id,
               description: `Platform Gross Commission (Cash) - Ride ${ride._id}`
            });
            if (subsidy > 0) {
               transactions.push({
                 userId: admin._id,
                 type: 'SUBSIDY',
                 amount: -subsidy,
                 rideId: ride._id,
                 description: `Justice Subsidy (Cash Ride) - Ride ${ride._id}`
               });
            }
          }
      }
    }

    // Update Rider (Driver) Wallet & Stats
    req.user.walletBalance += totalRiderBalanceChange;
    req.user.totalCompletedRides += 1;
    req.user.trustScore = Math.min(200, req.user.trustScore + 5); 
    
    // Streak bonus: every 10 rides completion
    if (req.user.totalCompletedRides > 0 && req.user.totalCompletedRides % 10 === 0) {
       req.user.trustScore = Math.min(200, req.user.trustScore + 10);
    }
    
    await req.user.save();

    // Update Admin Wallet
    if (admin && totalAdminBalanceChange !== 0) {
       admin.walletBalance += totalAdminBalanceChange;
       await admin.save();
    }

    // 3. RECORD TRANSACTIONS
    if (transactions.length > 0) {
       await Transaction.insertMany(transactions);
       console.log(`[Escrow] 💵 Final Balance Adjustment: Rider ₹${totalRiderBalanceChange}, Admin ₹${totalAdminBalanceChange}`);
    }

    // 4. NOTIFY PASSENGERS: Prompt for feedback
    const notifications = ride.bookings
      .filter(b => b.status === 'confirmed')
      .map(b => ({
        user: b.passenger,
        type: 'FEEDBACK_REQUEST',
        title: 'Journey Finished! ⭐',
        message: `How was your ride with ${req.user.name}? Share your feedback to help the community.`,
        rideId: ride._id
      }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`[RideComplete] 🔔 Feedback requests sent to ${notifications.length} passengers.`);
    }

    console.log(`[RideComplete] ✅ Ride ${ride._id} completed by ${req.user._id}. Trust Score: ${req.user.trustScore}`);

    // 5. NOTIFY DRIVER (Self) about earnings/commissions
    // Notify Admin Dashboard
    socketManager.emitToAdmin('ride_completed', {
        rideId: ride._id,
        earningsReleased: totalAdminBalanceChange,
        message: `Ride ${ride._id.toString().slice(-6)} completed. Revenue sync'd.`
    });

    res.status(200).json({ 
      success: true, 
      message: completionMessage, 
      trustScore: req.user.trustScore,
      earned: totalRiderBalanceChange
    });

  } catch (error) {
    console.error(`[CompleteError] 💥: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// EDGE CASE 5 & 6: Address Simplification & Alias Dictionary
const CITY_ALIASES = {
  'vizag': 'visakhapatnam',
  'hyd': 'hyderabad',
  'blr': 'bangalore',
  'bengaluru': 'bangalore',
  'vja': 'vijayawada',
  'chennai': 'madras',
  'mumbai': 'bombay',
  'pune': 'poona',
  'gurgaon': 'gurugram'
};

const simplifyAddress = (text) => {
  if (!text) return "";
  // Clean text: remove pin codes (6 digits), country, state names, special chars
  let clean = text.toLowerCase()
    .replace(/\b\d{6}\b/g, '') // Pins
    .replace(/\b(india|andhra pradesh|telangana|karnataka|tamil nadu|maharashtra|uttar pradesh|delhi)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  
  // Replace aliases
  Object.keys(CITY_ALIASES).forEach(alias => {
    const reg = new RegExp(`\\b${alias}\\b`, 'g');
    clean = clean.replace(reg, CITY_ALIASES[alias]);
  });
  
  // Extract key words (first 3 important words)
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 3).join(' ');
};

// EDGE CASE 9: Background Nominatim Fallback
const getCoordsFromText = async (address) => {
  try {
     const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
     const res = await fetch(url, { 
       headers: { 'User-Agent': 'RaidDosthi-App' },
       signal: AbortSignal.timeout(3000)
     });
     const data = await res.json();
     if (data && data.length > 0) {
        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
     }
  } catch (err) {
     console.error(`[Nominatim Fallback] Error: ${err.message}`);
  }
  return null;
};

// Import OTP utils
const { generateOTP } = require('../utils/otpHelper');

// EDGE CASE 4: Background OSRM Retry Job
exports.startCronJobs = () => {
  console.log(`[Cron] 🕒 Initializing search hardening background tasks...`);
  
  // OSRM Recovery Job
  setInterval(async () => {
    try {
      const pendingRides = await Ride.find({ 
        routePointsStatus: 'pending',
        status: 'available',
        expiresAt: { $gt: new Date() }
      }).limit(5);

      if (pendingRides.length > 0) {
        console.log(`[Cron] Retrying OSRM for ${pendingRides.length} pending rides...`);
        for (const ride of pendingRides) {
           const points = await getRoutePoints(ride.fromCoordinates.coordinates, ride.toCoordinates.coordinates);
           if (points.length > 2) {
             ride.routePoints = { type: 'LineString', coordinates: points };
             ride.routePointsStatus = 'saved';
             await ride.save();
             console.log(`[Cron] ✅ RECOVERED: Ride ${ride._id} now has route points.`);
           }
        }
      }
    } catch (err) {
      console.error(`[Cron-OSRM] Error: ${err.message}`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // PART 3: OTP Generation Logic
  const generateOTPs = async () => {
    try {
      const now = new Date();
      const ridesToProcess = await Ride.find({
        status: { $in: ['available', 'full'] },
        'bookings': {
          $elemMatch: {
            status: 'confirmed',
            otp: null
          }
        }
      }).limit(100);

      for (const ride of ridesToProcess) {
          const dateStr = ride.date.toISOString().split('T')[0];
          const departureTime = new Date(`${dateStr}T${ride.time}`);
          const diffMinutes = (departureTime - now) / 60000;
          
          if (diffMinutes <= 15 && diffMinutes >= -15) {
              let changed = false;
              for (const booking of ride.bookings) {
                  if (booking.status === 'confirmed' && !booking.otp) {
                      booking.otp = generateOTP();
                      booking.otpGeneratedAt = now;
                      booking.boardingStatus = 'pending';
                      changed = true;
                      
                      await Notification.create({
                          user: booking.passenger,
                          type: 'OTP_READY',
                          title: '🔐 Your boarding OTP is ready!',
                          message: `Open My Bookings to view it. Valid from now until boarding closes.`,
                          rideId: ride._id
                      });

                      // Real Time Update
                      socketManager.emitToUser(booking.passenger, 'otp_ready', {
                          rideId: ride._id,
                          otp: booking.otp,
                          message: "Your boarding OTP is ready"
                      });
                  }
              }
              if (changed) {
                  ride.markArrivedAvailableAt = new Date(departureTime.getTime() + (ride.waitingTime || 10) * 60 * 1000);
                  ride.markModified('bookings');
                  await ride.save();
                  console.log(`[Cron-OTP] 🔐 Generated OTPs for Ride ${ride._id}`);
              }
          }
      }
    } catch (err) {
      console.error(`[Cron-OTP] Error: ${err.message}`);
    }
  };

  // PART 6: Automatic Refund Logic
  const processAutoRefunds = async () => {
    try {
      const now = new Date();
      const expiredRides = await Ride.find({
          status: { $in: ['available', 'full'] },
          markArrivedAvailableAt: { $lt: now },
          journeyStartedAt: null
      }).limit(100);

      if (expiredRides.length === 0) return;

      const admin = await User.findOne({ role: 'admin' });
      const { processMoneyRelease } = require('./otpController');

      for (const ride of expiredRides) {
          let processedCount = 0;
          for (const booking of ride.bookings) {
              if (booking.status === 'confirmed' && booking.boardingStatus === 'pending') {
                  booking.boardingStatus = 'not_arrived';
                  await processMoneyRelease(booking, ride, admin);
                  processedCount++;
              }
          }
          if (processedCount > 0) {
              ride.markModified('bookings');
              await ride.save();
              console.log(`[Cron-Refund] 🔄 Processed ${processedCount} auto-refunds for Ride ${ride._id}`);
              
              // Real Time Update
              socketManager.emitToRide(ride._id, 'ride_expired', {
                  rideId: ride._id,
                  message: "This ride has expired"
              });
          }
      }
    } catch (err) {
      console.error(`[Cron-Refund] Error: ${err.message}`);
    }
  };

  // PART 5: Auto Release Cron Job
  const processAutoRelease = async () => {
    try {
      const now = new Date();
      // Find rides that have bookings in 'dropped' status waiting for auto-release
      const ridesToProcess = await Ride.find({
        status: 'ongoing',
        'bookings': {
          $elemMatch: {
            dropoffStatus: 'dropped',
            fareReleased: false,
            disputeRaised: false,
            autoReleaseAt: { $lt: now }
          }
        }
      }).limit(100);

      if (ridesToProcess.length === 0) return;

      const { releaseFareToDriver } = require('./dropoffController');

      for (const ride of ridesToProcess) {
          let processedCount = 0;
          for (const booking of ride.bookings) {
              if (booking.dropoffStatus === 'dropped' && 
                  !booking.fareReleased && 
                  !booking.disputeRaised && 
                  booking.autoReleaseAt < now) {
                  
                  await releaseFareToDriver(booking, ride, 'auto');
                  booking.dropoffStatus = 'auto_released';
                  processedCount++;

                  // Notify Passenger
                  await Notification.create({
                    user: booking.passenger,
                    type: 'RIDE_MISSED', // Reuse appropriate type or use JOURNEY_STARTED
                    title: '⏰ Payment Auto-Released',
                    message: `Auto release: Your confirmation window passed. Fare released to your driver.`,
                    rideId: ride._id
                  });
              }
          }
          if (processedCount > 0) {
              ride.markModified('bookings');
              await ride.save();
              console.log(`[Cron-Dropoff] ⏰ Auto-released ${processedCount} fares for Ride ${ride._id}`);
          }
      }
    } catch (err) {
      console.error(`[Cron-Dropoff] Error: ${err.message}`);
    }
  };

  // Run immediately on boot
  generateOTPs();
  processAutoRefunds();
  processAutoRelease();

  // Set intervals: Switched to 10s for OTPs for higher sensitivity
  setInterval(generateOTPs, 10 * 1000);
  setInterval(processAutoRefunds, 60 * 1000);
  setInterval(processAutoRelease, 60 * 1000);
};

// Helper: Get route from OSRM (completely free, no API key)
const getRoutePoints = async (fromCoords, toCoords) => {
  try {
    if (!fromCoords || fromCoords.length < 2 || !toCoords || toCoords.length < 2) {
      return [];
    }
    // alternatives=true finds all main highway options (e.g. AH45 vs NH48)
    const url =
      `http://router.project-osrm.org/route/v1/driving/` +
      `${fromCoords[0]},${fromCoords[1]};` +
      `${toCoords[0]},${toCoords[1]}` +
      `?overview=full&geometries=geojson&alternatives=true`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data     = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.log(`[OSRM] ❌ FAILED: No routes found for ${fromCoords} to ${toCoords}`);
      return [fromCoords, toCoords];
    }
    
    console.log(`[OSRM] ✅ SUCCESS: Found ${data.routes.length} highway options.`);
    const allRoutesKeyPoints = [];

    // Extract sampled points from ALL returned routes
    data.routes.forEach((route, index) => {
      const allPoints = route.geometry.coordinates;
      let sampled = [];
      // Increase sampling to 100 points per route for better 20km sphere matching
      if (allPoints.length <= 100) {
        sampled = allPoints;
      } else {
        const step = Math.floor(allPoints.length / 100);
        sampled = allPoints.filter((_, i) => i % step === 0);
      }
      allRoutesKeyPoints.push(...sampled);
      console.log(`[OSRM] Route ${index + 1}: Sampled ${sampled.length} points.`);
    });

    // Add explicit start/end to be safe
    allRoutesKeyPoints.unshift(fromCoords);
    allRoutesKeyPoints.push(toCoords);

    return allRoutesKeyPoints;
  } catch (error) {
    console.error(`[OSRM] API Critical Error: ${error.message} (Is the network or OSRM service down?)`);
    return [fromCoords, toCoords];
  }
};

// @desc    Offer a new ride
// @route   POST /api/rides/offer
// @access  Private (Driver)
exports.offerRide = async (req, res) => {
  try {
    let { from, to, date, time, seatsAvailable, carModel, carNumber, price, fromCoordinates, toCoordinates, waitingTime, genderPreference, vehicleType } = req.body;
    // RESTRICTION CHECK (Phase 4)
    if (req.user.restrictedUntil && new Date(req.user.restrictedUntil) > new Date()) {
       return res.status(403).json({ 
         success: false, 
         message: `Your account is restricted until ${new Date(req.user.restrictedUntil).toLocaleString()} due to past cancellations or no-show reports.` 
       });
    }

    // EDGE CASE 12: Driver Gender Validation
    const driverGender = req.user.gender;
    if (!driverGender) {
       throw new Error("Safety Protocol Error: Driver gender must be verified before offering a ride.");
    }

    // GENDER LOCKS
    if (driverGender === 'female') {
      genderPreference = 'female-only';
    } else {
      // For male drivers, only allow 'male-only' or 'any'
      if (!['male-only', 'any'].includes(genderPreference)) {
        genderPreference = 'male-only'; 
      }
    }

    // STEP 3 — Calculate expiresAt
    const departureDateTime = new Date(`${date}T${time}`);
    const wTime = waitingTime || 10;
    const expiresAt = new Date(departureDateTime.getTime() + wTime * 60 * 1000);

    // EDGE CASE 3 & 9: Coordinate Validation & Fallback
    let fCoords = (fromCoordinates && Array.isArray(fromCoordinates) && fromCoordinates.length === 2 && !fromCoordinates.includes(0)) ? fromCoordinates : null;
    let tCoords = (toCoordinates && Array.isArray(toCoordinates) && toCoordinates.length === 2 && !toCoordinates.includes(0)) ? toCoordinates : null;

    // Background Geocoding if missing
    if (!fCoords) fCoords = await getCoordsFromText(from) || [0,0];
    if (!tCoords) tCoords = await getCoordsFromText(to) || [0,0];

    // OSRM Call with Status Track (Requirement: Valid LineString for 2dsphere)
    let rPoints = [fCoords, tCoords]; 
    let rStatus = 'pending';
    if (fCoords[0] !== 0 && tCoords[0] !== 0) {
       const points = await getRoutePoints(fCoords, tCoords);
       if (points && points.length >= 2) {
         rPoints = points;
         rStatus = 'saved';
       }
    }

    const ride = await Ride.create({
      driver: req.user._id,
      from,
      to,
      simplifiedFrom: simplifyAddress(from),
      simplifiedTo: simplifyAddress(to),
      fromCoordinates: { type: 'Point', coordinates: fCoords },
      toCoordinates: { type: 'Point', coordinates: tCoords },
      routePoints: { type: 'LineString', coordinates: rPoints },
      routePointsStatus: rStatus,
      date,
      time,
      seatsAvailable,
      carModel,
      carNumber,
      price,
      genderPreference,
      driverGender,
      expiresAt,
      waitingTime: wTime,
      vehicleType: vehicleType || 'Car',
      bookings: []
    });

    // 1. Respond INSTANTLY to the user
    res.status(201).json({
      success: true,
      message: "Ride offer created! We are optimizing your route in the background.",
      data: ride
    });

    // 2. Perform heavy OSRM calculation in the BACKGROUND
    if (fCoords[0] !== 0 && tCoords[0] !== 0 && rStatus === 'pending') {
       // We don't 'await' this so the function finishes and sends the response immediately
       getRoutePoints(fCoords, tCoords).then(async (points) => {
          if (points && points.length > 2) {
             ride.routePoints = { type: 'LineString', coordinates: points };
             ride.routePointsStatus = 'saved';
             await ride.save();
             console.log(`[Background-OSRM] ✅ Route optimized for Ride ${ride._id}`);
          }
       }).catch(err => console.error(`[Background-OSRM] ❌ Failed: ${err.message}`));
    }
  } catch (error) {
    console.error(`[RideOffer] ❌ FAILED: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all available rides (Smart GPS Search)
// @route   GET /api/rides
// @access  Private
exports.getAllRides = async (req, res) => {
  try {
    // Who is searching? (Logging)
    const passengerId = req.user._id;
    const passengerGender = req.user.gender;
    console.log(`[RideSearch] 🔍 SEARCH START: User ${passengerId} (${passengerGender})`);

    // EDGE CASE 15: Parameter Validation & Parsing
    let { 
      from, to, date, 
      passengerLat, passengerLng, 
      destinationLat, destinationLng,
      vehicleType 
    } = req.query;

    const pLat = parseFloat(passengerLat);
    const pLng = parseFloat(passengerLng);
    const dLat = parseFloat(destinationLat);
    const dLng = parseFloat(destinationLng);

    const hasSourceGPS = !isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0;
    const hasDestGPS = !isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0;

    // EDGE CASE 13: Strict Expiry Filter
    let query = { 
      status: 'available', 
      seatsAvailable: { $gt: 0 },
      expiresAt: { $gt: new Date() } // Hard filter for expiry
    };

    if (vehicleType) {
        query.vehicleType = vehicleType;
    }

    // EDGE CASE 1: Date Filter (Flexible)
    // If no date is provided, we don't add query.date, showing all future rides.
    if (date && date !== 'null' && date !== 'undefined' && date.trim() !== '') {
        const searchDate = new Date(date);
        const startOfDay = new Date(searchDate.setHours(0,0,0,0));
        const endOfDay = new Date(searchDate.setHours(23,59,59,999));
        query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    // EDGE CASE 12 & Safety
    const genderQuery = passengerGender === 'male'
      ? { genderPreference: { $in: ['any', 'male-only'] } }
      : { genderPreference: { $in: ['any', 'female-only'] } };

    console.log(`[RideSearch] Params: from="${from}", to="${to}", date="${date}"`);
    if (hasSourceGPS) console.log(`[RideSearch] GPS: [${pLng}, ${pLat}] -> [${dLng}, ${dLat}]`);

    // We will collect candidate rides from 3 different methods to ensure NO ride is missed
    let CandidatePool = [];

    // METHOD A: Smart GPS Radar (Passes through Source + Passes through Destination)
    if (hasSourceGPS && hasDestGPS) {
      console.log(`[RideSearch] Phase A: GPS Smart Search active (Route Intercept Mode).`);
      const sourceCoords = [pLng, pLat];
      const destCoords = [dLng, dLat];

      // Boarding Radius: Find rides that pass within 35km of passenger
      const gpsCandidates = await Ride.find({
        ...query,
        ...genderQuery,
        routePoints: {
          $near: {
            $geometry: { type: 'Point', coordinates: sourceCoords },
            $maxDistance: 35000 
          }
        }
      })
      .populate('driver', 'name averageRating trustScore isVerified profilePhoto gender')
      .select('from to date time seatsAvailable price driverGender genderPreference status expiresAt driver fromCoordinates toCoordinates routePoints routePointsStatus bookings vehicleType carModel carNumber')
      .lean();

      // Filter by: 1. Passes near Destination, 2. Source is before Destination in route
      const matchedByGPS = gpsCandidates.filter(ride => {
        const rPoints = (ride.routePointsStatus === 'saved' && ride.routePoints?.coordinates?.length >= 2)
          ? ride.routePoints.coordinates
          : [ride.fromCoordinates.coordinates, ride.toCoordinates.coordinates];
        
        // EDGE CASE 7: 10km Tolerance (Safer for large city bypasses)
        const TOLERANCE = 10.0; 
        
        let foundSourceIdx = -1;
        let foundDestIdx = -1;
        let minSourceDist = Infinity;
        let minDestDist = Infinity;

        for (let i = 0; i < rPoints.length; i++) {
           const p = rPoints[i];
           const dSrc = haversineDistance(p, sourceCoords);
           const dDst = haversineDistance(p, destCoords);

           if (dSrc <= TOLERANCE && dSrc < minSourceDist) {
              minSourceDist = dSrc;
              foundSourceIdx = i;
           }
           if (dDst <= TOLERANCE && dDst < minDestDist) {
              minDestDist = dDst;
              foundDestIdx = i;
           }
        }

        // If direct point match failed, try segment matching for better resolution
        if (foundSourceIdx === -1 || foundDestIdx === -1) {
           for (let i = 0; i < rPoints.length - 1; i++) {
              const start = rPoints[i];
              const end = rPoints[i+1];
              const dTotal = haversineDistance(start, end);
              if (dTotal === 0) continue;

              // Source Segment Check
              if (foundSourceIdx === -1) {
                const s1 = haversineDistance(start, sourceCoords);
                const s2 = haversineDistance(end, sourceCoords);
                const detourS = (s1 + s2) - dTotal;
                // 1.5km detour tolerance for 5km perpendicular sphere
                if (detourS <= 1.5) {
                   const s = (s1 + s2 + dTotal) / 2;
                   const tempArea = s * (s - s1) * (s - s2) * (s - dTotal);
                   const area = tempArea > 0 ? Math.sqrt(tempArea) : 0;
                   const perpS = (2 * area) / dTotal;
                   if (perpS <= TOLERANCE) foundSourceIdx = i;
                }
              }

              // Destination Segment Check
              if (foundDestIdx === -1) {
                const d1 = haversineDistance(start, destCoords);
                const d2 = haversineDistance(end, destCoords);
                const detourD = (d1 + d2) - dTotal;
                if (detourD <= 1.5) {
                   const s = (d1 + d2 + dTotal) / 2;
                   const tempArea = s * (s - d1) * (s - d2) * (s - dTotal);
                   const area = tempArea > 0 ? Math.sqrt(tempArea) : 0;
                   const perpD = (2 * area) / dTotal;
                   if (perpD <= TOLERANCE) foundDestIdx = i;
                }
              }
           }
        }

        // SUCCESS condition: SOURCE is before DESTINATION in route sequence
        const matched = (foundSourceIdx !== -1 && foundDestIdx !== -1 && foundSourceIdx <= foundDestIdx);
        if (matched) {
           console.log(`[RideSearch] ✅ ROUTE MATCH: Ride ${ride._id} passes through both points (Order: ${foundSourceIdx}->${foundDestIdx})`);
        }
        return matched;
      });

      console.log(`[RideSearch] Phase A: Found ${matchedByGPS.length} matched routes.`);
      CandidatePool.push(...matchedByGPS);
    }

    // METHOD B: Text Semantic Match (Handle Edge Cases 5, 6, 8, 10)
    // We clean the input "to" and compare against simplifiedTo in DB
    if (to && to !== 'null' && to.trim() !== '') {
       console.log(`[RideSearch] Phase B: Text Match active.`);
       const cleanTo = simplifyAddress(to);
       const textCandidates = await Ride.find({
         ...query,
         ...genderQuery,
         $or: [
           { to: { $regex: cleanTo.split(' ')[0], $options: 'i' } }, // Fuzzy head word
           { simplifiedTo: { $regex: cleanTo, $options: 'i' } }
         ]
       })
       .populate('driver', 'name averageRating trustScore isVerified profilePhoto gender')
       .select('from to date time seatsAvailable price driverGender genderPreference status expiresAt driver fromCoordinates toCoordinates routePoints routePointsStatus bookings vehicleType carModel carNumber')
       .lean();

       console.log(`[RideSearch] Phase B: Found ${textCandidates.length} matches.`);
       CandidatePool.push(...textCandidates);
    }

    // EDGE CASE 10: Empty Search Browse All
    if (!to || to === 'null' || to.trim() === '') {
       console.log(`[RideSearch] Phase C: Destination empty - browsing all.`);
       const allAvailable = await Ride.find({ ...query, ...genderQuery })
         .populate('driver', 'name averageRating trustScore isVerified profilePhoto gender')
         .select('from to date time seatsAvailable price driverGender genderPreference status expiresAt driver fromCoordinates toCoordinates routePoints routePointsStatus bookings vehicleType carModel carNumber')
         .limit(50)
         .lean();
       CandidatePool.push(...allAvailable);
    }

    // EDGE CASE 11: Deduplication by ID
    const uniqueMap = new Map();
    CandidatePool.forEach(r => uniqueMap.set(r._id.toString(), r));
    const finalCandidates = Array.from(uniqueMap.values());

    console.log(`[RideSearch] 🏁 FINAL POOL: ${finalCandidates.length} unique rides found.`);

    // REAL JUSTICE BENEFITS: Logic for Priority Passengers
    const isPriorityUser = req.user.priorityBadgeExpires && new Date(req.user.priorityBadgeExpires) > new Date();

    let results = finalCandidates.map(ride => {
      // 1. Dynamic Fare Calculation
      let fare = ride.price;
      if (hasSourceGPS && hasDestGPS) {
        fare = calculatePartialFare(
          ride.fromCoordinates.coordinates,
          ride.toCoordinates.coordinates,
          [dLng, dLat],
          ride.price
        );
        // Safety Cap & Min
        if (fare > ride.price) fare = ride.price;
        if (fare < 10) fare = 10;
      }

      // 2. REAL BENEFIT: Justice Discount (10% OFF for victims of cancellations)
      const originalFare = fare;
      if (isPriorityUser) {
        fare = Math.floor(fare * 0.9); // 10% Discount
      }

      const confirmed = (ride.bookings || []).filter(b => b.status === 'confirmed');
      const breakdown = {
        male: confirmed.filter(b => b.passenger?.gender === 'male').length,
        female: confirmed.filter(b => b.passenger?.gender === 'female').length
      };

      const dist = hasSourceGPS ? haversineDistance([pLng, pLat], ride.fromCoordinates.coordinates).toFixed(1) : "?";

      // 3. REAL BENEFIT: Priority Match (Identifying top 10% of drivers)
      const isPriorityMatch = isPriorityUser && (ride.driver?.trustScore >= 90);

      const rideObj = ride;

      // Mask driver sensitive info
      if (rideObj.driver) {
          delete rideObj.driver.phone;
          delete rideObj.driver.licenseNumber;
          delete rideObj.driver.aadhaarNumber;
      }

      // REDACT PASSENGER DETAILS: Browsing searchers should see NO sensitive passenger info
      rideObj.bookings = (rideObj.bookings || []).map(booking => {
          return {
              _id: booking._id,
              status: booking.status,
              // We don't populate passenger in search results, but we MUST remove points
              // boardingPoint & dropoffPoint & fareCharged are EXCLUDED
          };
      });

      return {
        ...rideObj,
        passengerBreakdown: breakdown,
        bookingDetails: {
          totalBooked: confirmed.length,
          fareForPassenger: fare,
          originalFare: originalFare,
          distanceToRider: hasSourceGPS ? `${dist} km away` : "Unknown dist",
          isPriorityMatch,
          justiceDiscountApplied: isPriorityUser
        },
        dynamicFare: fare
      };
    });

    // 4. REAL BENEFIT: Priority Ranking (Sort Elite Drivers to the top for Priority Users)
    if (isPriorityUser) {
      results.sort((a, b) => {
        if (a.bookingDetails.isPriorityMatch && !b.bookingDetails.isPriorityMatch) return -1;
        if (!a.bookingDetails.isPriorityMatch && b.bookingDetails.isPriorityMatch) return 1;
        return 0;
      });
    }

    return res.status(200).json({ success: true, count: results.length, data: results });

  } catch (error) {
    console.error(`[RideSearch] 💥 CRITICAL ERROR: ${error.message}`);
    res.status(500).json({ success: false, message: "Search Protocol Error: Please try using map pin drop for best results." });
  }
};

// @desc    Get single ride details with safety data
// @route   GET /api/rides/:id
// @access  Private
exports.getRideById = async (req, res) => {
  try {
    const { passengerLat, passengerLng, destinationLat, destinationLng } = req.query;

    // Ensure deep population of bookings
    const ride = await Ride.findById(req.params.id)
      .populate('driver', 'name gender phone avatar isVerified licenseNumber aadhaarNumber averageRating totalRatings profilePhoto')
      .populate('bookings.passenger', 'name gender avatar phone averageRating isVerified profilePhoto');
    
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    // Mask sensitive data for privacy
    if (ride.driver && ride.driver.aadhaarNumber) {
        const aadh = ride.driver.aadhaarNumber;
        ride.driver.aadhaarNumber = `XXXX-XXXX-${aadh.slice(-4)}`;
    }

    const confirmed = (ride.bookings || []).filter(b => b.status === 'confirmed');
    const breakdown = {
      male: confirmed.filter(b => b.passenger?.gender === 'male').length,
      female: confirmed.filter(b => b.passenger?.gender === 'female').length
    };

    const reviews = await Review.find({ subject: ride.driver._id })
      .populate('reviewer', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(5);

    // Dynamic Fare & Distance Logic
    let dynamicFare = ride.price;
    let distanceToRider = "Detecting...";
    
    // Safety Message
    let safetyMessage = "";
    if (ride.driverGender === 'female') {
       safetyMessage = "🛡️ Verified Female-only RAIDER";
    } else if (ride.genderPreference === 'male-only') {
       safetyMessage = "👥 ALL-MALE TRANSIT";
    } else {
       safetyMessage = "VERIFIED COMMUNITY PROTOCOL";
    }

    if (passengerLat && passengerLng && destinationLat && destinationLng) {
      const pDropoff = [parseFloat(destinationLng), parseFloat(destinationLat)];
      
      // LOGIC: Fare is calculated from RAIDER START to CUSTOMER DROP-OFF (midway)
      dynamicFare = calculatePartialFare(
        ride.fromCoordinates.coordinates, // Driver Origin
        ride.toCoordinates.coordinates,   // Driver Destination
        pDropoff,                         // Passenger Drop-off
        ride.price
      );
    }

    // REAL JUSTICE BENEFITS: Sync with search results
    const isPriorityUser = req.user.priorityBadgeExpires && new Date(req.user.priorityBadgeExpires) > new Date();
    const originalFare = dynamicFare;
    if (isPriorityUser) {
      dynamicFare = Math.floor(dynamicFare * 0.9);
    }
    const isPriorityMatch = isPriorityUser && (ride.driver?.trustScore >= 90);

    // --- PRIVACY PROTECTION LAYER ---
    const isDriver = ride.driver._id.toString() === req.user._id.toString();
    
    // Convert to plain object to modify
    const rideObj = ride.toObject();

    // Redact driver sensitive info for non-drivers
    if (!isDriver) {
        if (rideObj.driver) {
            delete rideObj.driver.phone;
            delete rideObj.driver.licenseNumber;
            // Aadhaar is already masked at the string level above if present
        }
    }

    // REDACT PASSENGER DETAILS for anyone who is NOT the driver
    rideObj.bookings = (rideObj.bookings || []).map(booking => {
        const isSelf = booking.passenger && booking.passenger._id.toString() === req.user._id.toString();
        
        // If not the driver and not the person who made the booking, redact almost everything
        if (!isDriver && !isSelf) {
            return {
                _id: booking._id,
                status: booking.status,
                passenger: {
                    _id: booking.passenger?._id,
                    name: booking.passenger?.name ? booking.passenger.name.split(' ')[0] : "Co-Rider",
                    avatar: booking.passenger?.avatar,
                    profilePhoto: booking.passenger?.profilePhoto,
                    gender: booking.passenger?.gender,
                    averageRating: booking.passenger?.averageRating,
                    isVerified: booking.passenger?.isVerified
                }
                // boardingPoint & dropoffPoint & phone are EXCLUDED
            };
        }
        return booking; // Driver gets full info, Passenger gets their own full info
    });

    return res.status(200).json({ 
      success: true, 
      data: {
        ...rideObj,
        passengerBreakdown: breakdown,
        driverReviews: reviews,
        dynamicFare,
        originalFare,
        safetyMessage,
        bookingDetails: {
           distanceToRider: "Calculating...",
           isPriorityMatch,
           originalFare: originalFare,
           justiceDiscountApplied: isPriorityUser
        }
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
// @desc    Get rides offered by current user
exports.getMyOffers = async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .sort({ createdAt: -1 })
      .populate('bookings.passenger', 'name gender profilePhoto');
    
    // Format rides with passenger counts and statuses
    const formattedRides = rides.map(ride => {
      const confirmed = ride.bookings.filter(b => b.status === 'confirmed');
      const totalPotentialEarnings = confirmed.reduce((sum, b) => sum + (b.totalDriverEarnings || b.fareCharged), 0);
      const totalSubsidyReceived = confirmed.reduce((sum, b) => sum + (b.systemSubsidy || 0), 0);

      const now = new Date();
      const departureTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}`);
      
      let computedStatus = ride.status;
      if (ride.status === 'available' || ride.status === 'full') {
        if (now > departureTime) computedStatus = 'expired';
      }

      return {
        ...ride.toObject(),
        computedStatus,
        totalBooked: confirmed.length,
        seatsRemaining: ride.seatsAvailable,
        totalPotentialEarnings,
        totalSubsidyReceived
      };
    });

    res.status(200).json({ success: true, count: formattedRides.length, data: formattedRides });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Cancel a ride (Driver only)
// @route   PATCH /api/rides/:id/cancel
// @access  Private (Driver)
exports.cancelRide = async (req, res) => {
  try {
    const { reason, otherReason } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    // Auth check
    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this ride' });
    }

    if (ride.status === 'cancelled' || ride.status === 'completed') {
      return res.status(400).json({ success: false, message: `Ride already ${ride.status}` });
    }

    const finalReason = reason === 'Other' ? otherReason : reason;
    if (!finalReason) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is mandatory' });
    }

    const now = new Date();
    const departureTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}`);
    const diffMinutes = (departureTime - now) / (1000 * 60);
    const confirmedBookings = ride.bookings.filter(b => b.status === 'confirmed');
    const hasBookings = confirmedBookings.length > 0;

    // 1. Automatic Yearly Reset & Load Rider
    const rider = await User.findById(ride.driver);
    const currentYear = new Date().getFullYear();
    const lastResetYear = rider.appealYearReset ? new Date(rider.appealYearReset).getFullYear() : null;
    
    if (lastResetYear !== currentYear) {
      rider.genuineClaimsThisYear = 0;
      rider.appealCount = 0;
      rider.appealYearReset = new Date();
      // We'll save rider at the end of the stats update
    }

    let penaltyType = 'none';
    let trustImpact = 0;
    let restrictionHours = 0;
    let emergencyMessage = "";

    if (hasBookings) {
      if (diffMinutes > 120) {
        // SCENARIO 1: > 2 hours
        penaltyType = 'none';
        trustImpact = 5; // -5 points for any cancellation with bookings
      } else if (diffMinutes >= 30) {
        // SCENARIO 2: 30 min - 2 hours
        penaltyType = 'warning';
        trustImpact = 5;
      } else {
        // SCENARIO 3: < 30 min
        penaltyType = 'strike';
        trustImpact = 15; // -15 points for late strike
        restrictionHours = 48; // Updated to 2 days
      }

      // Genuine Emergency exception (Edge Case 3) - MISSION UPGRADE
      if (['Medical emergency', 'Vehicle breakdown'].includes(reason)) {
        if (rider.genuineClaimsThisYear === 0) {
          penaltyType = 'none';
          trustImpact = 0;
          restrictionHours = 0;
          rider.genuineClaimsThisYear = 1;
          emergencyMessage = "First emergency claim accepted. No penalty applied.";
        } else if (rider.genuineClaimsThisYear === 1) {
          penaltyType = 'warning';
          trustImpact = 5;
          restrictionHours = 0;
          rider.genuineClaimsThisYear = 2;
          emergencyMessage = "This is your 2nd emergency claim this year. One more will result in full penalty.";
        } else {
          // 3rd claim onwards: Full penalty already calculated above persists
          emergencyMessage = "You have used all emergency claims for this year. Standard penalty has been applied.";
        }
      }
    }

    // Update Rider Stats
    rider.totalCancellations += 1;
    rider.trustScore = Math.max(0, rider.trustScore - trustImpact);

    if (penaltyType === 'warning') {
      rider.warnings += 1;
      if (rider.warnings >= 3) {
        restrictionHours = 48; // Updated to 2 days
        rider.warnings = 0; // Reset after suspension
      }
    } else if (penaltyType === 'strike') {
      rider.strikes += 1;
      rider.lastStrikeAt = new Date();
      if (rider.strikes === 1) restrictionHours = Math.max(restrictionHours, 48); // 2 Days
      else if (rider.strikes === 2) restrictionHours = 48; // 2 Days
      else if (rider.strikes === 3) restrictionHours = 48; // 2 Days
    }

    if (restrictionHours > 0) {
      const restrictedUntil = new Date(now.getTime() + restrictionHours * 60 * 60 * 1000);
      rider.restrictedUntil = restrictedUntil;
      rider.restrictionReason = penaltyType === 'strike' 
        ? `Late Cancellation Violation (Cancelled < 30m before departure)`
        : `System Warning Threshold (Reached 3 warnings for cancellations)`;
    }

    await rider.save();

    // Appeal System Context
    const appealInstructions = penaltyType === 'strike' ? {
      message: "A strike has been added to your profile. Believe this is unfair? Appeal within 48 hours by emailing support.raiddhosthi@gmail.com. Include: Email ID, Ride ID, and Reason.",
      canAppeal: rider.appealCount < 2,
      appealLimitReached: rider.appealCount >= 2,
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000)
    } : null;

    // Mark ride and bookings
    ride.status = 'cancelled';
    ride.cancellationReason = finalReason;
    ride.cancelledAt = now;
    ride.cancelledBy = req.user._id;
    ride.wasAffectedByCancel = hasBookings;

    const passengerIdsToNotify = confirmedBookings.map(b => b.passenger);
    
    ride.bookings.forEach(b => {
      if (b.status === 'confirmed') {
        b.status = 'cancelled';
        b.wasAffected = true;
        // Priority Badge for late cancellation (Scenario 3)
        if (diffMinutes < 30) {
           b.priorityBadgeGiven = true;
        }
      }
    });

    await ride.save();

    // Give Priority Badges, Handle Refunds and Notify Passengers
    await Promise.all(ride.bookings.map(async (b) => {
      if (b.status === 'confirmed' || b.wasAffected) {
        let passUser = await User.findById(b.passenger);
        if (!passUser) return;

        // ESCROW REFUND: Give money back if it was online or wallet
        if ((b.paymentMethod === 'online' || b.paymentMethod === 'wallet') && b.status === 'cancelled') {
           passUser.walletBalance += b.fareCharged;
           
           await Transaction.create({
             userId: b.passenger,
             type: 'REFUND',
             amount: b.fareCharged,
             rideId: ride._id,
             description: `System Refund: Ride cancelled by driver`
           });
           console.log(`[Escrow] 🔄 Auto-Refunded ₹${b.fareCharged} to Passenger ${passUser.name} via ${b.paymentMethod}`);
        }

        if (b.priorityBadgeGiven) {
           passUser.priorityBadgeExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
           
           await Notification.create({
             user: b.passenger,
             type: 'PRIORITY_BADGE',
             title: '🎖️ Priority Badge Awarded!',
             message: 'Due to a late cancellation by your rider, you have been awarded a 7-day priority search badge.',
             rideId: ride._id
           });
        }

        await passUser.save();

        await Notification.create({
          user: b.passenger,
          type: 'RIDE_CANCELLED',
          title: 'Ride Cancelled by Rider',
          message: `Your ride from ${ride.from} on ${new Date(ride.date).toLocaleDateString()} has been cancelled. Reason: ${finalReason}.`,
          rideId: ride._id
        });
      }
    }));

    await ride.save();

    console.log(`[Justice] ⚖️ Ride ${ride._id} cancelled. ${penaltyType.toUpperCase()} applied to driver ${rider._id}.`);

    res.status(200).json({
      success: true,
      message: emergencyMessage || `Ride cancelled successfully. ${penaltyType !== 'none' ? `A ${penaltyType} has been added to your profile.` : ''}`,
      penalty: penaltyType,
      appeal: appealInstructions
    });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get summary stats for driver
// @route   GET /api/rides/driver/stats
// @access  Private
exports.getDriverStats = async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user._id });
    
    const activeRides = rides.filter(r => 
      (r.status === 'available' || r.status === 'full') && 
      new Date(r.expiresAt) > new Date()
    );

    const totalBookings = activeRides.reduce((acc, r) => {
      return acc + r.bookings.filter(b => b.status === 'confirmed').length;
    }, 0);

    // New bookings since lastMyRidesView
    const newBookingsCount = await Notification.countDocuments({
      user: req.user._id,
      type: 'NEW_BOOKING',
      createdAt: { $gt: req.user.lastMyRidesView || new Date(0) }
    });

    res.status(200).json({
      success: true,
      data: {
        activeRidesCount: activeRides.length,
        totalBookingsCount: totalBookings,
        newBookingsCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Report rider no show (Passenger only)
// @route   POST /api/rides/:id/no-show
// @access  Private
exports.reportNoShow = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    // 1. Logic Checks
    const now = new Date();
    const departureTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}`);
    const diffMinutes = (now - departureTime) / (1000 * 60);

    const waitTime = ride.waitingTime || 10;
    if (diffMinutes < waitTime) return res.status(400).json({ success: false, message: `You must wait at least ${waitTime} minutes after scheduled departure before reporting a no-show.` });
    if (diffMinutes > 45) return res.status(400).json({ success: false, message: 'No show reporting window (45 min) has closed.' });

    // Check if passenger booked this ride
    const booking = ride.bookings.find(b => b.passenger.toString() === req.user._id.toString() && b.status === 'confirmed');
    if (!booking) return res.status(403).json({ success: false, message: 'Only confirmed passengers can report no-show' });

    // Check if already reported
    if (ride.noShowReports.includes(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You have already reported a no-show for this ride' });
    }

    // 2. Record Report
    ride.noShowReports.push(req.user._id);
    await ride.save();

    console.log(`[NoShow] Ride ${ride._id} reported by ${req.user._id}. Total: ${ride.noShowReports.length}`);

    // 3. Trigger Penalty if Majority ( > 50% )
    const confirmedCount = ride.bookings.filter(b => b.status === 'confirmed').length;
    if (ride.noShowReports.length > confirmedCount / 2) {
       const rider = await User.findById(ride.driver);
       rider.noShowCount += 1;
       rider.strikes += 1;
       rider.lastStrikeAt = new Date();
       rider.trustScore = Math.max(0, rider.trustScore - 20); // -20 for no show
       
       // Restriction for no-show strike (Scenario 4)
       const restrictionHours = 48; 
       const restrictedUntil = new Date(now.getTime() + restrictionHours * 60 * 60 * 1000);
       rider.restrictedUntil = restrictedUntil;
       rider.restrictionReason = `Majority No-Show Violation (Passengers reported you did not arrive for Ride ${ride._id})`;
       await rider.save();

       console.log(`[NoShow] 🛑 PENALTY TRIGGERED for ${ride.driver}. Strike added. Restricted for 48h.`);

       // Notify Raider - CLEAR EXPLANATION
       await Notification.create({
         user: ride.driver,
         type: 'ACCOUNT_RESTRICTED',
         title: '🚫 Account Restricted: No-Show Reported',
         message: `Your account has been restricted until ${restrictedUntil.toLocaleString()} because a majority of passengers on your ride from ${ride.from} reported that you did not show up at the starting point.`,
         rideId: ride._id
       });

       // Notify passengers
       const notifications = ride.bookings
         .filter(b => b.status === 'confirmed')
         .map(b => ({
           user: b.passenger,
           type: 'RIDE_CANCELLED',
           title: '⚠️ No-Show Confirmed',
           message: `Rider did not show up. Penalty applied. Search for alternative rides now.`,
           rideId: ride._id
         }));
       await Notification.insertMany(notifications);
    }

    res.status(200).json({ success: true, message: 'No-show report recorded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Predict ride price range (AI-driven via Groq)
// @route   POST /api/rides/predict-price
// @access  Private
exports.getPredictedPrice = async (req, res) => {
  try {
     const { from, to, fromCoords, toCoords, vehicleType } = req.body;
     if (!from || !to) {
        return res.status(400).json({ success: false, message: 'Pickup and Destination are required.' });
     }
     
     // 1. Calculate Distance (if coordinates exist)
     let distanceKM = null;
     if (fromCoords && toCoords && fromCoords.length === 2 && toCoords.length === 2 && fromCoords[0] !== 0) {
        const { haversineDistance } = require('../utils/fareHelper');
        distanceKM = Math.round(haversineDistance(fromCoords, toCoords));
        console.log(`[AI-Pricing] Precise distance calculated: ${distanceKM} km for ${vehicleType}`);
     }

     const { predictPrice } = require('../utils/aiPricing');
     const prediction = await predictPrice(from, to, distanceKM, vehicleType);
     
     res.status(200).json({ 
       success: true, 
       prediction
     });
  } catch (error) {
     res.status(500).json({ success: false, message: error.message });
  }
};
