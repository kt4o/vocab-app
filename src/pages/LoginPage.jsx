import { useEffect, useState } from "react";
import { identifyAnalyticsUser, trackEvent } from "../lib/analytics.js";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";
const ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY = "vocab_onboarding_tutorial_pending";
const LEGAL_VERSION = "2026-03-14";
const SIGNUP_USERNAME_MESSAGE =
  "Username must be 3-24 characters: lowercase letters, numbers, or underscores only. Spaces become underscores.";
const SIGNUP_PASSWORD_MESSAGE =
  "Password must be 3-24 characters: English letters, numbers, or symbols only. No spaces or non-English characters.";

function isBearerAuthToken(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function isValidSignupPassword(value) {
  return /^[\x21-\x7E]{3,24}$/.test(String(value || ""));
}

function isValidSignupUsername(value) {
  return /^[a-z0-9_]{3,24}$/.test(String(value || ""));
}

function formatUsernameInput(value) {
  return String(value || "").replace(/ /g, "_");
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

export function LoginPage({ initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [registerStep, setRegisterStep] = useState("email");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifiedEmailToken, setVerifiedEmailToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registerCodeCooldownUntil, setRegisterCodeCooldownUntil] = useState(0);
  const [registerCodeCooldownSeconds, setRegisterCodeCooldownSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
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
        if (!cancelled && response.ok) {
          navigateTo("/app");
        }
      } catch {
        // Ignore temporary auth-check failures on public login page.
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!registerCodeCooldownUntil) {
      setRegisterCodeCooldownSeconds(0);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((registerCodeCooldownUntil - Date.now()) / 1000));
      setRegisterCodeCooldownSeconds(remaining);
      if (remaining <= 0) {
        setRegisterCodeCooldownUntil(0);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [registerCodeCooldownUntil]);

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function resetRegisterFlow() {
    setRegisterStep("email");
    setEmail("");
    setVerificationCode("");
    setVerifiedEmailToken("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setReferralCode("");
    setAcceptedLegal(false);
    setMarketingOptIn(false);
    setError("");
    setRegisterCodeCooldownUntil(0);
    setRegisterCodeCooldownSeconds(0);
  }

  async function requestEmailCode() {
    if (isSubmitting) return;
    if (registerCodeCooldownSeconds > 0) return;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${AUTH_API_PATH}/register/request-email-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
        const nextError =
          response.status === 404
            ? "Backend is outdated. Restart or redeploy the API to enable email verification."
            :
          backendError === "verification-code-cooldown"
            ? `Please wait ${Math.max(1, retryAfterSeconds)}s before requesting another code.`
            :
          backendError === "invalid-email"
            ? "Enter a valid email address."
            : backendError === "email-delivery-not-configured"
              ? "Email delivery is not configured on the backend yet."
            : backendError === "email-taken"
              ? "That email is already connected to an account."
              : "Could not send a verification code. Please try again.";
        if (backendError === "verification-code-cooldown" && retryAfterSeconds > 0) {
          setRegisterCodeCooldownUntil(Date.now() + retryAfterSeconds * 1000);
        }
        setError(nextError);
        return;
      }

      setEmail(normalizedEmail);
      setRegisterStep("verify");
      setRegisterCodeCooldownUntil(Date.now() + 60 * 1000);
      trackEvent("register_email_code_requested");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmailCode() {
    if (isSubmitting) return;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(verificationCode || "").trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/register/verify-email-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const nextError =
          response.status === 404
            ? "Backend is outdated. Restart or redeploy the API to enable email verification."
            :
          backendError === "verification-code-expired"
            ? "Verification code expired. Request a new code."
            : backendError === "invalid-verification-code"
              ? "Verification code is incorrect."
              : backendError === "verification-session-missing"
                ? "Please request a new verification code."
                : "Could not verify email. Please try again.";
        setError(nextError);
        return;
      }

      const nextVerifiedToken = String(payload?.verifiedEmailToken || "").trim();
      if (!nextVerifiedToken) {
        setError("Email verification did not return a session token.");
        return;
      }

      setVerifiedEmailToken(nextVerifiedToken);
      setRegisterStep("credentials");
      setError("");
      trackEvent("register_email_verified");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (mode === "register" && !normalizedUsername) {
      setError("Enter a username. " + SIGNUP_USERNAME_MESSAGE);
      return;
    }
    if (mode === "register" && !password) {
      setError("Enter a password. " + SIGNUP_PASSWORD_MESSAGE);
      return;
    }
    if (!normalizedUsername || !password) {
      setError("Enter your username/email and password.");
      return;
    }
    if (mode === "register" && !verifiedEmailToken) {
      setError("Verify your email before creating an account.");
      return;
    }
    if (mode === "register" && !isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "register" && !isValidSignupUsername(normalizedUsername)) {
      setError(SIGNUP_USERNAME_MESSAGE);
      return;
    }
    if (mode === "register" && !isValidSignupPassword(password)) {
      setError(SIGNUP_PASSWORD_MESSAGE);
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "register" && !acceptedLegal) {
      setError("Please accept Terms, Privacy Policy, and Disclaimer.");
      return;
    }
    const normalizedReferralCode = String(referralCode || "").trim().toUpperCase().replace(/\s+/g, "");

    setIsSubmitting(true);
    setError("");

    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${AUTH_API_PATH}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? {
                email: normalizedEmail,
                verifiedEmailToken,
                username: normalizedUsername,
                password,
                referralCode: normalizedReferralCode,
                marketingOptIn,
                acceptedLegal,
                legalVersion: LEGAL_VERSION,
              }
            : { identifier: normalizedUsername, username: normalizedUsername, password }
        ),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const nextError =
          backendError === "invalid-email"
            ? "Enter a valid email address."
            : backendError === "email-taken"
              ? "That email is already connected to an account."
            : backendError === "email-not-verified"
                ? "Verify your email before creating an account."
              : backendError === "legal-not-accepted"
                ? "Please accept Terms, Privacy Policy, and Disclaimer."
              : backendError === "invalid-referral-code"
                ? "That referral code is not active. Check the code and try again."
              :
          backendError === "invalid-username"
            ? SIGNUP_USERNAME_MESSAGE
            : backendError === "inappropriate-username"
              ? "Choose a different username. That one contains a blocked word."
            : backendError === "weak-password"
              ? SIGNUP_PASSWORD_MESSAGE
              : backendError === "username-taken"
                ? "That username is already taken."
                : backendError === "invalid-credentials"
                  ? "Incorrect username/email or password."
                  : "Could not sign in. Please try again.";
        setError(nextError);
        return;
      }

      const savedUsername = String(payload?.username || normalizedUsername).trim().toLowerCase();
      const safeUserId = Number(payload?.userId);
      const authToken = String(payload?.authToken || "").trim();
      if (isBearerAuthToken(authToken)) {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, savedUsername);
      if (mode === "register") {
        localStorage.setItem(ONBOARDING_TUTORIAL_PENDING_STORAGE_KEY, savedUsername || "1");
      }
      if (Number.isFinite(safeUserId) && safeUserId > 0) {
        identifyAnalyticsUser(safeUserId, {
          username: savedUsername,
          auth_method: "password",
        });
      }
      trackEvent(mode === "register" ? "register_success" : "login_success", {
        auth_method: "password",
      });
      const sessionHeaders = {};
      if (isBearerAuthToken(authToken)) {
        sessionHeaders.Authorization = `Bearer ${authToken}`;
      }
      try {
        const sessionCheckResponse = await fetch(`${AUTH_API_PATH}/account`, {
          credentials: "include",
          headers: sessionHeaders,
        });
        if (!sessionCheckResponse.ok) {
          const sessionPayload = await sessionCheckResponse.json().catch(() => ({}));
          const sessionError = String(sessionPayload?.error || "").trim().toLowerCase();
          if (isAuthFailureErrorCode(sessionError)) {
            setError(
              "Login succeeded, but your browser blocked the session cookie. Check API/Frontend domain, CORS, and cookie SameSite/Secure settings."
            );
            return;
          }
          // Non-auth failures here are usually transient; continue into /app and let route guard retry.
        }
      } catch {
        if (!isBearerAuthToken(authToken)) {
          setError("Could not reach auth service. Check backend and try again.");
          return;
        }
        // The login response already returned a bearer token, so do not make users click twice
        // just because the follow-up session check had a transient network failure.
      }

      navigateTo("/app");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="publicPage loginPage bg-[#faf8f5]">
      <PublicSiteHeader />

      <main className="landingMain">
        <section className="publicAuthCard">
          <p className="heroEyebrow">Account Access</p>
          <h1 style={{ fontFamily: '"Lora", Georgia, "Times New Roman", serif' }}>{mode === "register" ? "Create your account" : "Log in to Vocalibry"}</h1>
          <p className="heroCopy">
            {mode === "register"
              ? registerStep === "email"
                ? "Start by connecting your email. You can begin with the free plan and upgrade when you need Pro tools."
                : "Finish creating your account to start building your vocabulary library."
              : "Enter your account details to continue to the app."}
          </p>
          <div className="publicAuthModeSwitch" role="tablist" aria-label="Account mode">
            <button
              type="button"
              className={`publicAuthModeBtn ${mode === "login" ? "isActive" : ""}`}
              onClick={() => {
                setMode("login");
                resetRegisterFlow();
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={`publicAuthModeBtn ${mode === "register" ? "isActive" : ""}`}
              onClick={() => {
                setMode("register");
                resetRegisterFlow();
              }}
            >
              Register
            </button>
          </div>

          <form className="publicAuthForm" onSubmit={handleSubmit}>
            {mode === "register" && registerStep === "email" ? (
              <>
                <label htmlFor="auth-email" className="publicAuthLabel">
                  Email
                </label>
                <input
                  id="auth-email"
                  className="publicAuthInput"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="publicPrimaryBtn publicAuthSubmit"
                  onClick={requestEmailCode}
                  disabled={isSubmitting || registerCodeCooldownSeconds > 0}
                >
                  {isSubmitting
                    ? "Sending code..."
                    : registerCodeCooldownSeconds > 0
                      ? `Resend in ${registerCodeCooldownSeconds}s`
                      : "Send verification code"}
                </button>
                {error ? <p className="publicAuthError">{error}</p> : null}
              </>
            ) : null}
            {mode === "register" && registerStep === "verify" ? (
              <>
                <label htmlFor="auth-email-locked" className="publicAuthLabel">
                  Connected email
                </label>
                <input
                  id="auth-email-locked"
                  className="publicAuthInput"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                />
                <label htmlFor="auth-verify-code" className="publicAuthLabel">
                  Verification code
                </label>
                <input
                  id="auth-verify-code"
                  className="publicAuthInput"
                  value={verificationCode}
                  onChange={(event) => {
                    setVerificationCode(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  disabled={isSubmitting}
                />
                <div className="settingsRow">
                  <button
                    type="button"
                    className="publicAuthModeBtn"
                    onClick={() => {
                      setRegisterStep("email");
                      setVerificationCode("");
                      setVerifiedEmailToken("");
                      setError("");
                    }}
                    disabled={isSubmitting}
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    className="publicSecondaryBtn publicAuthSubmit"
                    onClick={requestEmailCode}
                    disabled={isSubmitting || registerCodeCooldownSeconds > 0}
                  >
                    {registerCodeCooldownSeconds > 0
                      ? `Resend in ${registerCodeCooldownSeconds}s`
                      : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="publicPrimaryBtn publicAuthSubmit"
                    onClick={verifyEmailCode}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Verifying..." : "Verify email"}
                  </button>
                </div>
                {error ? <p className="publicAuthError">{error}</p> : null}
              </>
            ) : null}
            {mode === "register" && registerStep === "credentials" ? (
              <>
                <label htmlFor="auth-email-locked" className="publicAuthLabel">
                  Verified email
                </label>
                <input
                  id="auth-email-locked"
                  className="publicAuthInput"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                />
                <button
                  type="button"
                  className="publicAuthModeBtn"
                  onClick={() => {
                    setRegisterStep("verify");
                    setError("");
                  }}
                  disabled={isSubmitting}
                >
                  Back to code
                </button>
              </>
            ) : null}

            {mode === "login" || (mode === "register" && registerStep === "credentials") ? (
              <>
            <label htmlFor="auth-username" className="publicAuthLabel">
              {mode === "login" ? "Username or Email" : "Username"}
            </label>
            <input
              id="auth-username"
              className="publicAuthInput"
              value={username}
              onChange={(event) => {
                setUsername(mode === "register" ? formatUsernameInput(event.target.value) : event.target.value);
                if (error) setError("");
              }}
              autoComplete="username"
              placeholder={mode === "login" ? "username or email" : "username"}
              disabled={isSubmitting}
            />

            <label htmlFor="auth-password" className="publicAuthLabel">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className="publicAuthInput"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              placeholder={mode === "register" ? "3-24 chars, no spaces" : "password"}
              disabled={isSubmitting}
            />

            {mode === "register" ? (
              <>
                <label htmlFor="auth-confirm-password" className="publicAuthLabel">
                  Confirm password
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  className="publicAuthInput"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="new-password"
                  placeholder="confirm password"
                  disabled={isSubmitting}
                />
                <label htmlFor="auth-referral-code" className="publicAuthLabel">
                  Referral code <span className="optionalLabel">(optional)</span>
                </label>
                <input
                  id="auth-referral-code"
                  type="text"
                  className="publicAuthInput"
                  value={referralCode}
                  onChange={(event) => {
                    setReferralCode(event.target.value.toUpperCase());
                    if (error) setError("");
                  }}
                  autoComplete="off"
                  placeholder="creator code"
                  maxLength={64}
                  disabled={isSubmitting}
                />
                <label className="publicAuthCheckRow">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => {
                      setAcceptedLegal(event.target.checked);
                      if (error) setError("");
                    }}
                    disabled={isSubmitting}
                  />
                  <span>
                    I accept the <a href="/terms">Terms &amp; Conditions</a>,{" "}
                    <a href="/privacy">Privacy Policy</a>, and{" "}
                    <a href="/disclaimer">Disclaimer</a>
                  </span>
                </label>
                <label className="publicAuthCheckRow">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(event) => {
                      setMarketingOptIn(event.target.checked);
                      if (error) setError("");
                    }}
                    disabled={isSubmitting}
                  />
                  <span>
                    Send me product updates, new feature announcements, and learning tips
                  </span>
                </label>
              </>
            ) : null}

            <button type="submit" className="publicPrimaryBtn publicAuthSubmit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "register"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "register"
                  ? "Create account"
                  : "Log in"}
            </button>
            {mode === "login" ? (
              <p className="publicAuthLegalNotice">
                By logging in, you confirm you agree to the <a href="/terms">Terms &amp; Conditions</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </p>
            ) : null}
            {mode === "login" ? (
              <p className="legalUpdated" style={{ marginTop: "6px" }}>
                <a href="/forgot-password">Forgot password?</a>
              </p>
            ) : null}
            {error ? <p className="publicAuthError">{error}</p> : null}
              </>
            ) : null}
          </form>
        </section>
      </main>
    </div>
  );
}
