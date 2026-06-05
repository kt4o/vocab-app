import { PREMIUM_UPGRADE_ENABLED } from "../config/premium";
import { Check, X } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const PLAN_PRICE = "A$6/month";
const TRIAL_NOTE = "Checkout may include a free trial when eligible. Subscriptions renew monthly unless canceled.";

const FEATURES = [
  {
    name: "Word tracking, chapters, and definitions",
    free: true,
    pro: true,
  },
  {
    name: "Flashcards and quiz practice",
    free: true,
    pro: true,
  },
  {
    name: "Saved words",
    free: true,
    freeNote: "Up to 100 total words",
    pro: true,
    proNote: "Unlimited",
  },
  {
    name: "Smart Review queue",
    free: true,
    pro: true,
  },
  {
    name: "Weak-Words Lab + CSV export",
    free: true,
    pro: true,
  },
  {
    name: "Ads",
    free: false,
    freeNote: "May be introduced later",
    pro: true,
    proNote: "Ad-free",
  },
];

export function PricingPage() {
  return (
    <div className="publicPage pricingPage">
      <PublicSiteHeader />

      <main className="landingMain grid gap-4 py-6">
        <section className="rounded-2xl border border-border bg-card px-6 py-6 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
          <p className="heroEyebrow">Pricing</p>
          <h1 className="mb-2 text-3xl font-semibold text-foreground">Choose the plan that fits your learning pace</h1>
          <p className="heroCopy text-muted-foreground">
            Start free with every learning tool, then upgrade to Pro when you need unlimited saved words and an ad-free experience.
          </p>
        </section>

        <section className="grid gap-8 md:grid-cols-2" aria-label="Plan overview">
          <article className="rounded-2xl border border-border bg-card p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Free</h2>
              <p className="mb-3 text-5xl font-bold leading-none text-foreground">A$0</p>
              <p className="text-accent">Every feature, capped at 100 saved words.</p>
            </div>

            <a
              className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white shadow-[0_4px_12px_rgba(29,79,143,0.2)] transition-colors hover:bg-primary"
              href="/register"
            >
              Start Free
            </a>

            <div className="space-y-4" aria-label="Free plan features">
              {FEATURES.map((feature) => (
                <div key={feature.name} className="flex items-start gap-3">
                  {feature.free ? (
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-border" aria-hidden="true" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${feature.free ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {feature.name}
                    </p>
                    {feature.freeNote ? <p className="mt-0.5 text-xs text-muted-foreground">{feature.freeNote}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Pro</h2>
              <p className="mb-3">
                <span className="text-5xl font-bold leading-none text-foreground">{PLAN_PRICE}</span>
              </p>
              <p className="text-primary">
                {PREMIUM_UPGRADE_ENABLED
                  ? "Upgrade when you are ready for unlimited saved words."
                  : "Pro coming soon."}
              </p>
              {PREMIUM_UPGRADE_ENABLED ? (
                <p className="mt-3 text-sm text-muted-foreground">{TRIAL_NOTE}</p>
              ) : null}
            </div>
            {PREMIUM_UPGRADE_ENABLED ? (
              <a
                className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
                href="/register"
              >
                Create account
              </a>
            ) : (
              <button
                type="button"
                className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white opacity-60 shadow-[0_4px_12px_rgba(29,79,143,0.25)]"
                disabled
              >
                Go Pro
              </button>
            )}
            <div className="space-y-4" aria-label="Pro plan features">
              {FEATURES.map((feature) => (
                <div key={feature.name} className="flex items-start gap-3">
                  {feature.pro ? (
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-border" aria-hidden="true" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{feature.name}</p>
                    {feature.proNote ? <p className="mt-0.5 text-xs text-muted-foreground">{feature.proNote}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-border bg-secondary px-6 py-6 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <h2 className="mb-2 text-2xl font-semibold text-foreground">Not sure which plan you need?</h2>
          <p className="max-w-3xl text-muted-foreground">
            Start with the learning method first, then upgrade when Pro tools fit your routine. Our guide on{" "}
            <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
              how to expand your vocabulary
            </a>{" "}
            explains the daily routine behind effective vocabulary growth, including context, retrieval practice,
            spaced repetition, and active use.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Prices are shown in AUD unless checkout states otherwise. Taxes may apply. Manage cancellation
            through account billing; refunds are handled case-by-case and subject to applicable law and payment
            processor rules.
          </p>
        </section>
      </main>
    </div>
  );
}
