import { PREMIUM_UPGRADE_ENABLED } from "../config/premium";

const PLAN_PRICE = "A$6/month";

const FEATURES = [
  {
    label: "Word tracking, chapters, and definitions",
    free: "Included",
    pro: "Included",
  },
  {
    label: "Flashcards and quiz practice",
    free: "Included",
    pro: "Included",
  },
  {
    label: "Daily free limits",
    free: "Applies",
    pro: "Removed",
  },
  {
    label: "Smart Review queue",
    free: "Not included",
    pro: "Included",
  },
  {
    label: "Weak-Words Lab + CSV export",
    free: "Not included",
    pro: "Included",
  },
  {
    label: "Socials (friends + leaderboards)",
    free: "Included (Free League)",
    pro: "Included (Pro League)",
  },
  {
    label: "Ads",
    free: "May be introduced later",
    pro: "Ad-free",
  },
];

export function PricingPage() {
  return (
    <div className="publicPage pricingPage">
      <header className="publicHeader">
        <a className="publicLogo" href="/">
          Vocalibry
        </a>
        <nav className="publicNav" aria-label="Public pages">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/disclaimer">Disclaimer</a>
          <a className="publicHeaderCta" href="/login">
            Log in
          </a>
        </nav>
      </header>

      <main className="landingMain pricingMain">
        <section className="pricingHero">
          <p className="heroEyebrow">Pricing</p>
          <h1>Choose the plan that fits your learning pace</h1>
          <p className="heroCopy">
            Start free anytime. Upgrade when you want unlimited daily usage and advanced review tools.
          </p>
        </section>

        <section className="pricingPlanGrid" aria-label="Plan overview">
          <article className="pricingPlanCard isFree">
            <h2>Free</h2>
            <p className="pricingPlanPrice">A$0</p>
            <p className="pricingPlanCaption">Good for getting started.</p>
            <a className="publicSecondaryBtn" href="/register">
              Start Free
            </a>
          </article>
          <article className="pricingPlanCard isPro">
            <h2>Pro</h2>
            <p className="pricingPlanPrice">{PLAN_PRICE}</p>
            <p className="pricingPlanCaption">
              {PREMIUM_UPGRADE_ENABLED
                ? "Best for consistent daily learners."
                : "Pro coming soon."}
            </p>
            {PREMIUM_UPGRADE_ENABLED ? (
              <a className="publicPrimaryBtn" href="/register">
                Go Pro
              </a>
            ) : (
              <button type="button" className="publicPrimaryBtn" disabled>
                Go Pro
              </button>
            )}
          </article>
        </section>

        <section className="pricingCompareCard" aria-label="Free vs Pro feature comparison">
          <div className="pricingCompareHead">
            <strong>Feature</strong>
            <strong>Free</strong>
            <strong>Pro</strong>
          </div>
          <div className="pricingCompareRows">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="pricingCompareRow">
                <span>{feature.label}</span>
                <span>{feature.free}</span>
                <span>{feature.pro}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
