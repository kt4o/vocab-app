const LAST_UPDATED = "March 9, 2026";

export function TermsPage() {
  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/privacy">Privacy</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="legalMain">
        <h1>Terms and Conditions</h1>
        <p className="legalUpdated">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Vocalibry, you agree to these Terms and Conditions. If you do not agree,
            do not use the service.
          </p>
        </section>

        <section>
          <h2>2. Eligibility and Account Responsibility</h2>
          <p>
            You are responsible for your account credentials and all activity under your account. Keep your
            login details secure and notify us if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2>3. Age Requirement</h2>
          <p>
            By creating an account or using the service, you confirm that you meet the minimum digital
            consent age required in your country or region. If you are below this age, you may only use the
            service with permission and supervision from a parent or legal guardian.
          </p>
          <p>
            If we become aware that an account was created in violation of applicable age requirements, we
            may suspend or remove the account and associated data.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>
            You agree to use the app lawfully and not attempt to disrupt, reverse engineer, or misuse the
            service.
          </p>
          <p>
            You must not abuse social systems, automate harmful behavior, or attempt to manipulate rankings,
            rewards, or other progression mechanics.
          </p>
        </section>

        <section>
          <h2>5. User Content</h2>
          <p>
            You are responsible for the words, definitions, and learning data you enter. You confirm you
            have rights to any content you add.
          </p>
        </section>

        <section>
          <h2>6. Social and Community Features</h2>
          <p>
            Features such as friends, social requests, and leaderboards are provided to support learning
            motivation. We may remove abusive content, restrict social actions, or suspend related access if
            misuse is detected.
          </p>
        </section>

        <section>
          <h2>7. Virtual Economy (Coins, XP, Market)</h2>
          <p>
            In-app coins, XP, levels, and upgrades are virtual product features with no real-world monetary
            value, are non-transferable, and are not redeemable for cash or property.
          </p>
          <p>
            We may rebalance, adjust, or remove economy features to maintain fairness and service quality.
          </p>
        </section>

        <section>
          <h2>8. Service Availability and Changes</h2>
          <p>
            The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We may update,
            pause, or discontinue features at any time.
          </p>
        </section>

        <section>
          <h2>9. Suspension or Termination</h2>
          <p>
            We may suspend or terminate access if these terms are violated, if required for legal/security
            reasons, or if operation of the service is threatened.
          </p>
        </section>

        <section>
          <h2>10. Limitation of Liability</h2>
          <p>
            To the maximum extent allowed by law, Vocalibry is not liable for indirect, incidental, or
            consequential damages resulting from your use of the service.
          </p>
        </section>

        <section>
          <h2>11. Disclaimer</h2>
          <p>
            The app is provided for educational and productivity use. We do not guarantee uninterrupted
            availability, error-free operation, or specific learning outcomes.
          </p>
        </section>

        <section>
          <h2>12. Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the app after updates means you
            accept the revised terms.
          </p>
        </section>

        <section>
          <h2>13. Contact</h2>
          <p>
            For legal or support questions, contact us through the support channel listed in the app or
            deployment profile.
          </p>
        </section>
      </main>
    </div>
  );
}
