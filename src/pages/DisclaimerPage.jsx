const LAST_UPDATED = "April 8, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function DisclaimerPage() {
  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/pricing">Pricing</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/contact">Contact</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="legalMain">
        <h1>Disclaimer</h1>
        <p className="legalUpdated">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Educational Information Only</h2>
          <p>
            Vocalibry is an educational tool for vocabulary learning and productivity. Content and features
            are provided for general information and study support only.
          </p>
        </section>

        <section>
          <h2>2. No Professional Advice</h2>
          <p>
            Nothing in the app is legal, medical, mental-health, financial, or other professional advice.
            Always seek qualified professional guidance for decisions in those areas.
          </p>
        </section>

        <section>
          <h2>3. No Guaranteed Outcomes</h2>
          <p>
            We do not guarantee exam scores, fluency, academic outcomes, or any specific learning result.
            Outcomes depend on many factors outside our control.
          </p>
        </section>

        <section>
          <h2>4. Accuracy and Availability</h2>
          <p>
            While we aim for accuracy and reliability, content may include mistakes or become outdated, and
            service interruptions may occur.
          </p>
        </section>

        <section>
          <h2>5. Social Metrics and Leaderboards</h2>
          <p>
            Social scores, streaks, levels, and leaderboard positions are informational app metrics only.
            They are not official rankings, certifications, or guarantees of skill.
          </p>
        </section>

        <section>
          <h2>6. Classroom and Teacher Analytics</h2>
          <p>
            If your account is linked to a school or classroom cohort, teacher-facing analytics are provided to
            support learning progress monitoring. These analytics are educational indicators and should not be
            treated as clinical, diagnostic, or high-stakes evaluation tools.
          </p>
        </section>

        <section>
          <h2>7. Third-Party Services and Future Ads</h2>
          <p>
            The service may include third-party tools and, in the future, advertising providers. We do not
            control third-party content and do not endorse advertised products or claims.
          </p>
        </section>

        <section>
          <h2>8. Dictionary Content and Licensing</h2>
          <p>
            Definitions may be delivered by third-party dictionary services, including Free Dictionary API
            (dictionaryapi.dev), and may include upstream collaborative dictionary content.
          </p>
          <p>
            Such content may be governed by separate license terms from its original source, including
            attribution or share-alike obligations. You are responsible for complying with applicable
            third-party license requirements when reusing dictionary text outside normal in-app study use.
          </p>
        </section>

        <section>
          <h2>9. Limitation of Responsibility</h2>
          <p>
            To the maximum extent allowed by law, your use of the app is at your own risk, and we are not
            responsible for indirect or consequential loss arising from use of the service.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            Questions about this Disclaimer: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
