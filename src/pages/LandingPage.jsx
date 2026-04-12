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
    title: "Build Your Vocabulary",
    description: "Track words, organize them into chapters, and access comprehensive definitions all in one place.",
  },
  {
    icon: Brain,
    title: "Smart Learning System",
    description: "Review queue that adapts to your learning pace and identifies weak words that need more practice.",
  },
  {
    icon: Trophy,
    title: "Compete & Connect",
    description: "Join leaderboards, connect with friends, and climb the ranks in Free or Pro leagues.",
  },
  {
    icon: Zap,
    title: "Practice Your Way",
    description: "Master vocabulary with flashcards and interactive quizzes designed to reinforce retention.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is Vocalibry free to use?",
    answer:
      "Yes. You can start with the Free plan and access core features like word tracking, flashcards, and quiz practice.",
    linkLabel: "See pricing",
    linkHref: "/pricing",
  },
  {
    question: "How does Vocalibry help me remember words long-term?",
    answer:
      "Vocalibry combines active recall, repeated quiz practice, and targeted review so weak words are revisited before you forget them.",
    linkLabel: "Explore features",
    linkHref: "/features",
  },
  {
    question: "Can I organize vocabulary by class or textbook chapter?",
    answer:
      "Yes. You can create books and chapters so your vocabulary lists match your school units, exam topics, or personal study plan.",
    linkLabel: "Create your account",
    linkHref: "/register",
  },
  {
    question: "Does Vocalibry support Japanese learners of English?",
    answer:
      "Yes. You can switch dictionary behavior to English-to-Japanese and use Japanese UI options while studying English vocabulary.",
    linkLabel: "Start for free",
    linkHref: "/register",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    title: "1. Add Words At Your Level",
    description:
      "Build your list from school units, exam topics, or daily reading and keep each word organized by book and chapter.",
    ctaLabel: "Create your free account",
    ctaHref: "/register",
  },
  {
    title: "2. Practice With Recall Loops",
    description:
      "Use flashcards and quiz modes to repeatedly retrieve meanings, spelling, and usage until recall becomes automatic.",
    ctaLabel: "See plan details",
    ctaHref: "/pricing",
  },
  {
    title: "3. Fix Weak Spots Faster",
    description:
      "Review mistakes and revisit low-accuracy words in focused sessions so gaps are corrected before they become habits.",
    ctaLabel: "Start learning now",
    ctaHref: "/register",
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
                Chapter Planner is live: build clean word lists by book and unit in seconds.
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
              <a href="/terms" className="text-foreground no-underline transition-colors hover:text-primary">
                Terms
              </a>
              <a href="/privacy" className="text-foreground no-underline transition-colors hover:text-primary">
                Privacy
              </a>
              <a href="/disclaimer" className="text-foreground no-underline transition-colors hover:text-primary">
                Disclaimer
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
                <h1 className="mb-6 text-5xl font-bold text-foreground md:text-6xl">
                  Never forget a word again.
                </h1>
                <p className="mb-8 text-xl text-muted-foreground">
                  Confidently speak, read, and write English by learning words tailored to your level.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="/register"
                    className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-medium text-white no-underline shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
                  >
                    Get Started Free
                    <ArrowRight className="h-5 w-5" />
                  </a>
                  <a
                    href="/pricing"
                    className="rounded-lg border border-border bg-secondary px-8 py-3 font-medium text-foreground no-underline transition-colors hover:bg-muted"
                  >
                    Learn More
                  </a>
                </div>
              </div>
              <div className="relative">
                <img
                  src={appScreenshot}
                  alt="Vocalibry App Interface"
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
            <h2 className="mb-12 text-center text-3xl font-bold text-foreground">Everything You Need to Learn</h2>
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
                A simple loop designed to turn new vocabulary into long-term confidence.
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

        <section className="px-4 py-16" id="pricing">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground">Choose Your Plan</h2>
              <p className="text-muted-foreground">Start free and upgrade when you're ready for unlimited learning.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
                <div className="mb-8">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">Free</h2>
                  <div className="mb-3">
                    <span className="text-5xl font-bold text-foreground">A$0</span>
                  </div>
                  <p className="text-primary">Good for getting started.</p>
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
                  <p className="text-primary">Pro coming soon.</p>
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
                Quick answers about how Vocalibry works and who it is for.
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
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">© {YEAR} Vocabulary App. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
