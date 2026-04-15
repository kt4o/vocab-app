export const ROUTE_SEO = {
  landing: {
    path: "/",
    title: "Vocalibry",
    description:
      "Learn how to expand your vocabulary with a proven daily system: track words, study with flashcards, and improve recall using targeted quizzes.",
    indexable: true,
  },
  pricing: {
    path: "/pricing",
    title: "Pricing | Vocalibry",
    description:
      "Compare Free and Pro plans for Vocalibry and choose the vocabulary-learning experience that fits your goals.",
    indexable: true,
  },
  features: {
    path: "/features",
    title: "Features | Vocalibry",
    description:
      "Explore Vocalibry features for vocabulary building, flashcards, quizzes, smart review, and progress tracking.",
    indexable: true,
  },
  "vocabulary-guide": {
    path: "/how-to-expand-your-vocabulary",
    title: "How to Expand Your Vocabulary: Research-Backed Ways to Learn More Words | Vocalibry",
    description:
      "Learn how to expand your vocabulary with research-backed strategies like contextual learning, retrieval practice, spaced repetition, and active use.",
    indexable: true,
  },
  "memorize-vocabulary": {
    path: "/how-to-memorize-vocabulary",
    title: "How to Memorize Vocabulary and Actually Remember It | Vocalibry",
    description:
      "Learn how to memorize vocabulary with active recall, spaced repetition, contextual examples, and better review habits.",
    indexable: true,
  },
  "vocabulary-in-context": {
    path: "/how-to-learn-vocabulary-in-context",
    title: "How to Learn Vocabulary in Context | Vocalibry",
    description:
      "Learn how to study vocabulary in context so you remember meaning, tone, collocations, and real-world usage more effectively.",
    indexable: true,
  },
  guides: {
    path: "/guides",
    title: "Vocabulary Guides and Study Strategies | Vocalibry",
    description:
      "Explore vocabulary learning guides on memorization, contextual learning, spaced repetition, and daily study habits.",
    indexable: true,
  },
  "spaced-repetition-vocabulary": {
    path: "/spaced-repetition-for-vocabulary",
    title: "Spaced Repetition for Vocabulary | Vocalibry",
    description:
      "Learn how spaced repetition helps vocabulary stick longer and how to combine review timing with active recall.",
    indexable: true,
  },
  "words-per-day": {
    path: "/how-many-words-should-you-learn-per-day",
    title: "How Many Words Should You Learn Per Day? | Vocalibry",
    description:
      "Find a realistic daily vocabulary target based on review time, retention, and the difficulty of the words you study.",
    indexable: true,
  },
  "forget-looked-up-words": {
    path: "/why-you-forget-words-you-look-up-while-reading",
    title: "Why You Forget Words You Look Up While Reading and How to Remember Them | Vocalibry",
    description:
      "Looking up a word helps you understand the sentence, but not always remember it later. Learn how to retain vocabulary from reading with context, recall, and review.",
    indexable: true,
  },
  "remember-vocabulary-from-books": {
    path: "/how-to-remember-vocabulary-from-books",
    title: "How to Remember Vocabulary From Books | Vocalibry",
    description:
      "Learn how to remember vocabulary from books by saving useful words in context, reviewing them with recall, and revisiting weak words before they fade.",
    indexable: true,
  },
  contact: {
    path: "/contact",
    title: "Contact | Vocalibry",
    description: "Get support for Vocalibry account, billing, and learning questions.",
    indexable: true,
  },
  terms: {
    path: "/terms",
    title: "Terms & Conditions | Vocalibry",
    description: "Read the Terms & Conditions for using Vocalibry.",
    indexable: true,
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy | Vocalibry",
    description: "Read how Vocalibry collects, uses, and protects your data.",
    indexable: true,
  },
  disclaimer: {
    path: "/disclaimer",
    title: "Disclaimer | Vocalibry",
    description: "Read the Vocalibry disclaimer and usage limitations.",
    indexable: true,
  },
  login: {
    path: "/login",
    title: "Log In | Vocalibry",
    description: "Log in to your Vocalibry account.",
    indexable: false,
  },
  register: {
    path: "/register",
    title: "Create Account | Vocalibry",
    description: "Create your Vocalibry account and start learning vocabulary.",
    indexable: false,
  },
  "forgot-password": {
    path: "/forgot-password",
    title: "Reset Password | Vocalibry",
    description: "Reset your Vocalibry account password.",
    indexable: false,
  },
  app: {
    path: "/app",
    title: "App | Vocalibry",
    description: "Vocalibry learning app.",
    indexable: false,
  },
};

export const ARTICLE_ROUTE_KEYS = new Set([
  "vocabulary-guide",
  "memorize-vocabulary",
  "vocabulary-in-context",
  "spaced-repetition-vocabulary",
  "words-per-day",
  "forget-looked-up-words",
  "remember-vocabulary-from-books",
]);

export const PRERENDER_ROUTES = Object.values(ROUTE_SEO)
  .filter((entry) => entry.indexable)
  .map((entry) => entry.path);

export function getRoute(pathname) {
  const normalizedPath = String(pathname || "").replace(/\/+$/, "") || "/";

  if (normalizedPath === "/app") return "app";
  if (normalizedPath === "/login") return "login";
  if (normalizedPath === "/register") return "register";
  if (normalizedPath === "/forgot-password") return "forgot-password";
  if (normalizedPath === "/terms" || normalizedPath === "/terms-and-conditions") return "terms";
  if (normalizedPath === "/privacy" || normalizedPath === "/privacy-policy") return "privacy";
  if (normalizedPath === "/disclaimer" || normalizedPath === "/legal-disclaimer") return "disclaimer";
  if (normalizedPath === "/pricing") return "pricing";
  if (normalizedPath === "/features") return "features";
  if (normalizedPath === "/how-to-expand-your-vocabulary") return "vocabulary-guide";
  if (normalizedPath === "/how-to-memorize-vocabulary") return "memorize-vocabulary";
  if (normalizedPath === "/how-to-learn-vocabulary-in-context") return "vocabulary-in-context";
  if (normalizedPath === "/guides") return "guides";
  if (normalizedPath === "/spaced-repetition-for-vocabulary") return "spaced-repetition-vocabulary";
  if (normalizedPath === "/how-many-words-should-you-learn-per-day") return "words-per-day";
  if (normalizedPath === "/why-you-forget-words-you-look-up-while-reading") return "forget-looked-up-words";
  if (normalizedPath === "/how-to-remember-vocabulary-from-books") return "remember-vocabulary-from-books";
  if (normalizedPath === "/contact") return "contact";
  return "landing";
}

