import { useState } from "react";
import { PREMIUM_UPGRADE_ENABLED } from "../config/premium";
import { Check, ChevronDown } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const YEAR = new Date().getFullYear();

const TESTIMONIALS = [
  {
    quote:
      "I used to look up the same kanji four times and still forget it. Now I actually remember words because I review them at the right moment.",
    name: "Sarah K.",
    context: "Japanese learner, two years in",
  },
  {
    quote:
      "The English-to-Japanese direction is what I was missing. Recognizing a word and being able to produce it from English are completely different skills.",
    name: "Marcus T.",
    context: "Preparing for JLPT N3",
  },
  {
    quote:
      "My words stay tied to the book I'm reading, which makes meanings feel real and grounded. Context really is everything.",
    name: "Yuki N.",
    context: "Learning Japanese through manga",
  },
];

const FREE_FEATURES = [
  { text: "All study features (flashcards, typed quizzes, Smart Review)" },
  { text: "Words organised by source" },
  { text: "Up to 100 saved words", hint: "Most active learners reach this in 3–4 weeks." },
  { text: "Ads may be introduced" },
];

const PRO_FEATURES = [
  { text: "Everything in Free" },
  { text: "Unlimited saved words" },
  { text: "Ad-free forever" },
  { text: "Priority support" },
];

const FAQS = [
  {
    q: "Can I try Pro before paying?",
    a: "The free plan includes every study feature with up to 100 saved words — no credit card required. Upgrade to Pro when you need more room.",
  },
  {
    q: "What happens if I hit 100 words on the free plan?",
    a: "You can still review everything you've already saved. You'll need Pro to add more words.",
  },
  {
    q: "Can I switch between monthly and annual?",
    a: "Yes — you can change your billing period any time from account settings.",
  },
  {
    q: "Do you offer refunds?",
    a: "Refunds are handled case-by-case. Contact us and we'll sort it out.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e8e4de]">
      <button
        type="button"
        className="flex w-full items-center justify-between border-0 bg-transparent py-4 text-left outline-none"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-[15px] font-medium text-[#0f0f0f]">{q}</span>
        <ChevronDown
          className={`ml-4 h-4 w-4 flex-shrink-0 text-[#aaa] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="pb-5 text-[14px] leading-relaxed text-[#666]">{a}</p>
      )}
    </div>
  );
}

export function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState("annual");
  const isAnnual = billingPeriod === "annual";

  return (
    <div className="min-h-screen bg-[#f9f7f4]">
      <PublicSiteHeader />

      <main>
        {/* Hero */}
        <section className="px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-[600px]">
            <h1
              className="mb-4 text-[40px] leading-[1.08] tracking-tight text-[#0f0f0f] sm:text-[52px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Unlock unlimited vocabulary.
            </h1>
            <p className="text-[17px] leading-relaxed text-[#666]">
              Start free. Upgrade when you're ready to go further.
            </p>
          </div>
        </section>

        {/* Billing toggle */}
        <section className="px-4 pb-8 sm:px-6">
          <div className="flex justify-center">
            <div className="inline-flex gap-1 rounded-[10px] border border-[#e5e1db] bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`relative rounded-[8px] px-5 py-2 text-[13px] font-semibold transition-colors ${
                  isAnnual ? "bg-[#0f0f0f] text-white" : "text-[#666] hover:text-[#111]"
                }`}
              >
                Annual
                <span
                  className={`ml-2 rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isAnnual ? "bg-white/20 text-white" : "bg-[#f0ede9] text-[#555]"
                  }`}
                >
                  Save 33%
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`rounded-[8px] px-5 py-2 text-[13px] font-semibold transition-colors ${
                  !isAnnual ? "bg-[#0f0f0f] text-white" : "text-[#666] hover:text-[#111]"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </section>

        {/* Plan cards */}
        <section className="px-4 pb-4 sm:px-6" aria-label="Plan overview">
          <div className="mx-auto grid max-w-[860px] gap-5 md:grid-cols-2">
            {/* Free */}
            <article className="rounded-[14px] border border-[#e5e1db] bg-white p-8">
              <div className="mb-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Free</p>
                <p className="mb-1 text-[52px] font-bold leading-none tracking-tight text-[#0f0f0f]">A$0</p>
                <p className="text-[14px] text-[#999]">No credit card required.</p>
              </div>

              <a
                href="/register"
                className="mb-8 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] border border-[#dbd8d2] bg-[#f9f7f4] text-[14px] font-semibold text-[#0f0f0f] no-underline transition-colors hover:bg-[#f0ede9]"
              >
                Start for free
              </a>

              <ul className="space-y-4" aria-label="Free plan features">
                {FREE_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0f0f0f]" aria-hidden="true" />
                    <div>
                      <p className="text-[14px] leading-snug text-[#0f0f0f]">{f.text}</p>
                      {f.hint && (
                        <p className="mt-0.5 text-[12px] text-[#bbb]">{f.hint}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            {/* Pro */}
            <article className="relative rounded-[14px] bg-[#0f0f0f] p-8">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="rounded-full bg-[#f5a623] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Most popular
                </span>
              </div>

              <div className="mb-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#555]">Pro</p>
                {isAnnual ? (
                  <>
                    <p className="mb-1 text-[52px] font-bold leading-none tracking-tight text-white">
                      A$4<span className="text-[22px] font-semibold text-[#666]">/mo</span>
                    </p>
                    <p className="text-[13px] text-[#666]">billed A$48/year</p>
                  </>
                ) : (
                  <>
                    <p className="mb-1 text-[52px] font-bold leading-none tracking-tight text-white">
                      A$6<span className="text-[22px] font-semibold text-[#666]">/mo</span>
                    </p>
                    <p className="text-[13px] text-[#555]">billed monthly</p>
                  </>
                )}
              </div>

              <div className="mb-8">
                {PREMIUM_UPGRADE_ENABLED ? (
                  <a
                    href="/app"
                    className="inline-flex h-[46px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-semibold text-[#0f0f0f] no-underline transition-colors hover:bg-[#f0ede9]"
                  >
                    Start Pro
                  </a>
                ) : (
                  <a
                    href="/register"
                    className="inline-flex h-[46px] w-full items-center justify-center rounded-[10px] bg-white text-[14px] font-semibold text-[#0f0f0f] no-underline transition-colors hover:bg-[#f0ede9]"
                  >
                    Start Pro
                  </a>
                )}
                <p className="mt-2.5 text-center text-[12px] text-[#555]">Cancel anytime · No commitment</p>
              </div>

              <ul className="space-y-4" aria-label="Pro plan features">
                {PRO_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" aria-hidden="true" />
                    <p className="text-[14px] leading-snug text-white">{f.text}</p>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* Trust line */}
        <section className="px-4 pb-14 pt-5 sm:px-6">
          <p className="text-center text-[12px] text-[#bbb]">
            Prices in AUD · Secure checkout · Cancel any time
          </p>
        </section>

        {/* Testimonials */}
        <section className="border-t border-[#ece8e1] px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            <div className="grid gap-8 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <blockquote key={t.name} className="flex flex-col">
                  <p className="flex-1 text-[14px] italic leading-relaxed text-[#555]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <footer className="mt-4">
                    <p className="text-[13px] font-semibold text-[#0f0f0f]">{t.name}</p>
                    <p className="text-[12px] text-[#aaa]">{t.context}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-[#ece8e1] px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-[640px]">
            <h2
              className="mb-8 text-[26px] tracking-tight text-[#0f0f0f]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Common questions
            </h2>
            <div>
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ece8e1] bg-white px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-12 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <img src="/vocab-logo-black.png" alt="" aria-hidden="true" className="h-6 w-auto rounded-[6px]" />
                <span className="text-[16px] font-semibold text-[#111]">Vocalibry</span>
              </div>
              <p className="text-[13px] leading-[1.75] text-[#888]">
                Save target-language words, review them in both directions, and remember more of what you study.
              </p>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Product</h4>
              <div className="space-y-3">
                {[
                  ["/features", "Features"],
                  ["/learn-japanese-from-books", "Japanese Books"],
                  ["/pricing", "Pricing"],
                  ["/guides", "All Guides"],
                  ["/contact", "Contact"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Guides</h4>
              <div className="space-y-3">
                {[
                  ["/how-to-expand-your-vocabulary", "Expand Your Vocabulary"],
                  ["/how-to-memorize-vocabulary", "Memorize Vocabulary"],
                  ["/how-to-learn-vocabulary-in-context", "Vocabulary in Context"],
                  ["/spaced-repetition-for-vocabulary", "Spaced Repetition"],
                  ["/how-many-words-should-you-learn-per-day", "Words Per Day"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Legal</h4>
              <div className="space-y-3">
                {[
                  ["/terms", "Terms"],
                  ["/privacy", "Privacy"],
                  ["/disclaimer", "Disclaimer"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[#ece8e1] pt-8">
            <p className="text-center text-[12px] text-[#ccc]">&copy; {YEAR} Vocalibry. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
