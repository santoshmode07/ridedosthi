const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rideRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const bookingRoutes = require('./routes/bookings');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/payments');
const otpRoutes = require('./routes/otp');
const dropoffRoutes = require('./routes/dropoff');
const ragRoutes = require('./routes/ragRoutes');
const { startCronJobs } = require('./controllers/rideController');

const socketMiddleware = require('./middleware/socketMiddleware');
const socketManager = require('./utils/socketManager');

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Apply Socket Middleware
io.use(socketMiddleware);

// Initialize Socket Manager
socketManager.init(io);

/**
 * Middleware
 */
const paymentController = require('./controllers/paymentController');

// Webhook for Stripe - MUST be before express.json()
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

const compression = require('compression');
app.use(compression());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/dropoff', dropoffRoutes);
app.use('/api/rag', ragRoutes);

// Simple health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is running' });
});

/**
 * Error Handler (Catch-all for 404)
 */
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

/**
 * Main Initialization Block
 */
const startServer = async () => {
    try {
        // 1. Connect to database first
        await connectDB();
        console.log('📦 Database sync established.');

        // 2. Start Background Hardening Tasks only after DB is ready
        startCronJobs();

        // 3. Start listening
        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT} (Socket.io active)`);
        });
    } catch (error) {
        console.error('❌ Critical Startup Failure:', error.message);
        process.exit(1);
    }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error(`🔴 Unhandled Rejection: ${err.message}`);
    // Optional: Log stack trace for debugging
    // console.error(err.stack);
});
