import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
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
import { LoginPage } from "./pages/LoginPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import {
  getAnalyticsConsentStatus,
  initAnalytics,
  isAnalyticsConfigured,
  setAnalyticsConsentStatus,
  trackPageView,
} from "./lib/analytics.js";

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
  {
    question: "Does Vocalibry support Japanese learners of English?",
    answer:
      "Yes. You can switch dictionary behavior to English-to-Japanese and use Japanese UI options while studying English vocabulary.",
  },
];

const ROUTE_SEO = {
  landing: {
    title: "Vocalibry | Never Forget a Word Again",
    description:
      "Confidently speak, read, and write English by learning words tailored to your level with flashcards and quizzes.",
    indexable: true,
  },
  pricing: {
    title: "Pricing | Vocalibry",
    description:
      "Compare Free and Pro plans for Vocalibry and choose the vocabulary-learning experience that fits your goals.",
    indexable: true,
  },
  features: {
    title: "Features | Vocalibry",
    description:
      "Explore Vocalibry features for vocabulary building, flashcards, quizzes, smart review, and progress tracking.",
    indexable: true,
  },
  contact: {
    title: "Contact | Vocalibry",
    description: "Get support for Vocalibry account, billing, and learning questions.",
    indexable: true,
  },
  terms: {
    title: "Terms & Conditions | Vocalibry",
    description: "Read the Terms & Conditions for using Vocalibry.",
    indexable: true,
  },
  privacy: {
    title: "Privacy Policy | Vocalibry",
    description: "Read how Vocalibry collects, uses, and protects your data.",
    indexable: true,
  },
  disclaimer: {
    title: "Disclaimer | Vocalibry",
    description: "Read the Vocalibry disclaimer and usage limitations.",
    indexable: true,
  },
  login: {
    title: "Log In | Vocalibry",
    description: "Log in to your Vocalibry account.",
    indexable: false,
  },
  register: {
    title: "Create Account | Vocalibry",
    description: "Create your Vocalibry account and start learning vocabulary.",
    indexable: false,
  },
  "forgot-password": {
    title: "Reset Password | Vocalibry",
    description: "Reset your Vocalibry account password.",
    indexable: false,
  },
  app: {
    title: "App | Vocalibry",
    description: "Vocalibry learning app.",
    indexable: false,
  },
};

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

function getRoute(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/app") return "app";
  if (normalizedPath === "/login") return "login";
  if (normalizedPath === "/register") return "register";
  if (normalizedPath === "/forgot-password") return "forgot-password";
  if (normalizedPath === "/terms" || normalizedPath === "/terms-and-conditions") return "terms";
  if (normalizedPath === "/privacy" || normalizedPath === "/privacy-policy") return "privacy";
  if (normalizedPath === "/disclaimer" || normalizedPath === "/legal-disclaimer") return "disclaimer";
  if (normalizedPath === "/pricing") return "pricing";
  if (normalizedPath === "/features") return "features";
  if (normalizedPath === "/contact") return "contact";
  return "landing";
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

    document.title = seo.title;
    upsertMetaTag("name", "description", seo.description);
    upsertMetaTag("name", "robots", seo.indexable ? "index,follow" : "noindex,nofollow");
    upsertCanonicalLink(canonicalUrl);

    upsertMetaTag("property", "og:type", "website");
    upsertMetaTag("property", "og:site_name", "Vocalibry");
    upsertMetaTag("property", "og:title", seo.title);
    upsertMetaTag("property", "og:description", seo.description);
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("property", "og:image", ogImageUrl);

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:title", seo.title);
    upsertMetaTag("name", "twitter:description", seo.description);
    upsertMetaTag("name", "twitter:image", ogImageUrl);

    const jsonLdId = "seo-jsonld-landing";
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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootPage />
  </StrictMode>
);
