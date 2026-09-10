const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Ride = require('../models/Ride');
const socketManager = require('../utils/socketManager');

let dashboardCache = null;
let cacheTime = null;

const clearAdminCache = () => {
    dashboardCache = null;
    cacheTime = null;
    console.log('[Admin] Cache Invalidated');
};

exports.getAdminStats = async (req, res) => {
    try {
        // Optimization: 5-minute cache
        const CACHE_DURATION = 5 * 60 * 1000;
        if (dashboardCache && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
            console.log('[Admin] Returning Cached Stats');
            return res.status(200).json({ success: true, ...dashboardCache });
        }

        const admin = await User.findById(req.user._id);
        
        // 1. Transaction History (Global)
        const transactions = await Transaction.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('userId', 'name email role')
            .populate('rideId', 'from to')
            .lean();

        // 2. Optimized Combined Aggregations (Single Trip)
        const statsAggregation = await Transaction.aggregate([
            {
                $facet: {
                    revenue: [
                        { $match: { type: 'COMMISSION' } },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ],
                    subsidies: [
                        { $match: { type: 'SUBSIDY', amount: { $lt: 0 } } },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ],
                    escrow: [
                        { $match: { type: { $in: ['ESCROW_HOLD', 'ESCROW_RELEASE'] } } },
                        { $group: { _id: null, total: { $sum: '$amount' } } }
                    ]
                }
            }
        ]);

        const totalRevenue = statsAggregation[0].revenue[0]?.total || 0;
        const totalSubsidies = Math.abs(statsAggregation[0].subsidies[0]?.total || 0);
        const escrowBalance = statsAggregation[0].escrow[0]?.total || 0;

        // 3. Active Disputes
        const disputedRides = await Ride.find({
            'bookings.disputeRaised': true
        })
        .populate('driver', 'name email phone profilePhoto')
        .populate('bookings.passenger', 'name email phone profilePhoto')
        .sort({ updatedAt: -1 })
        .lean();

        // Filter out individual disputed bookings
        const activeDisputes = [];
        if (disputedRides && disputedRides.length > 0) {
            disputedRides.forEach(ride => {
                if (ride.bookings && Array.isArray(ride.bookings)) {
                    ride.bookings.forEach(booking => {
                        if (booking.disputeRaised && (booking.dropoffStatus === 'disputed')) {
                            activeDisputes.push({
                                rideId: ride._id.toString(),
                                from: ride.from,
                                to: ride.to,
                                driver: ride.driver,
                                passenger: booking.passenger,
                                fare: booking.fareCharged,
                                paymentMethod: booking.paymentMethod,
                                raisedAt: booking.disputeRaisedAt || ride.updatedAt
                            });
                        }
                    });
                }
            });
        }

        const stats = {
            platformBalance: admin.walletBalance,
            escrowBalance,
            totalRevenue,
            totalSubsidies,
            transactionCount: await Transaction.countDocuments(),
            transactions,
            activeDisputes
        };

        // Cache the results
        dashboardCache = { data: stats };
        cacheTime = Date.now();

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all users (for admin management)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Settle a disputed ride booking
// @route   POST /api/admin/settle-dispute/:rideId/:passengerId
// @access  Private (Admin)
exports.settleDispute = async (req, res) => {
    try {
        const { rideId, passengerId } = req.params;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

        const booking = ride.bookings.find(b => b.passenger.toString() === passengerId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        // Idempotency check: Ensure the dispute is still active
        if (booking.dropoffStatus !== 'disputed') {
            return res.status(400).json({ success: false, message: 'This booking is not currently in dispute' });
        }

        const driver = await User.findById(ride.driver);
        const admin = await User.findOne({ role: 'admin' });
        const passenger = await User.findById(passengerId);

        const originalFare = booking.fareCharged;
        const riderCut = Math.round(originalFare * 0.8);
        const commission = originalFare - riderCut;

        if (booking.paymentMethod === 'cash') {
            // CASH: Money is already with Raider. Deduct commission from Rider.
            driver.walletBalance -= commission;
            admin.walletBalance += commission;

            await Transaction.create({
                userId: driver._id,
                type: 'COMMISSION',
                amount: -commission,
                rideId: ride._id,
                description: `System Commission (Dispute Settled - Cash) - Ride ${ride._id}`
            });

            await Transaction.create({
                userId: admin._id,
                type: 'COMMISSION',
                amount: commission,
                rideId: ride._id,
                description: `Commission Collected (Dispute Settled - Cash) - From Driver ${driver.name}`
            });
        } else {
            // ONLINE/WALLET: Money is in Admin Escrow. 
            driver.walletBalance += riderCut;
            admin.walletBalance -= riderCut;

            await Transaction.create({
                userId: admin._id,
                type: 'ESCROW_RELEASE',
                amount: -riderCut,
                rideId: ride._id,
                description: `Escrow Release (Dispute Settled) - To Driver ${driver.name}`
            });

            await Transaction.create({
                userId: driver._id,
                type: 'RIDE_EARNING',
                amount: riderCut,
                rideId: ride._id,
                description: `Ride Earning (Dispute Settled) - From ${passenger.name}`
            });

            await Transaction.create({
                userId: admin._id,
                type: 'COMMISSION',
                amount: commission,
                rideId: ride._id,
                description: `Commission Audit (Dispute Settled) - Ride ${ride._id}`
            });
        }

        // Finalize
        booking.dropoffStatus = 'confirmed';
        booking.disputeRaised = false;
        booking.fareReleased = true;

        await admin.save();
        await driver.save();
        await ride.save();

        // Real Time Update & Cache Clear
        clearAdminCache();
        socketManager.emitToUser(driver._id, 'wallet_updated', {
            newBalance: driver.walletBalance,
            transaction: { type: 'credit', amount: originalFare, description: 'Dispute Settled' }
        });
        socketManager.emitToRide(rideId, 'fare_released', {
            message: `Dispute resolved for ride ${rideId}`,
            passengerId
        });

        res.status(200).json({
            success: true,
            message: 'Incident settled and ledger updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Refund a disputed ride booking to the passenger
// @route   POST /api/admin/refund-dispute/:rideId/:passengerId
// @access  Private (Admin)
exports.refundDispute = async (req, res) => {
    try {
        const { rideId, passengerId } = req.params;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

        const booking = ride.bookings.find(b => b.passenger.toString() === passengerId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found for this passenger' });
        
        // Idempotency check: Ensure the dispute is still active
        if (booking.dropoffStatus !== 'disputed') {
            return res.status(400).json({ 
                success: false, 
                message: `This incident has already been resolved or refunded (Current status: ${booking.dropoffStatus})` 
            });
        }
        
        const driver = await User.findById(ride.driver);
        const admin = await User.findOne({ role: 'admin' });
        const passenger = await User.findById(passengerId);

        if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found for escrow release' });
        if (!passenger) return res.status(404).json({ success: false, message: 'Passenger account not found' });
        if (!driver && booking.paymentMethod === 'cash') {
            return res.status(400).json({ success: false, message: 'Cannot reverse cash to a non-existent driver' });
        }

        const originalFare = booking.fareCharged || 0;

        if (booking.paymentMethod === 'cash') {
            // CASH REFUND: We must TAKE the money back from the Driver and give to Passenger
            if (driver) {
                driver.walletBalance -= originalFare;
                await Transaction.create({
                    userId: driver._id,
                    type: 'REFUND',
                    amount: -originalFare,
                    rideId: ride._id,
                    description: `Cash Refund Reversed (Admin Order) - To Passenger ${passenger.name}`
                });
                await driver.save();
            }
            
            passenger.walletBalance += originalFare;
            await Transaction.create({
                userId: passenger._id,
                type: 'REFUND',
                amount: originalFare,
                rideId: ride._id,
                description: `Cash Refund Received (Admin Order) - To Account`
            });
        } else {
            // ONLINE/WALLET: Platform holds the money. Deduct from Admin, give to Passenger.
            admin.walletBalance -= originalFare;
            passenger.walletBalance += originalFare;

            await Transaction.create({
                userId: admin._id,
                type: 'ESCROW_RELEASE',
                amount: -originalFare,
                rideId: ride._id,
                description: `Escrow Refund (Dispute Settled) - To Passenger ${passenger.name}`
            });

            await Transaction.create({
                userId: passenger._id,
                type: 'REFUND',
                amount: originalFare,
                rideId: ride._id,
                description: `Ride Refund (Dispute Settled) - From Admin HQ`
            });
            await admin.save();
        }

        booking.dropoffStatus = 'refunded';
        booking.disputeRaised = false;
        booking.fareReleased = false;
        booking.refundProcessed = true;

        await passenger.save();
        await ride.save();

        // Real Time Update & Cache Clear
        clearAdminCache();
        socketManager.emitToUser(passengerId, 'wallet_updated', {
            newBalance: passenger.walletBalance,
            transaction: { type: 'credit', amount: originalFare, description: 'Ride Refunded' }
        });
        
        if (driver && booking.paymentMethod === 'cash') {
            socketManager.emitToUser(driver._id, 'wallet_updated', {
                newBalance: driver.walletBalance,
                transaction: { type: 'debit', amount: originalFare, description: 'Cash Refund Reversed' }
            });
        }

        socketManager.emitToRide(rideId, 'ride_status_changed', {
            message: `Passenger record updated to refunded`,
            status: 'refunded'
        });

        res.status(200).json({
            success: true,
            message: 'Passenger Refunded Successfully'
        });
    } catch (error) {
        console.error('REFUND ERROR:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
