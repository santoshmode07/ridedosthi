const axios = require('axios');

/**
 * FUNCTION 1 — analyzeSentiment(text)
 * PURPOSE: Analyze the emotional content of any review text in any Indian language
 */
exports.analyzeSentiment = async (text) => {
  const API_KEY = process.env.HUGGING_FACE_API_KEY;
  const MODEL = process.env.HUGGING_FACE_MODEL || 'cardiffnlp/twitter-xlm-roberta-base-sentiment';
  const FALLBACK_MODE = process.env.SENTIMENT_FALLBACK || 'keyword';

  try {
    if (!API_KEY) {
      throw new Error('HF API Key missing, using fallback');
    }

    const response = await axios.post(
      `https://router.huggingface.co/hf-inference/models/${MODEL}`,
      { inputs: text },
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    // HF returns an array of arrays [[{label, score}, ...]]
    const scores = response.data[0];
    
    // The model cardiffnlp/twitter-xlm-roberta-base-sentiment returns:
    // label: "negative", "neutral", "positive" (or "LABEL_0", "LABEL_1", "LABEL_2" depending on specific model version, 
    // but XLM-RoBERTa usually has labels mapped or 0=Neg, 1=Neu, 2=Pos)
    // Map them properly
    let positiveScore = 0, negativeScore = 0, neutralScore = 0;

    scores.forEach(s => {
      const label = s.label.toLowerCase();
      if (label.includes('pos') || label === 'label_2') positiveScore = s.score;
      if (label.includes('neg') || label === 'label_0') negativeScore = s.score;
      if (label.includes('neu') || label === 'label_1') neutralScore = s.score;
    });

    const sentimentScore = positiveScore - negativeScore;

    let label = 'NEUTRAL';
    if (sentimentScore > 0.3) label = 'POSITIVE';
    else if (sentimentScore < -0.3) label = 'NEGATIVE';

    return {
      sentimentScore: parseFloat(sentimentScore.toFixed(2)),
      label,
      confidence: parseFloat(Math.max(positiveScore, negativeScore, neutralScore).toFixed(2)),
      positiveScore: parseFloat(positiveScore.toFixed(2)),
      negativeScore: parseFloat(negativeScore.toFixed(2)),
      neutralScore: parseFloat(neutralScore.toFixed(2))
    };

  } catch (error) {
    console.warn(`[Sentiment] HF API Error: ${error.message}. Activating Keyword Fallback.`);
    return this.keywordFallbackSentiment(text);
  }
};

/**
 * KEYWORD FALLBACK
 */
exports.keywordFallbackSentiment = (text) => {
  const lowerText = text.toLowerCase();
  
  const positiveKeywords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'safe', 'friendly', 'clean', 'perfect', 'superb',
    'accha', 'bahut accha', 'bahut badhiya', 'chala baga', 'super', 'nalla', 'romba nalla', 'chennaga', 
    'chala manchi', 'best', 'awesome', 'shukriya', 'thank you', 'dhanyawadalu', 'బాగుంది', 'అద్భుతంగా'
  ];

  const negativeKeywords = [
    'bad', 'terrible', 'worst', 'awful', 'rude', 'dangerous', 'dirty', 'late', 'horrible', 'never again', 
    'waste', 'bura', 'bahut bura', 'bekaar', 'ganda', 'chala cheddaga', 'worst', 'waste of time', 
    'pedda cheddaga', 'romba mosam', 'kavala ledu', 'naasirakam', 'sarigga ledu', 'jaragaledu', 'asalu', 
    'issues', 'problems', 'rude behavior', 'rash driving', 'నాసిరకం', 'చెడ్డగా'
  ];

  let posCount = 0;
  let negCount = 0;

  positiveKeywords.forEach(kw => { if (lowerText.includes(kw)) posCount++; });
  negativeKeywords.forEach(kw => { if (lowerText.includes(kw)) negCount++; });

  let sentimentScore = 0;
  let label = 'NEUTRAL';

  if (posCount > negCount) {
    sentimentScore = 0.6;
    label = 'POSITIVE';
  } else if (negCount > posCount) {
    sentimentScore = -0.6;
    label = 'NEGATIVE';
  }

  return {
    sentimentScore,
    label,
    confidence: 0.5,
    positiveScore: posCount > negCount ? 0.6 : 0,
    negativeScore: negCount > posCount ? 0.6 : 0,
    neutralScore: posCount === negCount ? 1.0 : 0.4
  };
};

/**
 * FUNCTION 2 — measureReviewIntensity(text)
 * PURPOSE: Measure how genuine and emotional the review is
 */
exports.measureReviewIntensity = (text) => {
  const wordCount = text.trim().split(/\s+/).length;
  const lowerText = text.toLowerCase();

  const strongPositive = [
    'absolutely', 'incredibly', 'extremely', 'very very', 'chala chala', 'bahut bahut', 
    'romba romba', 'super super', 'best ever', 'life changing', 'amazing'
  ];

  const strongNegative = [
    'absolutely terrible', 'very dangerous', 'chala cheddaga', 'bahut bura', 'worst ever', 
    'never again', 'horrible', 'disgusting', 'cheated', 'fraud'
  ];

  const hasStrongEmotion = [...strongPositive, ...strongNegative].some(word => lowerText.includes(word));

  const specificDetailsKeywords = [
    'minutes', 'late', 'incident', 'accident', 'rude', 'asked', 'near', 'location', 'time', 'behaviour', 'issues', 'problems'
  ];
  const hasSpecificDetails = specificDetailsKeywords.some(word => lowerText.includes(word));

  // STEP 4 — Calculate intensity level
  const isEmojiOnly = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/g.test(text.replace(/\s/g, ''));
  const genericWords = ['good', 'ok', 'nice', 'bad'];
  const isGeneric = wordCount === 1 && genericWords.includes(lowerText);

  let intensityLevel = 'MEDIUM';
  let intensityScore = 0.5;

  if (wordCount < 5 || isEmojiOnly || isGeneric) {
    intensityLevel = 'LOW';
    intensityScore = 0.2;
  } else if (wordCount > 25 || hasStrongEmotion || hasSpecificDetails) {
    intensityLevel = 'HIGH';
    intensityScore = 0.9;
  }

  return {
    intensityLevel,
    intensityScore,
    wordCount,
    hasStrongEmotion,
    hasSpecificDetails
  };
};

/**
 * FUNCTION 3 — detectConflict(starRating, sentimentScore)
 * PURPOSE: Detect when stars and text disagree
 */
exports.detectConflict = (starRating, sentimentScore) => {
  // Convert stars to sentiment scale (rough mapping)
  // 5 stars → expected sentiment: +0.8 to +1.0
  // 4 stars → expected sentiment: +0.3 to +0.8
  // 3 stars → expected sentiment: -0.3 to +0.3
  // 2 stars → expected sentiment: -0.8 to -0.3
  // 1 star  → expected sentiment: -1.0 to -0.8
  
  let conflictDetected = false;
  let conflictType = 'NONE';
  let sentimentWins = false;

  // STRONG CONFLICT
  if ((starRating === 5 && sentimentScore < -0.3) || (starRating === 1 && sentimentScore > 0.3)) {
    conflictDetected = true;
    conflictType = 'STRONG';
    sentimentWins = true;
  }
  // MILD CONFLICT
  else if ((starRating >= 4 && sentimentScore < 0) || (starRating <= 2 && sentimentScore > 0)) {
    conflictDetected = true;
    conflictType = 'MILD';
    sentimentWins = false;
  }

  return {
    conflictDetected,
    conflictType,
    sentimentWins
  };
};

/**
 * FUNCTION 4 — calculateFinalRating(starRating, sentimentScore, intensityScore, conflictResult)
 * PURPOSE: Calculate the TRUE rating that goes into the rider's average
 */
exports.calculateFinalRating = (starRating, sentimentScore, intensityScore, conflictResult) => {
  let finalRating;
  let starWeight;
  let sentimentWeight;
  let explanation = "";

  // Convert -1 to +1 scale → 1 to 5 stars
  const sentimentBasedRating = (sentimentScore + 1) / 2 * 4 + 1;

  if (conflictResult.conflictDetected && conflictResult.conflictType === 'STRONG' && conflictResult.sentimentWins) {
    // CASE 1 — Strong Conflict Detected
    finalRating = sentimentBasedRating;
    starWeight = 0;
    sentimentWeight = 1.0;
    explanation = "Strong conflict detected. Sentiment completely overrides stars.";
  } else if (intensityScore >= 0.9 && !conflictResult.conflictDetected) {
    // CASE 2 — High Intensity Genuine Review
    starWeight = 0.40;
    sentimentWeight = 0.60;
    finalRating = (starRating * starWeight) + (sentimentBasedRating * sentimentWeight);
    explanation = "High intensity review. Sentiment carries more weight.";
  } else if (intensityScore >= 0.5) {
    // CASE 3 — Medium Intensity Review
    starWeight = 0.60;
    sentimentWeight = 0.40;
    finalRating = (starRating * starWeight) + (sentimentBasedRating * sentimentWeight);
    explanation = "Medium intensity review. Balanced weight between stars and sentiment.";
  } else {
    // CASE 4 — Lazy Low Intensity Review
    starWeight = 0.85;
    sentimentWeight = 0.15;
    finalRating = (starRating * starWeight) + (sentimentBasedRating * sentimentWeight);
    explanation = "Low intensity review. Stars dominate calculation.";
  }

  // Handle Mild Conflict adjustment (they blended above, but maybe need specific logic if requested)
  if (conflictResult.conflictType === 'MILD') {
     // Even for MILD, we use the standard weights above based on intensity, but we can note it
     explanation += " Mild conflict detected.";
  }

  // Rounding and Capping
  finalRating = Math.round(finalRating * 10) / 10;
  finalRating = Math.max(1.0, Math.min(5.0, finalRating));

  return {
    finalRating,
    starRating,
    sentimentScore,
    intensityLevel: intensityScore >= 0.9 ? 'HIGH' : (intensityScore >= 0.5 ? 'MEDIUM' : 'LOW'),
    conflictDetected: conflictResult.conflictDetected,
    starWeight: Math.round(starWeight * 100),
    sentimentWeight: Math.round(sentimentWeight * 100),
    calculation: explanation
  };
};
