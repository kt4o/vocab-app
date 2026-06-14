import { Check, X, BookOpen, Brain, Trophy, Zap, ArrowRight, Languages } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const appScreenshot = "/landing/book-page.png";
const YEAR = new Date().getFullYear();

const FEATURE_CARDS = [
  {
    icon: BookOpen,
    title: "Save Words From Real Input",
    description:
      "Add target-language words from books, manga, lessons, podcasts, videos, or class notes. Keep them grouped by book and chapter.",
  },
  {
    icon: Zap,
    title: "Review Before You Forget",
    description:
      "Use active recall and smart review to bring words back before they disappear from memory.",
  },
  {
    icon: Trophy,
    title: "See Your Progress",
    description:
      "Track streaks, quiz activity, and vocabulary growth so your study feels visible.",
  },
  {
    icon: Brain,
    title: "Move From Recognition To Recall",
    description:
      "Practice both directions with flashcards, typing, and quizzes until translations come back without prompting.",
  },
  {
    icon: Languages,
    title: "Study From English Or To English",
    description:
      "Built for English speakers learning Japanese, with English-to-Japanese and Japanese-to-English review modes.",
    href: "/learn-japanese-from-books",
    badge: "New",
  },
];

const HOW_IT_WORKS = [
  {
    title: "1. Add Words You Want To Learn",
    description:
      "Save useful words from your target language: reading, textbooks, manga, lessons, videos, or notes.",
    href: "/register",
    label: "Create your free account",
  },
  {
    title: "2. Check Your Memory",
    description:
      "Use flashcards and quizzes to practice the translation, meaning, reading, or original word.",
    href: "/features",
    label: "Explore features",
  },
  {
    title: "3. Repeat Weak Words",
    description:
      "Focus on missed words first so difficult vocabulary gets more reps before it fades.",
    href: "/register",
    label: "Start learning now",
  },
];

const FORGETTING_REASONS = [
  {
    title: "A lookup is not a memory",
    description:
      "A translation helps you understand the sentence now. It does not always make the word available tomorrow.",
  },
  {
    title: "Context helps",
    description:
      "Target-language words are easier to remember when they stay linked to the sentence, book, chapter, or lesson where you found them.",
  },
  {
    title: "Testing helps more than rereading",
    description:
      "Short flashcard and quiz sessions help you pull the word from memory, not only see the answer again.",
  },
];

const LANGUAGE_MODES = [
  {
    label: "English",
    text: "Target word -> English meaning",
  },
  {
    label: "English to Japanese",
    text: "hello -> こんにちは",
  },
  {
    label: "Japanese to English",
    text: "記憶 -> memory",
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
  { type: "check", text: "Up to 100 saved words" },
  { type: "check", text: "Unlimited word testing", note: "Included", muted: true },
  { type: "check", text: "Smart Review queue" },
  { type: "x", text: "Ads", note: "May be introduced later", muted: true },
];

const PRO_PLAN = [
  { type: "check", text: "Word tracking, chapters, and definitions" },
  { type: "check", text: "Flashcards and quiz practice" },
  { type: "check", text: "Unlimited saved words", note: "Included" },
  { type: "check", text: "Smart Review queue" },
  { type: "check", text: "Ads", note: "Ad-free" },
];

const FAQ = [
  {
    question: "Who is Vocalibry for?",
    answer:
      "Vocalibry is for English-speaking language learners who save target-language words while reading, studying, or taking notes and need an easy way to review them later.",
    href: "#how-it-works",
    label: "See how it works",
  },
  {
    question: "Why do new words disappear so quickly?",
    answer:
      "Because understanding a word once is not the same as remembering it later. Words stick better when you test yourself and review them again.",
    href: "/how-to-expand-your-vocabulary",
    label: "Read the guide",
  },
  {
    question: "Is Vocalibry free to use?",
    answer:
      "Yes. You can start with the Free plan, use every learning feature, and save up to 100 total words.",
    href: "#pricing",
    label: "See pricing",
  },
  {
    question: "Which languages can I study?",
    answer:
      "You can use English vocabulary books, English-to-Japanese books, and Japanese-to-English books. The study loop works especially well for Japanese kanji, kana, readings, and English translations.",
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
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6F92E8]">For English-Speaking Language Learners</p>
              <h1 className="mb-4 text-[42px] font-bold leading-[1.05] text-foreground sm:text-[52px] md:text-[68px]">
                Never forget a word again.
              </h1>
              <p className="mx-auto mb-5 max-w-[800px] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
                Save words from the language you are learning, attach English meanings, and review them with flashcards, typing, and quizzes. Built especially for English speakers studying Japanese.
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
              Keep target-language words, English meanings, readings, and review progress in one focused study workspace.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {LANGUAGE_MODES.map((mode) => (
                <article key={mode.label} className="rounded-lg border border-border/40 bg-white px-4 py-3 text-left">
                  <p className="text-[13px] font-semibold text-[#6F92E8]">{mode.label}</p>
                  <p className="mt-1 text-[15px] text-foreground">{mode.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="features">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">A calmer way to learn another language</h2>
            <p className="mx-auto mb-12 max-w-3xl text-center text-[16px] text-muted-foreground sm:mb-16 sm:text-[17px]">
              Keep new words in one place, review them in both directions, and spend more time practicing than managing lists.
            </p>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
              {FEATURE_CARDS.map((card) => (
                <article key={card.title} className="text-center">
                  <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-[#e8eefc]">
                    <card.icon className="h-8 w-8 text-[#6F92E8]" />
                    {card.badge ? (
                      <span className="absolute -right-5 -top-2 rounded-full bg-[#dff6ec] px-2 py-0.5 text-[11px] font-semibold text-[#157347]">
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mb-2 text-[17px] font-semibold text-foreground">{card.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{card.description}</p>
                  {card.href ? (
                    <a href={card.href} className="mt-3 inline-flex text-[15px] font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                      Learn more
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto grid w-full max-w-[1120px] gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6F92E8]">Japanese Study</p>
              <h2 className="mb-4 text-[30px] font-bold text-foreground sm:text-[36px]">Study Japanese with English meanings</h2>
              <p className="mb-5 text-[16px] leading-relaxed text-muted-foreground">
                Create Japanese books, save kanji or kana, add English translations, and review Japanese-to-English or English-to-Japanese cards.
              </p>
              <a href="/learn-japanese-from-books" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#8FB0FF] px-5 text-[15px] font-medium text-white no-underline transition-colors hover:bg-[#6F92E8]">
                Explore Japanese books
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-lg border border-border/40 bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,0.10)]">
              <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#6F92E8]">Japanese to English</p>
                  <h3 className="text-[20px] font-semibold text-foreground">吾輩は猫である</h3>
                </div>
                <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[12px] font-semibold text-[#5d81d6]">Book</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["単語", "word"],
                  ["記憶", "memory"],
                  ["復習", "review"],
                ].map(([word, meaning]) => (
                  <div key={word} className="rounded-lg border border-border/40 bg-[#f8fafe] p-4">
                    <strong className="block text-[24px] text-foreground">{word}</strong>
                    <span className="text-[14px] text-muted-foreground">{meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="how-it-works">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">How It Works</h2>
            <p className="mb-12 text-center text-[16px] text-muted-foreground">
              A simple loop for turning target-language words into vocabulary you can recall from English.
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
            <h2 className="mb-10 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:mb-12 md:text-[40px]">Why language learners forget new words</h2>
            <p className="mx-auto mb-12 max-w-4xl text-center text-[16px] text-muted-foreground">
              Recognizing a word in a sentence is helpful, but it is usually not enough. Save the word, test the English meaning and the target-language form, and review the ones that still feel difficult.
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
              for a step-by-step system for English-speaking learners, then explore all study tools on{" "}
              <a href="/features" className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                Features
              </a>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-border/40 bg-[#f5f7fb] px-4 py-14 sm:px-6 sm:py-16" id="guides">
          <div className="mx-auto w-full max-w-[1280px]">
            <h2 className="mb-4 text-center text-[30px] font-bold text-foreground sm:text-[36px] md:text-[40px]">Guides for language vocabulary</h2>
            <p className="mb-12 text-center text-[16px] text-muted-foreground">
              Explore practical guides on remembering translations, learning words in context, and choosing a study routine you can keep.
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
              <p className="text-[16px] text-muted-foreground">Start free and build a language vocabulary habit that lasts.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <article className="rounded-xl border border-[#cfd9ec] bg-[#f5f7fb] p-8 sm:p-10">
                <div className="mb-8">
                  <h3 className="mb-4 text-[22px] font-semibold text-foreground">Free</h3>
                  <div className="mb-3 text-[56px] font-bold leading-none text-foreground">A$0</div>
                  <p className="text-[15px] font-medium text-[#6F92E8]">Good for starting your language vocabulary system.</p>
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
                  <p className="text-[14px] text-muted-foreground">Unlimited saved words and an ad-free experience.</p>
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
            <p className="mb-12 text-center text-[16px] text-muted-foreground">Quick answers for English-speaking language learners.</p>

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
                Save target-language words, review them from English and back again, and remember more of what you study.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-foreground">Product</h4>
              <div className="space-y-3">
                <a href="/features" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Features</a>
                <a href="/learn-japanese-from-books" className="block text-[15px] text-muted-foreground no-underline transition-colors hover:text-foreground">Japanese Books</a>
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
