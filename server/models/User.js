const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number']
    },
    gender: {
        type: String,
        required: [true, 'Please specify gender'],
        enum: ['male', 'female', 'other']
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false // Don't return password by default
    },
    licenseNumber: {
        type: String,
        default: ''
    },
    aadhaarNumber: {
        type: String,
        default: ''
    },
    averageRating: {
        type: Number,
        default: 0
    },
    starOnlyRating: {
        type: Number,
        default: 0
    },
    lastMyRidesView: {
        type: Date,
        default: Date.now
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    profilePhoto: {
        type: String,
        default: ''
    },
    trustScore: {
        type: Number,
        default: 100
    },
    warnings: {
        type: Number,
        default: 0
    },
    strikes: {
        type: Number,
        default: 0
    },
    restrictedUntil: {
        type: Date,
        default: null
    },
    restrictionReason: {
        type: String,
        default: ''
    },
    totalCancellations: {
        type: Number,
        default: 0
    },
    totalCompletedRides: {
        type: Number,
        default: 0
    },
    noShowCount: {
        type: Number,
        default: 0
    },
    priorityBadgeExpires: {
        type: Date,
        default: null
    },
    genuineClaimsThisYear: {
        type: Number,
        default: 0
    },
    appealCount: {
        type: Number,
        default: 0
    },
    appealYearReset: {
        type: Date,
        default: null
    },
    lastStrikeAt: {
        type: Date,
        default: null
    },
    walletBalance: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    walletTransactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit', 'Money Added', 'Ride Payment', 'Commission', 'Refund']
        },
        amount: Number,
        description: String,
        paymentIntentId: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Optimization Indexes
userSchema.index({ gender: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ trustScore: -1 });

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Mask Aadhaar in toJSON
userSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.aadhaarNumber && ret.aadhaarNumber.length >= 4) {
            ret.aadhaarNumber = `XXXX-XXXX-${ret.aadhaarNumber.slice(-4)}`;
        }
        delete ret.password;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
