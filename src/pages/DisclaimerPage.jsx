import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const LAST_UPDATED = "June 5, 2026";
const SUPPORT_EMAIL = "vocalibrysupport@gmail.com";

export function DisclaimerPage() {
  return (
    <div className="publicPage legalPage bg-[#faf8f5]">
      <PublicSiteHeader />

      <main className="legalMain">
        <h1 style={serif}>Disclaimer</h1>
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
          <p>
            AI-generated, dictionary-provider, and translation-provider outputs may be incomplete, unnatural,
            mistranslated, or inappropriate for a particular exam, workplace, cultural setting, or classroom.
            Verify important language content with a qualified teacher, native speaker, or trusted source.
          </p>
        </section>

        <section>
          <h2>5. Third-Party Services, AI Providers, and Future Ads</h2>
          <p>
            The service may include third-party tools, AI providers, dictionary providers, translation providers,
            payment processors, analytics providers, referral partners, and, in the future, advertising providers.
            We do not control third-party content and do not endorse advertised products or claims.
          </p>
        </section>

        <section>
          <h2>6. Dictionary Content and Licensing</h2>
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
          <h2>7. Billing, Referral, and Availability Notices</h2>
          <p>
            Billing, subscription, trial, refund, and tax details depend on the checkout flow, payment processor,
            and applicable law. Referral or creator codes are for attribution unless a specific offer states
            otherwise.
          </p>
          <p>
            Vocalibry is not currently provided as a school-managed or classroom-managed service, and any learning
            analytics in the app should not be treated as a high-stakes academic assessment.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Responsibility</h2>
          <p>
            To the maximum extent allowed by law, your use of the app is at your own risk, and we are not
            responsible for indirect or consequential loss arising from use of the service.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Questions about this Disclaimer: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
