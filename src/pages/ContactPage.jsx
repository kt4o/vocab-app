const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function ContactPage() {
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
          <a href="/disclaimer">Disclaimer</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="legalMain">
        <h1>Contact</h1>
        <p className="legalUpdated">We usually reply within 1-2 business days.</p>

        <section>
          <h2>Support Email</h2>
          <p>
            For account issues, verification problems, or general support, email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2>What To Include</h2>
          <p>
            Include your username, the issue you are seeing, and a screenshot if possible so we can help
            faster.
          </p>
        </section>
      </main>
    </div>
  );
}
