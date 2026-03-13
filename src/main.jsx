import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { TermsPage } from "./pages/TermsPage.jsx";
import { PrivacyPage } from "./pages/PrivacyPage.jsx";
import { ContactPage } from "./pages/ContactPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";

const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";

function getStoredAuthToken() {
  const raw = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  if (!raw) return "";
  const lowered = raw.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return "";
  return raw;
}

function getRoute(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/app") return "app";
  if (normalizedPath === "/login") return "login";
  if (normalizedPath === "/register") return "register";
  if (normalizedPath === "/forgot-password") return "forgot-password";
  if (normalizedPath === "/terms" || normalizedPath === "/terms-and-conditions") return "terms";
  if (normalizedPath === "/privacy" || normalizedPath === "/privacy-policy") return "privacy";
  if (normalizedPath === "/contact") return "contact";
  return "landing";
}

function RootPage() {
  const route = getRoute(window.location.pathname);
  const authToken = getStoredAuthToken();

  if (route === "app" && !authToken) {
    return <LoginPage initialMode="login" />;
  }

  if (route === "app") return <App />;
  if (route === "login") return <LoginPage initialMode="login" />;
  if (route === "register") return <LoginPage initialMode="register" />;
  if (route === "forgot-password") return <ForgotPasswordPage />;
  if (route === "terms") return <TermsPage />;
  if (route === "privacy") return <PrivacyPage />;
  if (route === "contact") return <ContactPage />;
  return <LandingPage />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootPage />
  </StrictMode>
);
