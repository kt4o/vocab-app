import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const LAST_UPDATED = "June 5, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function TermsPage() {
  return (
    <div className="publicPage legalPage">
      <PublicSiteHeader />

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
          <p>
            Vocalibry is not currently provided as a school-managed or classroom-managed service. Do not use
            Vocalibry to submit personal information about another person without appropriate authority.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>
            You agree not to misuse, disrupt, abuse, or reverse-engineer the service, and not to manipulate
            game or learning mechanics.
          </p>
          <p>
            You also agree not to use offensive, hateful, or abusive account names or impersonate others.
          </p>
        </section>

        <section>
          <h2>5. User Content</h2>
          <p>
            You are responsible for content you add (for example: words, definitions, notes). You confirm
            you have rights to submit that content.
          </p>
          <p>
            Do not submit confidential, sensitive, illegal, infringing, or private third-party information. Some
            user-entered words or short text may be sent to third-party AI, dictionary, or translation providers
            to generate definitions, translations, or related language results.
          </p>
        </section>

        <section>
          <h2>6. Subscription and Billing</h2>
          <p>
            Paid features, trials, pricing, taxes, currencies, renewal dates, and billing terms may change over
            time. Subscription processing is provided by third-party payment providers such as Stripe. You are
            responsible for reviewing billing details before confirming purchase.
          </p>
          <p>
            Free plans may include usage limits, including a cap on total saved words. Pro plans may remove or
            increase those limits as described on the pricing page or checkout flow.
          </p>
          <p>
            Paid subscriptions may auto-renew unless canceled. You can manage or cancel billing through the
            billing provider flow available in your account settings. Cancellation stops future renewal, but it
            may not automatically refund charges already incurred or remove access for the rest of a paid period.
          </p>
          <p>
            If a free trial is offered, the trial length and renewal terms will be shown in the checkout flow.
            Unless checkout states otherwise, the subscription may automatically convert to a paid subscription
            at the end of the trial. Refunds, if any, are handled case-by-case and may also be subject to payment
            processor rules, app store rules, card-network rules, and applicable consumer law.
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
          <h2>8. Analytics, Ads, Referral Codes, and Third-Party Content</h2>
          <p>
            We use analytics tools to measure and improve the service. We may also introduce advertising in
            the future. Ads and third-party links/content may be provided by partners. We do not guarantee or
            endorse third-party claims, offers, or products.
          </p>
          <p>
            Referral or creator codes may be used to attribute signups, paid conversions, or campaigns. A valid
            referral code does not guarantee a discount, commission, reward, or entitlement unless a separate
            written agreement or checkout offer says so.
          </p>
        </section>

        <section>
          <h2>9. AI, Dictionary Data Sources, and Attribution</h2>
          <p>
            Definitions, translations, examples, and related lexical content may be generated by or retrieved
            from third-party providers, including OpenAI API services, Jisho, Free Dictionary API
            (dictionaryapi.dev), Datamuse, and similar services. Upstream content may include material sourced
            from collaborative dictionaries such as Wiktionary.
          </p>
          <p>
            Where applicable, dictionary text remains subject to its original license terms (for example
            attribution and share-alike requirements under Creative Commons licenses). You agree not to remove
            required attribution notices or represent third-party dictionary content as exclusively owned by
            Vocalibry.
          </p>
          <p>
            AI-generated or provider-generated content may be inaccurate, incomplete, offensive, unavailable, or
            unsuitable for your specific context. You are responsible for reviewing content before relying on it.
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
