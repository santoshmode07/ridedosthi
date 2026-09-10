const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ragService = require('./ragService');

async function forceIngest() {
  try {
    console.log("🚀 Starting Force Ingestion...");
    // The documents are in the root directory, so path from utils is ../../
    await ragService.ingestAllPdfs('../../');
    console.log("✅ Ingestion Successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ingestion Failed:", error);
    process.exit(1);
  }
}

forceIngest();
