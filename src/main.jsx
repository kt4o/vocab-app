import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { TermsPage } from "./pages/TermsPage.jsx";
import { PrivacyPage } from "./pages/PrivacyPage.jsx";
import { DisclaimerPage } from "./pages/DisclaimerPage.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { PricingPage } from "./pages/PricingPage.jsx";
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
  if (normalizedPath === "/contact") return "contact";
  return "landing";
}

function navigateTo(path) {
  const nextPath = String(path || "/").trim() || "/";
  window.history.replaceState(null, "", nextPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function AppRoute() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const storedAuthToken = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
        const headers = {};
        if (isBearerAuthToken(storedAuthToken)) {
          headers.Authorization = `Bearer ${storedAuthToken}`;
        }
        const response = await fetch(`${AUTH_API_PATH}/account`, {
          credentials: "include",
          headers,
        });
        if (cancelled) return;
        if (response.ok) {
          setStatus("authorized");
          return;
        }
      } catch {
        // Fall back to public auth flow if session verification is unavailable.
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
