const CEFR_WORDLIST_RAW = {
  A1: [
    "about", "after", "again", "apple", "book", "boy", "car", "cat", "day", "dog",
    "door", "drink", "eat", "family", "friend", "girl", "good", "happy", "house",
    "learn", "listen", "love", "make", "name", "new", "play", "read", "school",
    "small", "speak", "student", "teacher", "water", "work", "write",
  ],
  A2: [
    "advice", "answer", "arrive", "breakfast", "building", "change", "choose",
    "clothes", "culture", "decide", "describe", "different", "difficult", "example",
    "exercise", "future", "holiday", "important", "language", "message", "minute",
    "museum", "office", "problem", "question", "remember", "restaurant", "sentence",
    "travel", "usually", "weather", "weekend",
  ],
  B1: [
    "achieve", "announce", "approach", "available", "benefit", "challenge",
    "community", "compare", "condition", "consider", "context", "develop",
    "education", "encourage", "environment", "improve", "include", "increase",
    "influence", "manage", "opinion", "opportunity", "prepare", "provide",
    "quality", "reduce", "require", "research", "result", "support", "variety",
  ],
  B2: [
    "accurate", "alternative", "analysis", "assess", "complex", "consequence",
    "consumer", "debate", "demonstrate", "effective", "emerge", "essential",
    "evidence", "factor", "feature", "function", "impact", "maintain", "method",
    "policy", "principle", "process", "significant", "source", "specific",
    "strategy", "structure", "theory", "trend",
  ],
  C1: [
    "albeit", "ambiguous", "coherent", "comprehensive", "constrain", "controversial",
    "correlate", "discrepancy", "enhance", "explicit", "framework", "inherent",
    "insight", "integrate", "interpret", "notion", "nuance", "paradigm",
    "preliminary", "rationale", "subsequent", "synthesize", "validate",
  ],
  C2: [
    "antediluvian", "circumlocution", "equanimity", "intransigence", "obfuscate",
    "perspicacious", "pulchritude", "recalcitrant", "sesquipedalian", "vicissitude",
  ],
};

export const CEFR_WORDLIST = Object.fromEntries(
  Object.entries(CEFR_WORDLIST_RAW).map(([level, words]) => [level, new Set(words)])
);

