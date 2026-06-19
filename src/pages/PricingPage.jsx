import { PREMIUM_UPGRADE_ENABLED } from "../config/premium";
import { Check, X } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
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
    name: "Ads",
    free: false,
    freeNote: "May be introduced later",
    pro: true,
    proNote: "Ad-free",
  },
];

export function PricingPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-[#ece8e1] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">Pricing</p>
            <h1
              className="mb-5 text-[42px] leading-[1.06] tracking-tight text-[#111] sm:text-[54px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Choose the plan that fits your learning pace
            </h1>
            <p className="text-[17px] leading-relaxed text-[#666]">
              Start free with every learning tool, then upgrade to Pro when you need unlimited saved words and an
              ad-free experience.
            </p>
          </div>
        </section>

        {/* Plan cards */}
        <section className="px-4 py-14 sm:px-6 sm:py-16" aria-label="Plan overview">
          <div className="mx-auto grid max-w-[860px] gap-5 md:grid-cols-2">
            {/* Free plan */}
            <article className="rounded-[12px] border border-[#e5e1db] bg-white p-8">
              <div className="mb-8">
                <h2 className="mb-2 text-[20px] font-semibold text-[#111]">Free</h2>
                <p className="mb-3 text-[48px] font-bold leading-none tracking-tight text-[#111]">A$0</p>
                <p className="text-[14px] text-[#666]">Every feature, capped at 100 saved words.</p>
              </div>

              <a
                className="mb-8 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] border border-[#dbd8d2] bg-[#faf8f5] text-[14px] font-semibold text-[#111] no-underline transition-colors hover:bg-[#f0ede9]"
                href="/register"
              >
                Start Free
              </a>

              <div className="space-y-4" aria-label="Free plan features">
                {FEATURES.map((feature) => (
                  <div key={feature.name} className="flex items-start gap-3">
                    {feature.free ? (
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#111]" aria-hidden="true" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ccc]" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <p className={`text-[14px] ${feature.free ? "text-[#111]" : "text-[#bbb]"}`}>
                        {feature.name}
                      </p>
                      {feature.freeNote ? (
                        <p className="mt-0.5 text-[12px] text-[#999]">{feature.freeNote}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Pro plan */}
            <article className="rounded-[12px] border-2 border-[#111] bg-[#111] p-8">
              <div className="mb-8">
                <h2 className="mb-2 text-[20px] font-semibold text-white">Pro</h2>
                <p className="mb-3 text-[48px] font-bold leading-none tracking-tight text-white">{PLAN_PRICE}</p>
                <p className="text-[14px] text-[#aaa]">
                  {PREMIUM_UPGRADE_ENABLED
                    ? "Upgrade when you are ready for unlimited saved words."
                    : "Pro coming soon."}
                </p>
                {PREMIUM_UPGRADE_ENABLED ? (
                  <p className="mt-3 text-[12px] text-[#777]">{TRIAL_NOTE}</p>
                ) : null}
              </div>

              {PREMIUM_UPGRADE_ENABLED ? (
                <a
                  className="mb-8 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-semibold text-[#111] no-underline transition-colors hover:bg-[#f0ede9]"
                  href="/register"
                >
                  Start Pro
                </a>
              ) : (
                <button
                  type="button"
                  className="mb-8 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-semibold text-[#111] opacity-50"
                  disabled
                >
                  Coming soon
                </button>
              )}

              <div className="space-y-4" aria-label="Pro plan features">
                {FEATURES.map((feature) => (
                  <div key={feature.name} className="flex items-start gap-3">
                    {feature.pro ? (
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" aria-hidden="true" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#555]" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <p className="text-[14px] text-white">{feature.name}</p>
                      {feature.proNote ? (
                        <p className="mt-0.5 text-[12px] text-[#999]">{feature.proNote}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* Note strip */}
        <section className="border-t border-[#ece8e1] bg-white px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-[780px]">
            <h2
              className="mb-3 text-[22px] tracking-tight text-[#111]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Not sure which plan you need?
            </h2>
            <p className="mb-4 text-[15px] leading-[1.75] text-[#666]">
              Start with the learning method first, then upgrade when Pro tools fit your routine. Our guide on{" "}
              <a href="/how-to-expand-your-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                how to expand your vocabulary
              </a>{" "}
              explains the daily routine behind effective vocabulary growth, including context, retrieval practice,
              spaced repetition, and active use.
            </p>
            <p className="text-[13px] text-[#999]">
              Prices are shown in AUD unless checkout states otherwise. Taxes may apply. Manage cancellation
              through account billing; refunds are handled case-by-case and subject to applicable law and payment
              processor rules.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
