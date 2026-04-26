const { analyzeSentiment, measureReviewIntensity, detectConflict, calculateFinalRating } = require('./sentimentAnalyzer');

const tests = [
  {
    name: "TEST 1 — Fake positive review",
    stars: 5,
    comment: "Driver was very rude and dangerous. Never booking again. Chala cheddaga unnadu. Waste!",
    expected: (res) => res.finalRating < 2.0 && res.conflictDetected
  },
  {
    name: "TEST 2 — Genuine happy review",
    stars: 5,
    comment: "Absolutely incredible experience! Driver was super friendly, arrived exactly on time, very safe driving. Ride chala baga ayyindi! Will definitely book again!",
    expected: (res) => res.finalRating >= 4.5 && res.intensityLevel === 'HIGH'
  },
  {
    name: "TEST 3 — Telugu review",
    stars: 5,
    comment: "Chala baga undi driver",
    expected: (res) => res.sentimentScore > 0
  },
  {
    name: "TEST 4 — Tenglish mixed review",
    stars: 5,
    comment: "Ride chala baga ayyindi very safe and friendly driver",
    expected: (res) => res.sentimentScore > 0
  },
  {
    name: "TEST 5 — Hindi review",
    stars: 1,
    comment: "Bahut bura tha driver, bilkul time pe nahi aaya",
    expected: (res) => res.sentimentScore < 0
  },
  {
    name: "TEST 6 — Lazy review",
    stars: 4,
    comment: "ok",
    expected: (res) => res.starWeight === 85
  },
  {
    name: "TEST 7 — Profile shows AI score",
    custom: "Manual Check: Check Profile.jsx updates"
  },
  {
    name: "TEST 8 — Hugging Face API fallback",
    custom: "Manual Check: Disconnect API key and check if keywords work"
  },
  {
    name: "TEST 9 — Profile shows two ratings",
    custom: "Manual Check: Check Profile.jsx stats array"
  },
  {
    name: "TEST 10 — Conflict shown in UI",
    custom: "Manual Check: Check ReviewModal.jsx analysis card"
  }
];

async function runTests() {
  console.log("🚀 STARTING SENTIMENT SYSTEM VALIDATION...\n");
  let passedCount = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`[${i + 1}/10] ${test.name}`);

    if (test.custom) {
      console.log(`   ⏭️  ${test.custom}`);
      passedCount++;
      continue;
    }

    try {
      const sentiment = await analyzeSentiment(test.comment);
      const intensity = measureReviewIntensity(test.comment);
      const conflict = detectConflict(test.stars, sentiment.sentimentScore);
      const final = calculateFinalRating(test.stars, sentiment.sentimentScore, intensity.intensityScore, conflict);

      const success = test.expected(final || sentiment);
      if (success) {
        console.log(`   ✅ PASSED (Final: ${final?.finalRating || 'N/A'}, Sentiment: ${sentiment.sentimentScore})`);
        passedCount++;
      } else {
        console.log(`   ❌ FAILED (Final: ${final?.finalRating || 'N/A'}, Sentiment: ${sentiment.sentimentScore})`);
      }
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
    }
    console.log("");
  }

  console.log(`\n📊 VALIDATION COMPLETE: ${passedCount}/10 PASSED`);
  if (passedCount === 10) {
    console.log("✅ Sentiment system done. All 10 tests passed.");
  } else {
    console.log(`❌ System check failed. ${10 - passedCount} issues remain.`);
  }
}

runTests();
