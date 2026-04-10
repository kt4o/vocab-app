const LAST_UPDATED = "April 8, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function TermsPage() {
  return (
    <div className="publicPage legalPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/disclaimer">Disclaimer</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="legalMain">
        <h1>Terms and Conditions</h1>
        <p className="legalUpdated">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Acceptance</h2>
          <p>
            By using Vocalibry, you agree to these Terms. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2>2. Account Responsibility</h2>
          <p>
            You are responsible for your account credentials and activity under your account. Keep login
            details secure and notify us if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2>3. Eligibility</h2>
          <p>
            You must meet the minimum digital consent age in your jurisdiction, or use the service with
            parent/guardian permission where required.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>
            You agree not to misuse, disrupt, abuse, or reverse-engineer the service, and not to manipulate
            game/learning mechanics or social features.
          </p>
          <p>
            You also agree not to use offensive, hateful, or abusive account names, impersonate others, or
            use social features to harass, spam, or intimidate users.
          </p>
        </section>

        <section>
          <h2>5. User Content</h2>
          <p>
            You are responsible for content you add (for example: words, definitions, notes). You confirm
            you have rights to submit that content.
          </p>
        </section>

        <section>
          <h2>6. Subscription and Billing</h2>
          <p>
            Paid features, trials, pricing, and billing terms may change over time. Subscription processing
            is provided by third-party payment providers. You are responsible for reviewing billing details
            before confirming purchase.
          </p>
          <p>
            Paid subscriptions may auto-renew unless canceled. You can manage or cancel billing through the
            billing provider flow available in your account settings.
          </p>
        </section>

        <section>
          <h2>7. Account Deletion and Subscription State</h2>
          <p>
            You may request account deletion from within the app. Where applicable, active paid subscriptions
            may need to be canceled first before deletion is permitted.
          </p>
        </section>

        <section>
          <h2>8. Analytics, Ads, and Third-Party Content</h2>
          <p>
            We use analytics tools to measure and improve the service. We may also introduce advertising in
            the future. Ads and third-party links/content may be provided by partners. We do not guarantee or
            endorse third-party claims, offers, or products.
          </p>
          <p>
            Where school or classroom access is enabled, authorized teacher or school administrators may access
            student learning analytics for users connected to that cohort, including added-word activity and
            difficulty/category trends for educational monitoring and instruction.
          </p>
        </section>

        <section>
          <h2>9. Dictionary Data Sources and Attribution</h2>
          <p>
            Definitions and related lexical content may be retrieved from third-party dictionary providers,
            including Free Dictionary API (dictionaryapi.dev). Upstream content may include material sourced
            from collaborative dictionaries such as Wiktionary.
          </p>
          <p>
            Where applicable, dictionary text remains subject to its original license terms (for example
            attribution and share-alike requirements under Creative Commons licenses). You agree not to remove
            required attribution notices or represent third-party dictionary content as exclusively owned by
            Vocalibry.
          </p>
        </section>

        <section>
          <h2>10. Intellectual Property</h2>
          <p>
            The service design, branding, and software are owned by Vocalibry or its licensors. You may not
            copy, redistribute, or exploit service materials except as permitted by law or written permission.
          </p>
        </section>

        <section>
          <h2>11. Service Changes and Availability</h2>
          <p>
            We may update, modify, suspend, or discontinue features at any time. The service is provided
            on an &quot;as is&quot; and &quot;as available&quot; basis.
          </p>
        </section>

        <section>
          <h2>12. No Guarantee of Results</h2>
          <p>
            Vocalibry is an educational tool and does not guarantee exam scores, fluency, employment, or any
            specific outcome.
          </p>
        </section>

        <section>
          <h2>13. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Vocalibry is not liable for indirect, incidental,
            special, consequential, or punitive damages arising from use of the service.
          </p>
        </section>

        <section>
          <h2>14. Indemnity</h2>
          <p>
            You agree to indemnify and hold harmless Vocalibry from claims, damages, or expenses resulting
            from your misuse of the service, violation of these Terms, or infringement of third-party rights.
          </p>
        </section>

        <section>
          <h2>15. Updates to Terms</h2>
          <p>
            We may revise these Terms from time to time. Continued use after updates means you accept the
            revised Terms.
          </p>
        </section>

        <section>
          <h2>16. Contact</h2>
          <p>
            Questions about these Terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
