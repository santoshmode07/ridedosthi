const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkConn() {
    console.log("Checking connection to:", process.env.MONGO_URI.split('@')[1]); // Log host only for safety
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("SUCCESS: Connected to DB");
        process.exit(0);
    } catch (err) {
        console.error("FAILURE: Could not connect to DB within 5s");
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);
        process.exit(1);
    }
}

checkConn();
