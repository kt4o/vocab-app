import { StrictMode, useState } from "react";
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

const BETA_ACCESS_STORAGE_KEY = "vocab_beta_access_code";
const EARLY_ACCESS_STORAGE_KEY = "vocab_early_access_code";
const EARLY_ACCESS_CODE = String(
  import.meta.env.VITE_EARLY_ACCESS_CODE || import.meta.env.VITE_BETA_CODE || ""
).trim();

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

function hasEarlyAccess() {
  if (!EARLY_ACCESS_CODE) return true;
  const storedEarlyAccessCode = String(localStorage.getItem(EARLY_ACCESS_STORAGE_KEY) || "").trim();
  const storedBetaAccessCode = String(localStorage.getItem(BETA_ACCESS_STORAGE_KEY) || "").trim();
  return storedEarlyAccessCode === EARLY_ACCESS_CODE || storedBetaAccessCode === EARLY_ACCESS_CODE;
}

function EarlyAccessGate({ onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!EARLY_ACCESS_CODE || code.trim() === EARLY_ACCESS_CODE) {
      localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, EARLY_ACCESS_CODE);
      localStorage.setItem(BETA_ACCESS_STORAGE_KEY, EARLY_ACCESS_CODE);
      onUnlock(true);
      return;
    }
    setError("Invalid access code.");
  }

  return (
    <main className="betaGateWrap">
      <section className="betaGateCard">
        <p className="betaGateEyebrow">Early Access</p>
        <h1>Invite-Only Preview</h1>
        <p className="betaGateHint">Enter your access code to continue to Vocalibry.</p>
        <form onSubmit={handleSubmit} className="betaGateForm">
          <label className="visuallyHidden" htmlFor="early-access-code">Access code</label>
          <input
            id="early-access-code"
            className="betaGateInput"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) setError("");
            }}
            autoComplete="off"
            placeholder="Early access code"
            autoFocus
          />
          <button type="submit" className="betaGateBtn">Enter</button>
        </form>
        {error ? <p className="betaGateError">{error}</p> : null}
      </section>
    </main>
  );
}

function RootPage() {
  const route = getRoute(window.location.pathname);
  const [isEarlyAccessUnlocked, setIsEarlyAccessUnlocked] = useState(() => hasEarlyAccess());

  if (route === "landing" && !isEarlyAccessUnlocked) {
    return <EarlyAccessGate onUnlock={setIsEarlyAccessUnlocked} />;
  }

  if (route === "app") return <App />;
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
