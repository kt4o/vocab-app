const LAST_UPDATED = "March 14, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function PrivacyPage() {
  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/pricing">Pricing</a>
          <a href="/terms">Terms</a>
          <a href="/disclaimer">Disclaimer</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="legalMain">
        <h1>Privacy Policy</h1>
        <p className="legalUpdated">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>
            We collect data you provide directly, such as account details (email, username), learning content
            (books, chapters, words, notes), and settings/preferences.
          </p>
          <p>
            We also process operational data required to run the service, such as authentication/session data,
            basic request metadata, retention analytics events (for example daily session-start signals), and
            local browser storage used for app performance and continuity.
          </p>
        </section>

        <section>
          <h2>2. How We Use Information</h2>
          <p>
            We use data to provide app functionality, account security, sync features, learning progress,
            diagnostics, abuse prevention, and product improvements.
          </p>
        </section>

        <section>
          <h2>3. Social and Community Data</h2>
          <p>
            If you use social features, we process friend requests, friend relationships, and leaderboard
            metrics derived from learning activity.
          </p>
          <p>
            Your username and relevant leaderboard metrics may be visible to approved friends. Leaderboard
            rankings may be separated by plan tier (for example Free and Pro leagues).
          </p>
        </section>

        <section>
          <h2>4. Future Advertising and Cookies</h2>
          <p>
            We may introduce ads in the future. If we do, ad technology partners may use cookies or similar
            identifiers to measure performance, prevent fraud, and personalize ad experience where legally
            allowed.
          </p>
          <p>
            If ad features are introduced, we will update this policy and provide any consent controls
            required by applicable law.
          </p>
        </section>

        <section>
          <h2>5. Data Sharing</h2>
          <p>
            We do not sell personal information. We may share data with service providers strictly as needed
            to operate, secure, and improve the platform.
          </p>
          <p>
            This can include infrastructure, authentication/security tooling, email delivery providers, and
            payment processors for billing (for example Stripe, where enabled), and third-party dictionary
            providers used to return definition content.
          </p>
          <p>
            We may also disclose information if required by law, legal process, or valid government request.
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            We use reasonable administrative and technical safeguards. No system can be guaranteed 100%
            secure, and you use the service at your own risk.
          </p>
        </section>

        <section>
          <h2>7. Retention</h2>
          <p>
            We keep data while needed for service operation, security, legal compliance, and legitimate
            business purposes. Account deletion requests are handled according to applicable law and system
            constraints.
          </p>
          <p>
            Where billing is active, account deletion may require cancellation of an active paid subscription
            before deletion can proceed.
          </p>
        </section>

        <section>
          <h2>8. Your Rights and Choices</h2>
          <p>
            Subject to local law, you may request access, correction, export, or deletion of personal data.
            You may also manage key account controls in-app.
          </p>
        </section>

        <section>
          <h2>9. International Processing</h2>
          <p>
            Your data may be processed in countries different from your own. By using the service, you
            understand that cross-border processing may occur.
          </p>
        </section>

        <section>
          <h2>10. Children&apos;s Privacy</h2>
          <p>
            The service is not directed to children below the minimum legal age in their jurisdiction. If we
            learn personal data was provided without required consent, we will take appropriate action.
          </p>
        </section>

        <section>
          <h2>11. Policy Updates</h2>
          <p>
            We may update this Privacy Policy over time. The latest version will be posted on this page.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            Privacy questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
