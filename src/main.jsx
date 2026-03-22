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

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;

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
        const response = await fetch(`${AUTH_API_PATH}/account`, {
          credentials: "include",
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

  useEffect(() => {
    const handleRouteChange = () => {
      setRoute(getRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  if (route === "app") return <AppRoute />;
  if (route === "login") return <LoginPage initialMode="login" />;
  if (route === "register") return <LoginPage initialMode="register" />;
  if (route === "forgot-password") return <ForgotPasswordPage />;
  if (route === "terms") return <TermsPage />;
  if (route === "privacy") return <PrivacyPage />;
  if (route === "disclaimer") return <DisclaimerPage />;
  if (route === "pricing") return <PricingPage />;
  if (route === "contact") return <ContactPage />;
  return <LandingPage />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootPage />
  </StrictMode>
);
