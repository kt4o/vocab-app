import { useState } from "react";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const AUTH_API_PATH = `${API_BASE_URL}/api/auth`;

export function ForgotPasswordPage() {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  async function requestCode() {
    if (isSubmitting || cooldownSeconds > 0) return;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/password-reset/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
        if (backendError === "password-reset-code-cooldown" && retryAfterSeconds > 0) {
          setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
          setError(`Please wait ${Math.max(1, retryAfterSeconds)}s before requesting another code.`);
          return;
        }
        const nextError =
          backendError === "invalid-email"
            ? "Enter a valid email address."
            : backendError === "email-delivery-not-configured"
              ? "Email delivery is not configured on the backend."
              : "Could not send reset code. Please try again.";
        setError(nextError);
        return;
      }
      setEmail(normalizedEmail);
      setStep("verify");
      setSuccess("If this email exists, a reset code has been sent.");
      setCooldownUntil(Date.now() + 60 * 1000);
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode() {
    if (isSubmitting) return;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the 6-digit reset code.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/password-reset/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const nextError =
          backendError === "verification-code-expired"
            ? "Reset code expired. Request a new code."
            : backendError === "invalid-verification-code"
              ? "Reset code is incorrect."
              : backendError === "password-reset-session-missing"
                ? "Please request a new reset code."
                : "Could not verify reset code.";
        setError(nextError);
        return;
      }
      const nextResetToken = String(payload?.resetToken || "").trim();
      if (!nextResetToken) {
        setError("Reset verification failed. Please retry.");
        return;
      }
      setResetToken(nextResetToken);
      setStep("reset");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function completeReset() {
    if (isSubmitting) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${AUTH_API_PATH}/password-reset/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = String(payload?.error || "").trim().toLowerCase();
        const nextError =
          backendError === "weak-password"
            ? "Password must be at least 8 characters."
            : backendError === "reset-session-invalid"
              ? "Reset session invalid or expired. Start again."
              : "Could not reset password.";
        setError(nextError);
        return;
      }
      setSuccess("Password updated successfully. You can now log in.");
      setStep("done");
    } catch {
      setError("Could not reach auth service. Check backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/login">Log in</a>
          <a href="/register">Register</a>
        </nav>
      </header>

      <main className="landingMain">
        <section className="publicAuthCard">
          <p className="heroEyebrow">Password Reset</p>
          <h1>Reset your password</h1>

          <div className="publicAuthForm">
            {(step === "request" || step === "verify" || step === "reset") && (
              <>
                <label htmlFor="reset-email" className="publicAuthLabel">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  className="publicAuthInput"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  disabled={isSubmitting || step !== "request"}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </>
            )}

            {step === "request" ? (
              <button
                type="button"
                className="publicPrimaryBtn publicAuthSubmit"
                onClick={requestCode}
                disabled={isSubmitting || cooldownSeconds > 0}
              >
                {isSubmitting
                  ? "Sending code..."
                  : cooldownSeconds > 0
                    ? `Resend in ${cooldownSeconds}s`
                    : "Send reset code"}
              </button>
            ) : null}

            {step === "verify" ? (
              <>
                <label htmlFor="reset-code" className="publicAuthLabel">
                  Reset code
                </label>
                <input
                  id="reset-code"
                  className="publicAuthInput"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={isSubmitting}
                />
                <div className="settingsRow">
                  <button
                    type="button"
                    className="publicSecondaryBtn publicAuthSubmit"
                    onClick={requestCode}
                    disabled={isSubmitting || cooldownSeconds > 0}
                  >
                    {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="publicPrimaryBtn publicAuthSubmit"
                    onClick={verifyCode}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Verifying..." : "Verify code"}
                  </button>
                </div>
              </>
            ) : null}

            {step === "reset" ? (
              <>
                <label htmlFor="reset-password" className="publicAuthLabel">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  className="publicAuthInput"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <label htmlFor="reset-confirm-password" className="publicAuthLabel">
                  Confirm password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  className="publicAuthInput"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="confirm new password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="publicPrimaryBtn publicAuthSubmit"
                  onClick={completeReset}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update password"}
                </button>
              </>
            ) : null}

            {step === "done" ? (
              <p className="heroCopy">
                Password updated. Continue to <a href="/login">Log in</a>.
              </p>
            ) : null}

            {error ? <p className="publicAuthError">{error}</p> : null}
            {success ? <p className="legalUpdated">{success}</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
