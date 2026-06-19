import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const LAST_UPDATED = "June 5, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function PrivacyPage() {
  return (
    <div className="publicPage legalPage bg-[#faf8f5]">
      <PublicSiteHeader />

      <main className="legalMain">
        <h1 style={serif}>Privacy Policy</h1>
        <p className="legalUpdated">Last updated: {LAST_UPDATED}</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>
            We collect data you provide directly, such as account details (email, username), learning content
            (books, chapters, words, notes), settings/preferences, and referral or creator codes you choose
            to enter at signup.
          </p>
          <p>
            We also process operational data required to run the service, such as authentication/session data,
            basic request metadata, analytics events (for example page views, login success, and quiz activity),
            and local browser storage/cookies used for app performance and continuity.
          </p>
        </section>

        <section>
          <h2>2. How We Use Information</h2>
          <p>
            We use data to provide app functionality, account security, sync features, learning progress,
            diagnostics, abuse prevention, and product improvements.
          </p>
          <p>
            When you request definitions, translations, or related language help, the words or short text you
            submit may be sent to third-party language providers so they can return the requested result. This
            may include OpenAI API services, Jisho, Free Dictionary API, Datamuse, or similar providers used
            for dictionary and translation functionality.
          </p>
        </section>

        <section>
          <h2>3. Analytics Technologies</h2>
          <p>
            We use analytics tools to understand how the service is used and to improve product quality and
            retention. This may include PostHog and, when enabled, Google Analytics (GA4).
          </p>
          <p>
            Analytics tools may collect event data such as visited pages, feature usage, quiz flow events,
            browser/device metadata, and approximate location derived from IP. We configure analytics to reduce
            unnecessary personal data collection where possible.
          </p>
          <p>
            Where enabled, analytics may also include session replay (sometimes called screen recordings) to help
            diagnose usability issues and bugs. Session replay may capture page interactions such as clicks,
            scrolling, navigation flow, and visible UI state during use.
          </p>
          <p>
            We aim to avoid capturing sensitive inputs in session replay by using masking/exclusion settings where
            possible. Payment and authentication data should not be intentionally recorded in full, and analytics
            providers are loaded only after consent where our consent banner is shown.
          </p>
          <p>
            You can limit analytics collection by rejecting analytics consent, blocking analytics scripts/cookies
            in your browser settings or extensions, or contacting us for help. If your browser sends a Do Not
            Track signal, we attempt to honor it.
          </p>
        </section>

        <section>
          <h2>4. AI, Dictionary, and Translation Providers</h2>
          <p>
            Language-provider requests may contain the word, phrase, or short text you entered and basic technical
            metadata needed to complete the request. We do not intentionally send your password or payment details
            to these providers.
          </p>
          <p>
            Provider privacy and retention practices are governed by their own terms and policies. Where OpenAI API
            services are used, OpenAI states that API data is not used to train OpenAI models by default unless the
            API customer opts in. Provider policies may change, and we may change providers over time.
          </p>
        </section>

        <section>
          <h2>5. Billing and Payment Data</h2>
          <p>
            Paid subscriptions are processed by Stripe or another payment processor if billing is enabled. We do not
            intentionally store full card numbers in Vocalibry. We may store billing status, customer identifiers,
            subscription identifiers, plan state, and renewal/cancellation metadata needed to operate paid features.
          </p>
          <p>
            Payment processors may collect and process personal data according to their own privacy policies and
            legal obligations, including fraud prevention, tax, chargeback, and compliance requirements.
          </p>
        </section>

        <section>
          <h2>6. Referral Codes and Creator Attribution</h2>
          <p>
            If you enter a referral or creator code, we may store that code with your account and share limited
            attribution information with the relevant referral or creator partner, such as signup counts or paid
            conversion counts. We do not share your password or full payment details with referral partners.
          </p>
        </section>

        <section>
          <h2>7. Future Advertising and Cookies</h2>
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
          <h2>8. Data Sharing</h2>
          <p>
            We do not sell personal information. We may share data with service providers strictly as needed
            to operate, secure, and improve the platform.
          </p>
          <p>
            This can include infrastructure, authentication/security tooling, email delivery providers, and
            payment processors for billing (for example Stripe, where enabled), and third-party dictionary
            providers used to return definition content, analytics providers used for product measurement,
            AI/language providers used to return definitions or translations, and referral or creator partners
            where needed to attribute signups.
          </p>
          <p>
            We may also disclose information if required by law, legal process, or valid government request.
          </p>
        </section>

        <section>
          <h2>9. Security</h2>
          <p>
            We use reasonable administrative and technical safeguards. No system can be guaranteed 100%
            secure, and you use the service at your own risk.
          </p>
        </section>

        <section>
          <h2>10. Retention</h2>
          <p>
            We keep data while needed for service operation, security, legal compliance, and legitimate
            business purposes. Account deletion requests are handled according to applicable law and system
            constraints.
          </p>
          <p>
            Where billing is active, account deletion may require cancellation of an active paid subscription
            before deletion can proceed.
          </p>
          <p>
            Some records may be retained after account deletion when necessary for security, fraud prevention,
            tax, accounting, dispute handling, legal compliance, backups, or legitimate business records.
          </p>
          <p>
            Analytics records, including session replay data where enabled, are retained only as needed for
            diagnostics, security, and product improvement, then deleted or anonymized according to provider and
            internal retention controls.
          </p>
        </section>

        <section>
          <h2>11. Your Rights and Choices</h2>
          <p>
            Subject to local law, you may request access, correction, export, or deletion of personal data.
            You may also manage key account controls in-app.
          </p>
          <p>
            You may also request support in limiting analytics tracking associated with your account activity.
          </p>
          <p>
            Where required by applicable law, consent controls may be provided for analytics features, including
            session replay technologies.
          </p>
        </section>

        <section>
          <h2>12. International Processing</h2>
          <p>
            Your data may be processed in countries different from your own. By using the service, you
            understand that cross-border processing may occur.
          </p>
        </section>

        <section>
          <h2>13. Children&apos;s Privacy</h2>
          <p>
            The service is not directed to children below the minimum legal age in their jurisdiction, and it is
            not currently offered as a school-managed or classroom-managed service. If we learn personal data was
            provided without required consent, we will take appropriate action.
          </p>
        </section>

        <section>
          <h2>14. Policy Updates</h2>
          <p>
            We may update this Privacy Policy over time. The latest version will be posted on this page.
          </p>
        </section>

        <section>
          <h2>15. Contact</h2>
          <p>
            Privacy questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
