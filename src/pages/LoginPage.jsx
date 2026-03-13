import { useEffect, useState } from "react";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;
const AUTH_TOKEN_STORAGE_KEY = "vocab_auth_token";
const AUTH_USERNAME_STORAGE_KEY = "vocab_auth_username";

function getStoredAuthToken() {
  const raw = String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  if (!raw) return "";
  const lowered = raw.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return "";
  return raw;
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
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registerCodeCooldownUntil, setRegisterCodeCooldownUntil] = useState(0);
  const [registerCodeCooldownSeconds, setRegisterCodeCooldownSeconds] = useState(0);

  useEffect(() => {
    const existingToken = getStoredAuthToken();
    if (existingToken) {
      window.location.replace("/app");
    }
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
    if (!normalizedUsername || !password) {
      setError("Username and password are required.");
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
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "register" && !acceptedLegal) {
      setError("Please accept Terms & Conditions and Privacy Policy.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${AUTH_API_PATH}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? {
                email: normalizedEmail,
                verifiedEmailToken,
                username: normalizedUsername,
                password,
                marketingOptIn,
              }
            : { username: normalizedUsername, password }
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
              :
          backendError === "invalid-username"
            ? "Use 3-24 chars: lowercase letters, numbers, underscore."
            : backendError === "weak-password"
              ? "Password must be at least 8 characters."
              : backendError === "username-taken"
                ? "That username is already taken."
                : backendError === "invalid-credentials"
                  ? "Incorrect username or password."
                  : "Could not sign in. Please try again.";
        setError(nextError);
        return;
      }

      const token = String(payload?.token || "").trim();
      const savedUsername = String(payload?.username || normalizedUsername).trim().toLowerCase();
      if (!token) {
        setError("Auth token was not returned by the server.");
        return;
      }

      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, savedUsername);
      window.location.replace("/app");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="publicPage loginPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </header>

      <main className="landingMain">
        <section className="publicAuthCard">
          <p className="heroEyebrow">Account Access</p>
          <h1>{mode === "register" ? "Create your account" : "Log in to Vocalibry"}</h1>
          <p className="heroCopy">
            {mode === "register"
              ? registerStep === "email"
                ? "Start by connecting your email."
                : "Now choose your username and password."
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
              Username
            </label>
            <input
              id="auth-username"
              className="publicAuthInput"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) setError("");
              }}
              autoComplete="username"
              placeholder="username"
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
              placeholder="password"
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
                    I accept the <a href="/terms">Terms &amp; Conditions</a> and <a href="/privacy">Privacy Policy</a>
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
