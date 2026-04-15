import { PREMIUM_UPGRADE_ENABLED } from "../config/premium";
import { FOUNDING_MEMBER_DEADLINE_LABEL } from "../config/launchOffer.js";
import { Check, X } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const PLAN_PRICE = "A$6/month";

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
    name: "Unlimited word adding",
    free: true,
    freeNote: "Included",
    pro: true,
    proNote: "Included",
  },
  {
    name: "Smart Review queue",
    free: false,
    pro: true,
  },
  {
    name: "Weak-Words Lab + CSV export",
    free: false,
    pro: true,
  },
  {
    name: "Socials (friends + leaderboards)",
    free: true,
    freeNote: "Free League",
    pro: true,
    proNote: "Pro League",
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
            Create your account by {FOUNDING_MEMBER_DEADLINE_LABEL} and unlock Pro for life as a Founding Member.
          </p>
        </section>

        <section className="grid gap-8 md:grid-cols-2" aria-label="Plan overview">
          <article className="rounded-2xl border border-border bg-card p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">Free</h2>
              <p className="mb-3 text-5xl font-bold leading-none text-foreground">A$0</p>
              <p className="text-accent">Good for getting started.</p>
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
                <span className="text-5xl font-bold leading-none text-foreground">A$0</span>
              </p>
              <p className="mb-2 text-sm font-medium text-primary">Founding Members only until {FOUNDING_MEMBER_DEADLINE_LABEL}</p>
              <p className="mb-3 text-sm text-muted-foreground line-through">{PLAN_PRICE}</p>
              <p className="text-primary">
                {PREMIUM_UPGRADE_ENABLED
                  ? "Create your account during launch and keep Pro permanently."
                  : "Pro coming soon."}
              </p>
            </div>
            {PREMIUM_UPGRADE_ENABLED ? (
              <a
                className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
                href="/register"
              >
                Claim lifetime Pro
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
            If you are early, the simplest move is to claim the Founding Member offer before {FOUNDING_MEMBER_DEADLINE_LABEL}. After that, start with the learning method first. Our guide on{" "}
            <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
              how to expand your vocabulary
            </a>{" "}
            explains the daily routine behind effective vocabulary growth, including context, retrieval practice,
            spaced repetition, and active use.
          </p>
        </section>
      </main>
    </div>
  );
}
