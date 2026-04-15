import { StrictMode, useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";
import "./tailwind.css";
import "./styles/style-variants.css";
import App from "./App.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { TermsPage } from "./pages/TermsPage.jsx";
import { PrivacyPage } from "./pages/PrivacyPage.jsx";
import { DisclaimerPage } from "./pages/DisclaimerPage.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { PricingPage } from "./pages/PricingPage.jsx";
import { FeaturesPage } from "./pages/FeaturesPage.jsx";
import { VocabularyGuidePage } from "./pages/VocabularyGuidePage.jsx";
import { MemorizeVocabularyPage } from "./pages/MemorizeVocabularyPage.jsx";
import { VocabularyInContextPage } from "./pages/VocabularyInContextPage.jsx";
import { GuidesPage } from "./pages/GuidesPage.jsx";
import { SpacedRepetitionVocabularyPage } from "./pages/SpacedRepetitionVocabularyPage.jsx";
import { WordsPerDayPage } from "./pages/WordsPerDayPage.jsx";
import { ForgetLookedUpWordsPage } from "./pages/ForgetLookedUpWordsPage.jsx";
import { RememberVocabularyFromBooksPage } from "./pages/RememberVocabularyFromBooksPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import {
  getAnalyticsConsentStatus,
  initAnalytics,
  isAnalyticsConfigured,
  setAnalyticsConsentStatus,
  trackPageView,
} from "./lib/analytics.js";
import { getBreadcrumbStructuredData } from "./config/breadcrumbs.js";
import { ARTICLE_ROUTE_KEYS, ROUTE_SEO, getRoute } from "./config/siteSeo.js";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_CHECK_MAX_ATTEMPTS = 3;
const AUTH_CHECK_RETRY_DELAY_MS = 450;
const SITE_URL = String(import.meta.env.VITE_SITE_URL || "https://www.vocalibry.com")
  .trim()
  .replace(/\/$/, "");
const DEFAULT_OG_IMAGE_PATH = "/og-image.png";
const FAQ_ENTRIES = [
  {
    question: "How can I expand my vocabulary faster?",
    answer:
      "Use a repeatable loop: collect useful words, practice active recall daily, and review mistakes before forgetting. Vocalibry supports this with books, chapters, flashcards, and targeted quizzes.",
  },
  {
    question: "Is Vocalibry free to use?",
    answer:
      "Yes. You can start with the Free plan and access core features like word tracking, flashcards, and quiz practice.",
  },
  {
    question: "How does Vocalibry help me remember words long-term?",
    answer:
      "Vocalibry combines active recall, repeated quiz practice, and targeted review so weak words are revisited before you forget them.",
  },
  {
    question: "Can I organize vocabulary by class or textbook chapter?",
    answer:
      "Yes. You can create books and chapters so your vocabulary lists match your school units, exam topics, or personal study plan.",
  },
];

const VOCABULARY_GUIDE_FAQ_ENTRIES = [
  {
    question: "What is the best way to expand your vocabulary?",
    answer:
      "The best way to expand your vocabulary is to learn useful words in context, review them with active recall, space your practice over time, and use the words in your own speaking or writing.",
  },
  {
    question: "How can I improve my vocabulary every day?",
    answer:
      "A short daily routine works well. Save a few useful words from real reading or listening, review them with flashcards or quiz prompts, and use at least one of them in a sentence of your own.",
  },
  {
    question: "Is reading enough to improve vocabulary?",
    answer:
      "Reading helps a lot, especially when it is extensive and understandable, but it works better when combined with deliberate review. Reading gives you exposure, while retrieval practice and active use help words stick.",
  },
  {
    question: "How many new words should you learn each week?",
    answer:
      "A manageable target is usually better than an ambitious one. For many learners, 10 to 20 useful words per week is enough if the words are reviewed well and reused in context.",
  },
];

const MEMORIZE_VOCABULARY_FAQ_ENTRIES = [
  {
    question: "What is the fastest way to memorize vocabulary?",
    answer:
      "The fastest reliable method is to learn useful words in context, review them with active recall, and revisit them on a spaced schedule. Speed comes from consistency, not from cramming.",
  },
  {
    question: "Why do I forget new words so quickly?",
    answer:
      "Many learners forget words quickly because they only reread them. Words last longer when you retrieve them from memory, meet them again in context, and use them yourself.",
  },
  {
    question: "How many words should I memorize at a time?",
    answer:
      "A smaller set is usually better. For many learners, 5 to 15 words in a session is enough if the words are reviewed properly and reused over several days.",
  },
];

const VOCABULARY_IN_CONTEXT_FAQ_ENTRIES = [
  {
    question: "Why is learning vocabulary in context better?",
    answer:
      "Learning vocabulary in context helps you remember meaning, tone, grammar, and common word partnerships at the same time. It leads to deeper understanding than memorizing isolated definitions.",
  },
  {
    question: "Can you learn vocabulary just by reading?",
    answer:
      "Reading is one of the best sources of contextual learning, especially when the material is understandable and interesting. It works even better when you save useful words and review them actively later.",
  },
  {
    question: "What does it mean to learn a word in context?",
    answer:
      "It means learning the word inside a real sentence or situation so you can understand not just what it means, but how it is used.",
  },
];

const SPACED_REPETITION_FAQ_ENTRIES = [
  {
    question: "What is spaced repetition for vocabulary?",
    answer:
      "Spaced repetition is a review method where you revisit vocabulary over gradually increasing intervals instead of cramming in one sitting.",
  },
  {
    question: "Does spaced repetition help you remember words longer?",
    answer:
      "Yes. Spaced review is widely supported by learning research because it strengthens memory over time and reduces the quick forgetting that follows cramming.",
  },
  {
    question: "How often should I review vocabulary?",
    answer:
      "New words should be reviewed sooner, while familiar words can be reviewed less often. The right schedule depends on how easily you can recall each word.",
  },
];

const WORDS_PER_DAY_FAQ_ENTRIES = [
  {
    question: "How many vocabulary words should I learn per day?",
    answer:
      "For many learners, 5 to 15 new words per day is a realistic target. The best number depends on how much time you have for review and how difficult the words are.",
  },
  {
    question: "Is learning 20 words a day too much?",
    answer:
      "It can be too much if you do not have enough time to review them properly. High volume only helps when retention stays strong.",
  },
  {
    question: "What matters more, daily word count or review quality?",
    answer:
      "Review quality matters more. A smaller number of words that you can recall and use is better than a large number you quickly forget.",
  },
];

const FORGET_LOOKED_UP_WORDS_FAQ_ENTRIES = [
  {
    question: "Why do I forget words I look up while reading?",
    answer:
      "Because a dictionary lookup usually helps you understand the sentence, but it does not automatically create long-term memory. Words tend to stick better when you revisit them with active recall and a little spacing.",
  },
  {
    question: "Is reading alone enough to remember new vocabulary?",
    answer:
      "Reading is one of the best ways to meet useful words in context, but it often works better when you save important words and review them later. Exposure helps, while recall practice makes the memory more durable.",
  },
  {
    question: "What is the best way to remember words from books?",
    answer:
      "Save useful words in context, review them with active recall, and revisit the ones you keep missing. A short follow-up routine usually works better than relying on the original lookup.",
  },
];

const REMEMBER_VOCABULARY_FROM_BOOKS_FAQ_ENTRIES = [
  {
    question: "What is the best way to remember vocabulary from books?",
    answer:
      "The best way is to save useful words in context, review them with active recall, and revisit the ones you keep forgetting. A short follow-up routine usually works better than relying on the original lookup alone.",
  },
  {
    question: "Should I save every unfamiliar word I see in a book?",
    answer:
      "Usually no. It is better to save the words that feel useful, repeated, expressive, or likely to appear again. Selectivity makes review easier and improves retention.",
  },
  {
    question: "Why do words from novels disappear so quickly?",
    answer:
      "Because seeing a word once, even in good context, often creates recognition more than lasting recall. The word usually needs retrieval practice and a second encounter before it sticks.",
  },
];

function upsertMetaTag(attributeName, attributeValue, content) {
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attributeName, attributeValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", String(content || ""));
}

function upsertCanonicalLink(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(scriptId, payload) {
  let el = document.head.querySelector(`#${scriptId}`);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("id", scriptId);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
}

function removeHeadNodeById(nodeId) {
  const el = document.head.querySelector(`#${nodeId}`);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function isBearerAuthToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function navigateTo(path) {
  const nextPath = String(path || "/").trim() || "/";
  window.history.replaceState(null, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function isAuthFailureErrorCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "missing-auth-token" ||
    normalized === "invalid-auth-token" ||
    normalized === "expired-auth-token"
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function AppRoute() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const storedAuthToken = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
      const headers = {};
      if (isBearerAuthToken(storedAuthToken)) {
        headers.Authorization = `Bearer ${storedAuthToken}`;
      }

      for (let attempt = 1; attempt <= AUTH_CHECK_MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(`${AUTH_API_PATH}/account`, {
            credentials: "include",
            headers,
          });
          if (cancelled) return;

          if (response.ok) {
            setStatus("authorized");
            return;
          }

          const payload = await response.json().catch(() => ({}));
          const errorCode = String(payload?.error || "").trim().toLowerCase();

          if (isAuthFailureErrorCode(errorCode)) {
            setStatus("guest");
            navigateTo("/login");
            return;
          }
        } catch {
          if (cancelled) return;
          // Keep retrying below for transient network/API failures.
        }

        if (attempt < AUTH_CHECK_MAX_ATTEMPTS) {
          await wait(AUTH_CHECK_RETRY_DELAY_MS * attempt);
        }
      }

      if (!cancelled) {
        setStatus("guest");
        navigateTo("/login");
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "authorized") {
    return <App />;
  }

  if (status === "guest") {
    return <LoginPage initialMode="login" />;
  }

  return null;
}

function RootPage() {
  const [route, setRoute] = useState(() => getRoute(window.location.pathname));
  const [analyticsConsent, setAnalyticsConsent] = useState(() => getAnalyticsConsentStatus());
  const showConsentBanner = isAnalyticsConfigured() && analyticsConsent === "unset";

  useEffect(() => {
    if (analyticsConsent === "granted") {
      initAnalytics();
    }
  }, [analyticsConsent]);

  useEffect(() => {
    const handleRouteChange = () => {
      setRoute(getRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  useEffect(() => {
    if (analyticsConsent !== "granted") return;
    const path = `${window.location.pathname}${window.location.search || ""}`;
    trackPageView(path, { route_name: route });
  }, [route, analyticsConsent]);

  useEffect(() => {
    const seo = ROUTE_SEO[route] || ROUTE_SEO.landing;
    const pathname = window.location.pathname || "/";
    const canonicalUrl = `${SITE_URL}${pathname}`;
    const ogImageUrl = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
    const breadcrumbJsonLd = getBreadcrumbStructuredData(route, SITE_URL);

    document.title = seo.title;
    upsertMetaTag("name", "description", seo.description);
    upsertMetaTag("name", "robots", seo.indexable ? "index,follow" : "noindex,nofollow");
    upsertCanonicalLink(canonicalUrl);

    upsertMetaTag(
      "property",
      "og:type",
      ARTICLE_ROUTE_KEYS.has(route) ? "article" : "website",
    );
    upsertMetaTag("property", "og:site_name", "Vocalibry");
    upsertMetaTag("property", "og:title", seo.title);
    upsertMetaTag("property", "og:description", seo.description);
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("property", "og:image", ogImageUrl);

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:title", seo.title);
    upsertMetaTag("name", "twitter:description", seo.description);
    upsertMetaTag("name", "twitter:image", ogImageUrl);

    const jsonLdId = "seo-jsonld-route";
    if (route === "landing") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: "Vocalibry",
            url: SITE_URL,
            potentialAction: {
              "@type": "SearchAction",
              target: `${SITE_URL}/?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "Organization",
            name: "Vocalibry",
            url: SITE_URL,
            logo: `${SITE_URL}/favicon.png`,
          },
          {
            "@type": "SoftwareApplication",
            name: "Vocalibry",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: SITE_URL,
            description:
              "Vocabulary learning app with flashcards, quizzes, and smart review to improve English fluency.",
            offers: [
              {
                "@type": "Offer",
                price: "0",
                priceCurrency: "AUD",
                category: "Free",
              },
              {
                "@type": "Offer",
                price: "6",
                priceCurrency: "AUD",
                category: "Pro",
              },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "vocabulary-guide") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "How to expand your vocabulary: what research suggests actually works",
            description:
              "A research-backed guide to improving vocabulary through contextual learning, retrieval practice, spaced repetition, and active use.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/how-to-expand-your-vocabulary`,
            url: `${SITE_URL}/how-to-expand-your-vocabulary`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: [
              "how to expand your vocabulary",
              "how to improve vocabulary",
              "improve vocabulary",
              "build vocabulary",
              "vocabulary learning tips",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: VOCABULARY_GUIDE_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "memorize-vocabulary") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "How to memorize vocabulary and actually remember it",
            description:
              "A practical guide to memorizing vocabulary with active recall, spaced repetition, contextual examples, and active use.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/how-to-memorize-vocabulary`,
            url: `${SITE_URL}/how-to-memorize-vocabulary`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: [
              "how to memorize vocabulary",
              "memorize vocabulary",
              "how to remember vocabulary",
              "vocabulary memory tips",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: MEMORIZE_VOCABULARY_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "vocabulary-in-context") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "How to learn vocabulary in context",
            description:
              "A practical guide to learning vocabulary in context through reading, listening, sentence examples, collocations, and active recall.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/how-to-learn-vocabulary-in-context`,
            url: `${SITE_URL}/how-to-learn-vocabulary-in-context`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: [
              "how to learn vocabulary in context",
              "learn vocabulary in context",
              "vocabulary in context",
              "contextual vocabulary learning",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: VOCABULARY_IN_CONTEXT_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "guides") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: "Vocabulary guides and study strategies",
            url: `${SITE_URL}/guides`,
            description:
              "A hub page for vocabulary learning guides on memorization, contextual learning, spaced repetition, and study habits.",
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "spaced-repetition-vocabulary") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "Spaced repetition for vocabulary",
            description:
              "A practical guide to using spaced repetition for vocabulary with review timing, active recall, and long-term retention in mind.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/spaced-repetition-for-vocabulary`,
            url: `${SITE_URL}/spaced-repetition-for-vocabulary`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: ["spaced repetition for vocabulary", "vocabulary spaced repetition", "review vocabulary"],
          },
          {
            "@type": "FAQPage",
            mainEntity: SPACED_REPETITION_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "words-per-day") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "How many words should you learn per day?",
            description:
              "A practical guide to choosing a realistic daily vocabulary target based on time, review capacity, and retention.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/how-many-words-should-you-learn-per-day`,
            url: `${SITE_URL}/how-many-words-should-you-learn-per-day`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: ["how many words should you learn per day", "vocabulary words per day", "daily vocabulary target"],
          },
          {
            "@type": "FAQPage",
            mainEntity: WORDS_PER_DAY_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "forget-looked-up-words") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "Why you forget words you look up while reading and how to remember them",
            description:
              "A practical guide to retaining vocabulary from reading by combining context, active recall, and review timing.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/why-you-forget-words-you-look-up-while-reading`,
            url: `${SITE_URL}/why-you-forget-words-you-look-up-while-reading`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: [
              "why do I forget words I look up while reading",
              "remember words from reading",
              "forget vocabulary from books",
              "retain vocabulary from reading",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: FORGET_LOOKED_UP_WORDS_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else if (route === "remember-vocabulary-from-books") {
      upsertJsonLd(jsonLdId, {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            headline: "How to remember vocabulary from books",
            description:
              "A practical guide to remembering words from books through context, active recall, and focused review.",
            author: {
              "@type": "Organization",
              name: "Vocalibry",
            },
            publisher: {
              "@type": "Organization",
              name: "Vocalibry",
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/favicon.png`,
              },
            },
            mainEntityOfPage: `${SITE_URL}/how-to-remember-vocabulary-from-books`,
            url: `${SITE_URL}/how-to-remember-vocabulary-from-books`,
            image: ogImageUrl,
            inLanguage: "en",
            keywords: [
              "how to remember vocabulary from books",
              "remember words from books",
              "how to remember words from novels",
              "vocabulary from reading books",
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: REMEMBER_VOCABULARY_FROM_BOOKS_FAQ_ENTRIES.map((entry) => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
              },
            })),
          },
          ...(breadcrumbJsonLd ? [breadcrumbJsonLd] : []),
        ],
      });
    } else {
      removeHeadNodeById(jsonLdId);
    }
  }, [route]);

  function handleConsentUpdate(nextStatus) {
    setAnalyticsConsentStatus(nextStatus);
    setAnalyticsConsent(nextStatus);
    if (nextStatus === "granted") {
      initAnalytics();
      const path = `${window.location.pathname}${window.location.search || ""}`;
      trackPageView(path, { route_name: route });
    }
  }

  let pageContent = <LandingPage />;
  if (route === "app") pageContent = <AppRoute />;
  if (route === "login") pageContent = <LoginPage initialMode="login" />;
  if (route === "register") pageContent = <LoginPage initialMode="register" />;
  if (route === "forgot-password") pageContent = <ForgotPasswordPage />;
  if (route === "terms") pageContent = <TermsPage />;
  if (route === "privacy") pageContent = <PrivacyPage />;
  if (route === "disclaimer") pageContent = <DisclaimerPage />;
  if (route === "pricing") pageContent = <PricingPage />;
  if (route === "features") pageContent = <FeaturesPage />;
  if (route === "vocabulary-guide") pageContent = <VocabularyGuidePage />;
  if (route === "memorize-vocabulary") pageContent = <MemorizeVocabularyPage />;
  if (route === "vocabulary-in-context") pageContent = <VocabularyInContextPage />;
  if (route === "guides") pageContent = <GuidesPage />;
  if (route === "spaced-repetition-vocabulary") pageContent = <SpacedRepetitionVocabularyPage />;
  if (route === "words-per-day") pageContent = <WordsPerDayPage />;
  if (route === "forget-looked-up-words") pageContent = <ForgetLookedUpWordsPage />;
  if (route === "remember-vocabulary-from-books") pageContent = <RememberVocabularyFromBooksPage />;
  if (route === "contact") pageContent = <ContactPage />;

  return (
    <>
      {pageContent}
      {showConsentBanner ? (
        <div className="cookieConsentBanner" role="dialog" aria-live="polite" aria-label="Cookie consent">
          <p>
            We use analytics cookies to understand usage and improve Vocalibry. You can change this later in
            your browser settings. See our <a href="/privacy">Privacy Policy</a>.
          </p>
          <div className="cookieConsentActions">
            <button
              type="button"
              className="cookieConsentBtn secondary"
              onClick={() => handleConsentUpdate("denied")}
            >
              Reject
            </button>
            <button
              type="button"
              className="cookieConsentBtn primary"
              onClick={() => handleConsentUpdate("granted")}
            >
              Accept
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const rootElement = document.getElementById("root");
const appTree = (
  <StrictMode>
    <RootPage />
  </StrictMode>
);

if (rootElement?.hasChildNodes()) {
  hydrateRoot(rootElement, appTree);
} else if (rootElement) {
  createRoot(rootElement).render(appTree);
}
