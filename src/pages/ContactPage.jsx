import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function ContactPage() {
  return (
    <div className="publicPage legalPage">
      <PublicSiteHeader />

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
