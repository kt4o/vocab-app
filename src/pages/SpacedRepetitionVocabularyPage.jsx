import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const BREADCRUMB_ITEMS = getBreadcrumbItems("spaced-repetition-vocabulary");

const SPACING_STEPS = [
  {
    title: "1. Review early, then widen the gap",
    body:
      "A new word usually needs quick follow-up. Review it soon after learning, then give it more time between later reviews as it becomes easier to remember.",
  },
  {
    title: "2. Let forgetting do part of the work",
    body:
      "Spacing works because memory becomes stronger when you have to work a little to retrieve something. If review feels too easy every time, it is often happening too soon.",
  },
  {
    title: "3. Prioritize difficult words more often",
    body:
      "Not every word needs the same schedule. Words you miss, confuse, or avoid using should come back sooner than words you can already recall confidently.",
  },
  {
    title: "4. Combine spacing with active recall",
    body:
      "Spacing is strongest when you are actually retrieving the word, not just glancing at it. Flashcards, quiz prompts, and short writing checks work well together with spaced review.",
  },
];

const SPACING_PLAN = [
  "Day 1: Learn a small set of words and review them once later the same day.",
  "Day 2-3: Retest the same words with active recall and separate the easy ones from the weak ones.",
  "Day 4-7: Bring weak words back sooner and let stronger words wait a little longer.",
  "Week 2 onward: Keep widening the gap for words you can recall confidently while recycling difficult words more often.",
];

const SPACING_FAQS = [
  {
    question: "What is spaced repetition for vocabulary?",
    answer:
      "Spaced repetition is a review method where you revisit vocabulary over gradually increasing intervals instead of cramming in one sitting.",
  },
  {
    question: "Does spaced repetition help you remember words longer?",
    answer:
      "Yes. Spaced review is widely supported by learning research because it strengthens memory over time and reduces the quick forgetting that follows cramming.",
  },
  {
    question: "How often should I review vocabulary?",
    answer:
      "New words should be reviewed sooner, while familiar words can be reviewed less often. The right schedule depends on how easily you can recall each word.",
  },
];

const RESEARCH_SOURCES = [
  {
    title: "Karpicke and Blunt (2011), Retrieval practice produces more learning than elaborative studying with concept mapping",
    href: "https://doi.org/10.1126/science.1199327",
  },
  {
    title: "van den Broek et al. (2022), Vocabulary Learning During Reading: Benefits of Contextual Inferences Versus Retrieval Opportunities",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9285746/",
  },
];

export function SpacedRepetitionVocabularyPage() {
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
          <article className="mx-auto max-w-4xl">
            <GuideBreadcrumbs items={BREADCRUMB_ITEMS} />
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Review Strategy Guide</p>
            <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">Spaced repetition for vocabulary</h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Spaced repetition helps vocabulary last because it spreads review over time instead of relying on one
              intense study session. When you revisit a word just as memory starts to weaken, recall gets stronger.
              That is why spacing is one of the most useful principles behind long-term vocabulary retention.
            </p>
            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Quick answer</h2>
              <p className="text-muted-foreground">
                Use spaced repetition by reviewing new words soon after learning them, then increasing the delay as
                recall gets easier. Pair that schedule with active recall so each review actually strengthens memory.
              </p>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Why cramming gives weak results</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Cramming can make vocabulary feel familiar in the short term, but that familiarity is unstable. The
                  words seem available during the study session because they were just in front of you, not because
                  they have been stored strongly in memory.
                </p>
                <p>
                  This is one reason many learners feel productive after a long review session and then struggle to
                  remember the same words a few days later. The method created exposure, but not enough spacing and
                  retrieval for durable recall.
                </p>
                <p>
                  Spaced repetition addresses that problem by spreading effort over time. Instead of trying to force
                  mastery in one sitting, it uses a sequence of reviews to strengthen memory gradually.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Why spacing works so well with vocabulary</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Vocabulary learning depends on repetition, but not all repetition is equal. When you review too soon,
                  the answer may still be sitting in short-term memory. That can make the session feel successful even
                  when little long-term strengthening has happened.
                </p>
                <p>
                  Spacing improves that by allowing some forgetting to happen before the next review. The effort needed
                  to retrieve the word becomes part of the learning process.
                </p>
                <p>
                  This is also why spaced repetition is usually strongest when paired with active recall. Timing helps,
                  but the real gain comes when the learner has to remember, not just re-see.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {SPACING_STEPS.map((step) => (
                <section key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">{step.title}</h2>
                  <p className="text-muted-foreground">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">A simple spaced review routine</h2>
              <p className="mb-4 text-muted-foreground">
                You do not need a complicated algorithm to start using spacing well. A simple rhythm like this can
                already improve retention.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {SPACING_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How to get better results from spaced repetition</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Keep the review load manageable. If you keep adding new words without enough time to revisit older
                  ones, your spacing system will collapse under its own volume.
                </p>
                <p>
                  Separate weak words from easy words. Spacing works best when difficult items return sooner and strong
                  items are allowed to wait longer.
                </p>
                <p>
                  Use more than one form of recall. Definitions, typing, sentence completion, and self-explanation all
                  strengthen memory from slightly different angles.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Common mistakes with spaced repetition</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Do not review so often that memory never has to work. If every review is effortless, the timing may
                  be too short.
                </p>
                <p>
                  Do not treat all words the same. Some need repeated attention because they are abstract, unfamiliar,
                  or easy to confuse with similar vocabulary.
                </p>
                <p>
                  Do not let spacing replace understanding. A word still needs meaning, context, and usage clues if
                  you want it to be useful outside the flashcard.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">FAQ: spaced repetition</h2>
              <div className="space-y-5">
                {SPACING_FAQS.map((item) => (
                  <div key={item.question}>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{item.question}</h3>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Related guides</h2>
              <p className="mb-4 text-muted-foreground">
                Read our main guide on{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to expand your vocabulary
                </a>{" "}
                or see{" "}
                <a href="/how-to-memorize-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to memorize vocabulary
                </a>{" "}
                for a fuller memory strategy.
              </p>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Sources and further reading</h2>
              <p className="mb-4 text-muted-foreground">
                This article is informed by research on retrieval practice and vocabulary learning during reading,
                especially the role of retrieval opportunities in stronger retention.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                {RESEARCH_SOURCES.map((source) => (
                  <li key={source.href}>
                    <a href={source.href} className="font-medium text-primary no-underline hover:underline" target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Build spaced review into your workflow</h2>
              <p className="mb-4 text-muted-foreground">
                Spacing is easier to maintain when your words, review sessions, and weak-word tracking are organized
                in one place. Explore the full study workflow on the{" "}
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
                Start free and review smarter
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
