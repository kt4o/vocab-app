import { useState } from "react";
import { Check, X, BookOpen, Brain, Trophy, Zap, ArrowRight } from "lucide-react";

const appScreenshot = "/landing/book-page.png";

const YEAR = new Date().getFullYear();

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

const MAIN_FEATURES = [
  {
    icon: BookOpen,
    title: "Save Words From Real Reading",
    description: "Capture unfamiliar words from books, essays, and articles, then organize them by book and chapter.",
  },
  {
    icon: Brain,
    title: "Review Before They Fade",
    description: "Use active recall and smart review to bring back looked-up words before they slip out of memory.",
  },
  {
    icon: Trophy,
    title: "Track Real Progress",
    description: "See your streak, quiz activity, and vocabulary growth so reading turns into measurable improvement.",
  },
  {
    icon: Zap,
    title: "Turn Recognition Into Recall",
    description: "Practice with flashcards, typing, and quizzes until words feel familiar enough to use, not just recognize.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Who is Vocalibry for?",
    answer:
      "Vocalibry is for people who already understand English well, read regularly, and keep looking up useful words they later forget. It gives those words a repeatable review system.",
    linkLabel: "See how it works",
    linkHref: "#how-it-works",
  },
  {
    question: "Why do looked-up words disappear so quickly?",
    answer:
      "Because understanding a word once is not the same as remembering it later. Words stick better when you revisit them with active recall instead of relying on the original dictionary lookup.",
    linkLabel: "Read the guide",
    linkHref: "/how-to-expand-your-vocabulary",
  },
  {
    question: "Is Vocalibry free to use?",
    answer:
      "Yes. You can start with the Free plan and access core features like word tracking, flashcards, and quiz practice.",
    linkLabel: "See pricing",
    linkHref: "/pricing",
  },
  {
    question: "How does Vocalibry help me remember book vocabulary long-term?",
    answer:
      "Vocalibry helps you save useful words from reading, review them with flashcards and quizzes, and revisit weak words in focused sessions so they are less likely to fade.",
    linkLabel: "Explore features",
    linkHref: "/features",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    title: "1. Save Words You Meet While Reading",
    description:
      "Add unfamiliar but useful words from novels, nonfiction, essays, or articles and keep them grouped by book and chapter.",
    ctaLabel: "Create your free account",
    ctaHref: "/register",
  },
  {
    title: "2. Review With Active Recall",
    description:
      "Use flashcards and quiz modes to pull the meaning back from memory so the word becomes easier to recognize and reuse.",
    ctaLabel: "Explore features",
    ctaHref: "/features",
  },
  {
    title: "3. Revisit The Words You Keep Losing",
    description:
      "Focus on mistakes and weak words first so the vocabulary you almost remember gets the extra repetition it needs.",
    ctaLabel: "Start learning now",
    ctaHref: "/register",
  },
];

const VOCAB_GROWTH_TIPS = [
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

const GUIDE_LINKS = [
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

export function LandingPage() {
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {isAnnouncementVisible ? (
        <div className="border-b border-[#d9e6ff] bg-[#eef4ff] px-4 py-2">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#7e9cf0] px-2.5 py-0.5 text-xs font-medium text-white">New</span>
              <p className="text-[13px] text-foreground">
                Chapter Planner is live: organize words from the books you read into clean chapter-based lists.
                <a href="/register" className="ml-2 text-primary no-underline hover:underline">
                  Try Chapter Planner →
                </a>
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 appearance-none items-center justify-center border-0 bg-transparent p-0 text-[#5f7196] shadow-none outline-none transition-colors hover:text-[#2e3f64]"
              aria-label="Dismiss announcement"
              onClick={() => setIsAnnouncementVisible(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-50 bg-background">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="flex items-center gap-2 no-underline">
              <img
                src="/favicon.svg"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-semibold text-foreground">Vocalibry</span>
            </a>

            <nav className="hidden items-center gap-6 md:flex">
              <a href="/guides" className="text-foreground no-underline transition-colors hover:text-primary">
                Guides
              </a>
              <a href="/features" className="text-foreground no-underline transition-colors hover:text-primary">
                Features
              </a>
              <a href="/register" className="text-foreground no-underline transition-colors hover:text-primary">
                Get Started
              </a>
              <a href="/pricing" className="text-foreground no-underline transition-colors hover:text-primary">
                Pricing
              </a>
              <a href="/contact" className="text-foreground no-underline transition-colors hover:text-primary">
                Contact
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a href="/login" className="font-medium text-foreground no-underline transition-colors hover:text-primary">
                Log in
              </a>
              <a
                href="/register"
                className="rounded-lg bg-accent px-5 py-2 font-medium text-white no-underline shadow-[0_2px_8px_rgba(29,79,143,0.2)] transition-colors hover:bg-primary"
              >
                Start for free
              </a>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-start gap-10 lg:grid-cols-2">
              <div className="max-w-xl">
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                  Built for fluent readers
                </p>
                <h1 className="mb-6 text-5xl font-bold text-foreground md:text-6xl">
                  Never forget a word you look up again.
                </h1>
                <p className="mb-8 text-xl text-muted-foreground">
                  Vocalibry helps strong English readers save unfamiliar words from books, review them with active recall,
                  and stop forgetting them a day later.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="/register"
                    className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-medium text-white no-underline shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
                  >
                    Start free
                    <ArrowRight className="h-5 w-5" />
                  </a>
                  <a
                    href="#how-it-works"
                    className="rounded-lg border border-border bg-secondary px-8 py-3 font-medium text-foreground no-underline transition-colors hover:bg-muted"
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-5 text-sm text-muted-foreground">
                  Save words from real reading, organize them by book, and review weak vocabulary before it fades.
                </p>
              </div>
              <div className="relative">
                <img
                  src={appScreenshot}
                  alt="Vocalibry app interface showing book-based vocabulary organization and review tools"
                  className="h-auto max-h-[560px] w-full rounded-2xl border border-border object-cover object-top shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
                  width="1896"
                  height="1078"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-secondary px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-3xl font-bold text-foreground">Built for readers, not random word lists</h2>
            <p className="mx-auto mb-12 max-w-3xl text-center text-muted-foreground">
              If you already understand English but want stronger recall and more precise expression, your reading habit
              can become your vocabulary system.
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {MAIN_FEATURES.map((feature) => (
                <div key={feature.title} className="text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-white">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16" id="how-it-works">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-foreground">How It Works</h2>
              <p className="text-muted-foreground">
                A simple loop for turning looked-up words into vocabulary you actually remember.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                >
                  <h3 className="mb-3 text-xl font-semibold text-foreground">{step.title}</h3>
                  <p className="mb-4 text-muted-foreground">{step.description}</p>
                  <a
                    href={step.ctaHref}
                    className="font-medium text-primary no-underline transition-colors hover:text-[#5d81d6]"
                  >
                    {step.ctaLabel}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary px-4 py-16" id="expand-vocabulary">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-foreground">Why readers forget useful words</h2>
              <p className="mx-auto max-w-3xl text-muted-foreground">
                Reading exposes you to strong vocabulary, but exposure alone is not enough. The best way to retain words
                from books is to save them in context, test recall later, and revisit the ones that still feel shaky.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {VOCAB_GROWTH_TIPS.map((tip) => (
                <article
                  key={tip.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[0_3px_12px_rgba(15,23,42,0.06)]"
                >
                  <h3 className="mb-3 text-xl font-semibold text-foreground">{tip.title}</h3>
                  <p className="text-muted-foreground">{tip.description}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-muted-foreground">
              Want the full method? Compare plans on{" "}
              <a href="/pricing" className="font-medium text-primary no-underline hover:underline">
                Pricing
              </a>{" "}
              or read the full{" "}
              <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
                vocabulary guide
              </a>{" "}
              for a step-by-step system for readers, then explore all study tools on{" "}
              <a href="/features" className="font-medium text-primary no-underline hover:underline">
                Features
              </a>
              .
            </p>
          </div>
        </section>

        <section className="px-4 py-16" id="guides">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-foreground">Guides for building vocabulary from reading</h2>
              <p className="mx-auto max-w-3xl text-muted-foreground">
                Explore practical guides on remembering words you look up, learning vocabulary in context, and turning
                book reading into lasting vocabulary growth.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {GUIDE_LINKS.map((guide) => (
                <article
                  key={guide.href}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                >
                  <h3 className="mb-3 text-xl font-semibold text-foreground">{guide.title}</h3>
                  <p className="mb-4 text-muted-foreground">{guide.description}</p>
                  <a
                    href={guide.href}
                    className="font-medium text-primary no-underline transition-colors hover:text-[#5d81d6]"
                  >
                    Read guide
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16" id="pricing">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground">Choose Your Plan</h2>
              <p className="text-muted-foreground">Start free and build a reading-driven vocabulary habit that lasts.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
                <div className="mb-8">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">Free</h2>
                  <div className="mb-3">
                    <span className="text-5xl font-bold text-foreground">A$0</span>
                  </div>
                  <p className="text-primary">Good for starting your reading vocabulary system.</p>
                </div>

                <a
                  href="/register"
                  className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-medium text-white no-underline shadow-[0_4px_12px_rgba(29,79,143,0.2)] transition-colors hover:bg-primary"
                >
                  Start Free
                </a>

                <div className="space-y-4">
                  {FEATURES.map((feature) => (
                    <div key={feature.name} className="flex items-start gap-3">
                      {feature.free ? (
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                      ) : (
                        <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-border" />
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
              </div>

              <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card to-muted p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
                <div className="mb-8">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">Pro</h2>
                  <div className="mb-3">
                    <span className="text-5xl font-bold text-foreground">A$6</span>
                    <span className="text-xl text-muted-foreground">/month</span>
                  </div>
                  <p className="text-primary">For readers who want deeper review tools.</p>
                </div>

                <a
                  href="/pricing"
                  className="mb-8 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 font-medium text-white no-underline shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
                >
                  Go Pro
                </a>

                <div className="space-y-4">
                  {FEATURES.map((feature) => (
                    <div key={feature.name} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{feature.name}</p>
                        {feature.proNote ? <p className="mt-0.5 text-xs text-muted-foreground">{feature.proNote}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-secondary px-4 py-16" id="faq">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">
                Quick answers for readers who want to stop forgetting useful words.
              </p>
            </div>
            <div className="space-y-4">
              {FAQ_ITEMS.map((item) => (
                <article
                  key={item.question}
                  className="rounded-xl border border-border bg-card p-6 shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
                >
                  <h3 className="mb-2 text-lg font-semibold text-foreground">{item.question}</h3>
                  <p className="text-muted-foreground">
                    {item.answer}{" "}
                    {item.linkHref ? (
                      <a href={item.linkHref} className="font-medium text-primary no-underline hover:underline">
                        {item.linkLabel}
                      </a>
                    ) : null}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-secondary px-4 py-12">
        <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-3">
          <div>
            <a href="/" className="inline-flex items-center gap-2 no-underline">
              <img src="/favicon.svg" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
              <span className="text-base font-semibold text-foreground">Vocalibry</span>
            </a>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Turn looked-up words from books into vocabulary you actually remember and use.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">Product</h3>
            <div className="flex flex-col gap-2 text-sm">
              <a href="/features" className="text-muted-foreground no-underline transition-colors hover:text-primary">Features</a>
              <a href="/pricing" className="text-muted-foreground no-underline transition-colors hover:text-primary">Pricing</a>
              <a href="/guides" className="text-muted-foreground no-underline transition-colors hover:text-primary">All Guides</a>
              <a href="/how-to-memorize-vocabulary" className="text-muted-foreground no-underline transition-colors hover:text-primary">Memorize Vocabulary</a>
              <a href="/how-to-learn-vocabulary-in-context" className="text-muted-foreground no-underline transition-colors hover:text-primary">Vocabulary in Context</a>
              <a href="/spaced-repetition-for-vocabulary" className="text-muted-foreground no-underline transition-colors hover:text-primary">Spaced Repetition</a>
              <a href="/how-many-words-should-you-learn-per-day" className="text-muted-foreground no-underline transition-colors hover:text-primary">Words Per Day</a>
              <a href="/contact" className="text-muted-foreground no-underline transition-colors hover:text-primary">Contact</a>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-foreground">Legal</h3>
            <div className="flex flex-col gap-2 text-sm">
              <a href="/terms" className="text-muted-foreground no-underline transition-colors hover:text-primary">Terms</a>
              <a href="/privacy" className="text-muted-foreground no-underline transition-colors hover:text-primary">Privacy</a>
              <a href="/disclaimer" className="text-muted-foreground no-underline transition-colors hover:text-primary">Disclaimer</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 w-full max-w-6xl border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">(c) {YEAR} Vocalibry. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
