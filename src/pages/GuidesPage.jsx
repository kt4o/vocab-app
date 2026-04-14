const GUIDE_CARDS = [
  {
    title: "Why you forget words you look up while reading",
    description:
      "Understand why looked-up words fade so quickly and how to remember useful vocabulary from books more reliably.",
    href: "/why-you-forget-words-you-look-up-while-reading",
  },
  {
    title: "How to expand your vocabulary",
    description:
      "A research-backed overview of contextual learning, retrieval practice, spaced repetition, and active use.",
    href: "/how-to-expand-your-vocabulary",
  },
  {
    title: "How to memorize vocabulary",
    description:
      "Learn how to remember words more effectively with better review habits, active recall, and smaller study sets.",
    href: "/how-to-memorize-vocabulary",
  },
  {
    title: "How to learn vocabulary in context",
    description:
      "See why context helps with meaning, tone, collocations, and real-world usage.",
    href: "/how-to-learn-vocabulary-in-context",
  },
  {
    title: "Spaced repetition for vocabulary",
    description:
      "Understand how review timing helps vocabulary move from short-term familiarity into long-term memory.",
    href: "/spaced-repetition-for-vocabulary",
  },
  {
    title: "How many words should you learn per day?",
    description:
      "Choose a vocabulary target you can actually sustain without losing quality or retention.",
    href: "/how-many-words-should-you-learn-per-day",
  },
];

export function GuidesPage() {
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
              <a href="/guides" className="text-foreground no-underline transition-colors hover:text-primary">
                Guides
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
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Learning Guides</p>
              <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">Vocabulary guides and study strategies</h1>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
                Explore practical guides on how to improve vocabulary, memorize words, learn in context, and build a
                study routine that actually lasts.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {GUIDE_CARDS.map((guide) => (
                <article
                  key={guide.href}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                >
                  <h2 className="mb-3 text-2xl font-semibold text-foreground">{guide.title}</h2>
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
      </main>
    </div>
  );
}
