const GUIDE_STEPS = [
  {
    title: "1. Collect useful words from real context",
    body:
      "Add vocabulary from class notes, reading, videos, and conversations. Words learned in context are easier to remember and easier to use correctly.",
  },
  {
    title: "2. Use active recall instead of passive review",
    body:
      "Test yourself daily with quizzes and flashcards. Retrieving words from memory is one of the fastest ways to expand your vocabulary long-term.",
  },
  {
    title: "3. Review mistakes before they fade",
    body:
      "Track errors and revisit weak words first. This closes learning gaps quickly and stops repeated mistakes from becoming habits.",
  },
  {
    title: "4. Repeat with short daily sessions",
    body:
      "A 10-20 minute daily routine beats occasional long sessions. Consistency and spaced repetition are the keys to steady vocabulary growth.",
  },
];

const QUICK_PLAN = [
  "Day 1-7: Add 10-20 practical words and quiz daily.",
  "Day 8-14: Keep adding words, then run typing or recall drills.",
  "Day 15-21: Focus on weak words and mistake review.",
  "Day 22-30: Re-quiz all saved words and track accuracy gains.",
];

export function VocabularyGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="flex items-center gap-2 no-underline">
              <img src="/favicon.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
              <span className="text-lg font-semibold text-foreground">Vocalibry</span>
            </a>
            <nav className="hidden items-center gap-6 md:flex">
              <a href="/how-to-expand-your-vocabulary" className="text-foreground no-underline transition-colors hover:text-primary">
                Vocabulary Guide
              </a>
              <a href="/features" className="text-foreground no-underline transition-colors hover:text-primary">
                Features
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
        <section className="px-4 py-16">
          <article className="mx-auto max-w-4xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Vocabulary Learning Guide</p>
            <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
              How to expand your vocabulary: a practical daily system
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              If you are wondering how to expand your vocabulary, the answer is not random memorization. Use a
              repeatable loop: collect useful words, practice active recall, and review mistakes on a daily schedule.
            </p>

            <div className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Quick answer</h2>
              <p className="text-muted-foreground">
                To improve vocabulary fast, study words in context, test recall every day, and revisit weak words
                using spaced repetition. Vocalibry helps you run this exact loop with books, chapters, flashcards,
                and quiz modes.
              </p>
            </div>

            <div className="space-y-5">
              {GUIDE_STEPS.map((step) => (
                <section key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">{step.title}</h2>
                  <p className="text-muted-foreground">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">30-day vocabulary expansion plan</h2>
              <ul className="space-y-2 text-muted-foreground">
                {QUICK_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Tools that help this process</h2>
              <p className="mb-4 text-muted-foreground">
                Explore the full study workflow on the{" "}
                <a href="/features" className="font-medium text-primary no-underline hover:underline">
                  Features page
                </a>
                , or compare options on{" "}
                <a href="/pricing" className="font-medium text-primary no-underline hover:underline">
                  Pricing
                </a>
                .
              </p>
              <a
                href="/register"
                className="inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-white no-underline transition-colors hover:bg-[#5d81d6]"
              >
                Start free and build your vocabulary
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
