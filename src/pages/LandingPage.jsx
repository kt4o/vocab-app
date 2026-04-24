import { Check, X, BookOpen, Brain, Trophy, Zap, ArrowRight } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const appScreenshot = "/landing/book-page.png";
const YEAR = new Date().getFullYear();

const FEATURE_CARDS = [
  {
    icon: BookOpen,
    title: "Save Words From Real Reading",
    description:
      "Capture unfamiliar words from books, essays, and articles, then organize them by book and chapter.",
  },
  {
    icon: Zap,
    title: "Review Before They Fade",
    description:
      "Use active recall and smart review to bring back looked-up words before they slip out of memory.",
  },
  {
    icon: Trophy,
    title: "Track Real Progress",
    description:
      "See your streak, quiz activity, and vocabulary growth so reading turns into measurable improvement.",
  },
  {
    icon: Brain,
    title: "Turn Recognition Into Recall",
    description:
      "Practice with flashcards, typing, and quizzes until words feel familiar enough to use, not just recognize.",
  },
];

const HOW_IT_WORKS = [
  {
    title: "1. Save Words You Meet While Reading",
    description:
      "Add unfamiliar but useful words from novels, nonfiction, essays, or articles and keep them grouped by book and chapter.",
    href: "/register",
    label: "Create your free account",
  },
  {
    title: "2. Review With Active Recall",
    description:
      "Use flashcards and quiz modes to pull the meaning back from memory so the word becomes easier to recognize and reuse.",
    href: "/features",
    label: "Explore features",
  },
  {
    title: "3. Revisit The Words You Keep Losing",
    description:
      "Focus on mistakes and weak words first so the vocabulary you almost remember gets the extra repetition it needs.",
    href: "/register",
    label: "Start learning now",
  },
];

const FORGETTING_REASONS = [
  {
    title: "Do not trust the dictionary moment",
    description:
      "Looking up a word while reading helps comprehension, but the memory is often shallow. Save the word and come back to it later.",
  },
  {
    title: "Keep the word tied to the book",
    description:
      "Vocabulary is easier to remember when it stays connected to the sentence, scene, or chapter where you first met it.",
  },
  {
    title: "Recall beats rereading",
    description:
      "Short review sessions with flashcards and quizzes usually do more for retention than repeatedly glancing at the definition.",
  },
];

const GUIDES = [
  {
    title: "How to expand your vocabulary",
    description:
      "A research-backed guide to building vocabulary from meaningful input, active recall, spaced repetition, and active use.",
    href: "/how-to-expand-your-vocabulary",
  },
  {
    title: "How to memorize vocabulary",
    description:
      "Learn how to remember looked-up words more effectively with smaller study sets, active recall, and better review timing.",
    href: "/how-to-memorize-vocabulary",
  },
  {
    title: "How to learn vocabulary in context",
    description:
      "Understand how context from books and real sentences improves meaning, tone, collocations, and real-world usage.",
    href: "/how-to-learn-vocabulary-in-context",
  },
  {
    title: "Spaced repetition for vocabulary",
    description:
      "See how review timing helps vocabulary stay in memory and why spacing beats cramming.",
    href: "/spaced-repetition-for-vocabulary",
  },
  {
    title: "How many words should you learn per day?",
    description:
      "Pick a realistic daily vocabulary target that supports steady progress without overwhelming review.",
    href: "/how-many-words-should-you-learn-per-day",
  },
];

const FREE_PLAN = [
  { type: "check", text: "Word tracking, chapters, and definitions" },
  { type: "check", text: "Flashcards and quiz practice" },
  { type: "check", text: "Unlimited word adding" },
  { type: "check", text: "Unlimited word testing", note: "Included", muted: true },
  { type: "x", text: "Smart Review queue", muted: true },
  { type: "x", text: "Weak-Words Lab + CSV export", muted: true },
  { type: "check", text: "Socials (friends + leaderboards)", note: "Free League" },
  { type: "x", text: "Ads", note: "May be introduced later", muted: true },
];

const PRO_PLAN = [
  { type: "check", text: "Word tracking, chapters, and definitions" },
  { type: "check", text: "Flashcards and quiz practice" },
  { type: "check", text: "Unlimited word adding", note: "Included" },
  { type: "check", text: "Smart Review queue" },
  { type: "check", text: "Weak-Words Lab + CSV export" },
  { type: "check", text: "Socials (friends + leaderboards)", note: "Pro League" },
  { type: "check", text: "Ads", note: "Ad-free" },
];

const FAQ = [
  {
    question: "Who is Vocalibry for?",
    answer:
      "Vocalibry is for people who already understand English well, read regularly, and keep looking up useful words they later forget. It gives those words a repeatable review system.",
    href: "#how-it-works",
    label: "See how it works",
  },
  {
    question: "Why do looked-up words disappear so quickly?",
    answer:
      "Because understanding a word once is not the same as remembering it later. Words stick better when you revisit them with active recall instead of relying on the original dictionary lookup.",
    href: "/how-to-expand-your-vocabulary",
    label: "Read the guide",
  },
  {
    question: "Is Vocalibry free to use?",
    answer:
      "Yes. You can start with the Free plan and access core features like word tracking, flashcards, and quiz practice.",
    href: "#pricing",
    label: "See pricing",
  },
  {
    question: "How does Vocalibry help me remember book vocabulary long-term?",
    answer:
      "Vocalibry helps you save useful words from reading, review them with flashcards and quizzes, and revisit weak words in focused sessions so they are less likely to fade.",
    href: "/features",
    label: "Explore features",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <PublicSiteHeader />

      <main className="bg-[#f5f7fb]">
        <section className="bg-[#f5f7fb] px-4 pb-0 pt-14 sm:px-6 sm:pt-16">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="mx-auto max-w-[920px] text-center">
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6F92E8]">Built for Fluent Readers</p>
              <h1 className="mb-4 text-[42px] font-bold leading-[1.05] text-foreground sm:text-[52px] md:text-[68px]">
                Never forget a word again.
              </h1>
              <p className="mx-auto mb-5 max-w-[800px] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
                Vocalibry helps strong English readers save unfamiliar words from books, review them with active recall, and stop forgetting them a day later.
              </p>

              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#8FB0FF] px-6 text-[15px] font-medium text-white no-underline transition-colors hover:bg-[#6F92E8]"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center rounded-lg border border-border bg-white px-6 text-[15px] font-medium text-foreground no-underline transition-colors hover:bg-[#F6F9FF]"
                >
                  See how it works
                </a>
              </div>

            </div>

            <div className="mx-auto mt-10 w-full max-w-[1100px] overflow-hidden rounded-t-lg border border-border/50 bg-white shadow-[0_28px_60px_rgba(16,24,40,0.22),0_10px_24px_rgba(16,24,40,0.12)] md:mt-6">
              <img
                src={appScreenshot}
                alt="Vocalibry App Interface"
                className="block w-full"
                loading="eager"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-[900px] text-center">
            <p className="text-[16px] leading-relaxed text-muted-foreground">
              Save words from real reading, organize them by book, and review weak vocabulary before it fades.
            </p>
          </div>
        </section>

        <section className="bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="features">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">Built for readers, not random word lists</h2>
            <p className="mx-auto mb-12 max-w-3xl text-center text-[16px] text-muted-foreground sm:mb-16 sm:text-[17px]">
              If you already understand English but want stronger recall and more precise expression, your reading habit can become your vocabulary system.
            </p>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {FEATURE_CARDS.map((card) => (
                <article key={card.title} className="text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-[#e8eefc]">
                    <card.icon className="h-8 w-8 text-[#6F92E8]" />
                  </div>
                  <h3 className="mb-2 text-[17px] font-semibold text-foreground">{card.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="how-it-works">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">How It Works</h2>
            <p className="mb-12 text-center text-[16px] text-muted-foreground">
              A simple loop for turning looked-up words into vocabulary you actually remember.
            </p>

            <div className="grid gap-8 md:grid-cols-3">
              {HOW_IT_WORKS.map((step) => (
                <article key={step.title} className="rounded-lg border border-border/40 bg-[#f8fafe] p-8">
                  <h3 className="mb-3 text-[18px] font-semibold text-foreground">{step.title}</h3>
                  <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">{step.description}</p>
                  <a href={step.href} className="text-[15px] font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                    {step.label}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-10 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:mb-12 md:text-[40px]">Why readers forget useful words</h2>
            <p className="mx-auto mb-12 max-w-4xl text-center text-[16px] text-muted-foreground">
              Reading exposes you to strong vocabulary, but exposure alone is not enough. The best way to retain words from books is to save them in context, test recall later, and revisit the ones that still feel shaky.
            </p>

            <div className="mb-12 grid gap-8 md:grid-cols-3">
              {FORGETTING_REASONS.map((item) => (
                <article key={item.title} className="rounded-lg border border-border/30 bg-[#f8fafe] p-8">
                  <h3 className="mb-3 text-[18px] font-semibold text-foreground">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>

            <p className="text-center text-[15px] text-muted-foreground">
              Want the full method? Compare plans on{" "}
              <a href="#pricing" className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                Pricing
              </a>{" "}
              or read the full{" "}
              <a href="/how-to-expand-your-vocabulary" className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                vocabulary guide
              </a>{" "}
              for a step-by-step system for readers, then explore all study tools on{" "}
              <a href="/features" className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                Features
              </a>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="guides">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">Guides for building vocabulary from reading</h2>
            <p className="mb-12 text-center text-[16px] text-muted-foreground">
              Explore practical guides on remembering words you look up, learning vocabulary in context, and turning book reading into lasting vocabulary growth.
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {GUIDES.map((guide) => (
                <article key={guide.title} className="rounded-lg border border-border/40 bg-[#f8fafe] p-8">
                  <h3 className="mb-3 text-[17px] font-semibold text-foreground">{guide.title}</h3>
                  <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">{guide.description}</p>
                  <a href={guide.href} className="text-[15px] font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                    Read guide
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="pricing">
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">Choose Your Plan</h2>
              <p className="text-[16px] text-muted-foreground">Start free and build a reading-driven vocabulary habit that lasts.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <article className="rounded-xl border border-[#cfd9ec] bg-[#f5f7fb] p-8 sm:p-10">
                <div className="mb-8">
                  <h3 className="mb-4 text-[22px] font-semibold text-foreground">Free</h3>
                  <div className="mb-3 text-[56px] font-bold leading-none text-foreground">A$0</div>
                  <p className="text-[15px] font-medium text-[#6F92E8]">Good for starting your reading vocabulary system.</p>
                </div>
                <a
                  href="/register"
                  className="mb-8 block w-full rounded-lg bg-[#8FB0FF] py-3.5 text-center text-[15px] font-medium text-white no-underline transition-colors hover:bg-[#6F92E8]"
                >
                  Start Free
                </a>
                <div className="space-y-3.5">
                  {FREE_PLAN.map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      {item.type === "check" ? (
                        <Check className={`mt-0.5 h-5 w-5 flex-shrink-0 ${item.muted ? "text-muted-foreground/35" : "text-green-600"}`} />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground/35" />
                      )}
                      <div>
                        <span className={`text-[15px] ${item.muted ? "text-foreground/55" : "text-foreground"}`}>{item.text}</span>
                        {item.note ? <p className="mt-0.5 text-[13px] text-muted-foreground">{item.note}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-[#cfd9ec] bg-[#f5f7fb] p-8 sm:p-10">
                <div className="mb-8">
                  <h3 className="mb-4 text-[22px] font-semibold text-foreground">Pro</h3>
                  <div className="mb-3 text-[56px] font-bold leading-none text-foreground">A$6</div>
                  <p className="mb-2 text-[15px] font-medium text-[#6F92E8]">per month</p>
                  <p className="text-[14px] text-muted-foreground">Advanced review tools for faster vocabulary retention.</p>
                </div>
                <a
                  href="/register"
                  className="mb-8 block w-full rounded-lg bg-[#6F92E8] py-3.5 text-center text-[15px] font-medium text-white no-underline transition-colors hover:bg-[#5d81d6]"
                >
                  Start Pro
                </a>
                <div className="space-y-3.5">
                  {PRO_PLAN.map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                      <div>
                        <span className="text-[15px] text-foreground">{item.text}</span>
                        {item.note ? <p className="mt-0.5 text-[13px] text-muted-foreground">{item.note}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[900px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">Frequently Asked Questions</h2>
            <p className="mb-12 text-center text-[16px] text-muted-foreground">Quick answers for readers who want to stop forgetting useful words.</p>

            <div className="space-y-8">
              {FAQ.map((item) => (
                <article key={item.question}>
                  <h3 className="mb-3 text-[18px] font-semibold text-foreground">{item.question}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    {item.answer}{" "}
                    <a href={item.href} className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                      {item.label}
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="contact">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="mb-12 grid gap-12 md:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <img src="/favicon.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded-[6px] object-contain" />
                <span className="text-[17px] font-semibold text-foreground">Vocalibry</span>
              </div>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Turn looked-up words from books into vocabulary you actually remember and use.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-foreground">Product</h4>
              <div className="space-y-3">
                <a href="/features" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Features</a>
                <a href="/pricing" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Pricing</a>
                <a href="/guides" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">All Guides</a>
                <a href="/how-to-memorize-vocabulary" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Memorize Vocabulary</a>
                <a href="/how-to-learn-vocabulary-in-context" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Vocabulary in Context</a>
                <a href="/spaced-repetition-for-vocabulary" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Spaced Repetition</a>
                <a href="/how-many-words-should-you-learn-per-day" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Words Per Day</a>
                <a href="/contact" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Contact</a>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-foreground">Legal</h4>
              <div className="space-y-3">
                <a href="/terms" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Terms</a>
                <a href="/privacy" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Privacy</a>
                <a href="/disclaimer" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Disclaimer</a>
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="text-center text-[13px] text-muted-foreground">(c) {YEAR} Vocalibry. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
