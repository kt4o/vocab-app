const LAST_UPDATED = "March 9, 2026";

export function PrivacyPage() {
  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/terms">Terms</a>
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
            We collect information you provide directly, including account details (for example: email,
            username, password), learning content (books, chapters, words, definitions, examples, and quiz
            history), and settings/preferences.
          </p>
          <p>
            We also collect operational data needed to run and secure the service, such as authentication
            tokens, request metadata, and device/browser storage data used by the app.
          </p>
          <p>
            If you use social features, we process friend requests, friend relationships, and leaderboard
            stats derived from your learning activity.
          </p>
        </section>

        <section>
          <h2>2. How We Use Information</h2>
          <p>
            We use your data to provide app functionality, authenticate your account, sync your state across
            sessions, power quiz/progress/social features, maintain service reliability, and improve product
            quality.
          </p>
          <p>
            We may use aggregated or de-identified usage information to understand product performance and
            improve the experience.
          </p>
        </section>

        <section>
          <h2>3. Data Storage and Security</h2>
          <p>
            Data may be stored in backend databases and local browser storage (for faster UX and offline-like
            continuity). We apply reasonable administrative and technical safeguards, but no system can be
            guaranteed 100% secure.
          </p>
        </section>

        <section>
          <h2>4. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with infrastructure/service providers
            strictly as needed to host, secure, and operate the app.
          </p>
          <p>
            Social/leaderboard views may show limited profile and activity metrics to other users according
            to feature design.
          </p>
        </section>

        <section>
          <h2>5. Retention</h2>
          <p>
            We retain data while your account is active and as needed for legitimate operational, security, or
            legal reasons. If you delete your account, we remove or anonymize data unless retention is
            required by law.
          </p>
        </section>

        <section>
          <h2>6. Your Choices and Rights</h2>
          <p>
            You may request access, correction, export, or deletion of your personal data, subject to
            applicable law. You can also manage key account actions in-app (for example: password changes,
            logout-all sessions, and account deletion).
          </p>
          <p>
            You can clear local browser storage at any time, but this may remove unsynced local state.
          </p>
        </section>

        <section>
          <h2>7. Children&apos;s Privacy</h2>
          <p>
            The service is not directed to children under the minimum age required by applicable law in your
            region. If you believe a child provided personal data without proper consent, contact us so we can
            review and remove it as appropriate.
          </p>
        </section>

        <section>
          <h2>8. International Users</h2>
          <p>
            Depending on where you use the service, your data may be processed in regions different from your
            own. By using the service, you understand that cross-border processing may occur.
          </p>
        </section>

        <section>
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The latest version will always be posted on
            this page.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            For privacy requests, contact us through the support channel listed in the app or deployment
            profile.
          </p>
        </section>
      </main>
    </div>
  );
}
