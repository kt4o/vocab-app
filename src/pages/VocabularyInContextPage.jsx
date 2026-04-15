import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const BREADCRUMB_ITEMS = getBreadcrumbItems("vocabulary-in-context");

const CONTEXT_STEPS = [
  {
    title: "1. Save the sentence, not just the word",
    body:
      "A sentence gives you meaning, tone, grammar, and usage clues all at once. When you save vocabulary from reading, listening, or class, keep the original sentence or write a simple example of your own.",
  },
  {
    title: "2. Look for collocations and tone",
    body:
      "Words rarely live alone. Notice which words commonly appear together and whether the expression sounds formal, casual, academic, or emotional. This is often what separates real understanding from rough translation.",
  },
  {
    title: "3. Compare examples across different sources",
    body:
      "Seeing a word once can help you recognize it. Seeing it in multiple contexts helps you understand its range. Pay attention to how the same word behaves in articles, conversations, videos, and books.",
  },
  {
    title: "4. Turn context into recall practice",
    body:
      "Context is powerful, but it still works best when combined with retrieval. Hide the word and try to recall it from the sentence, or hide the meaning and explain what the word is doing in context.",
  },
  {
    title: "5. Reuse the pattern in your own writing",
    body:
      "Once you notice how a word behaves, copy the structure with your own idea. This is one of the easiest ways to turn context into active vocabulary.",
  },
];

const CONTEXT_PLAN = [
  "Week 1: Save useful words from reading or listening, and keep the original sentence with each one.",
  "Week 2: Start noticing tone, collocations, and grammar patterns around the words you collected.",
  "Week 3: Turn those examples into recall prompts, then write your own versions using similar structures.",
  "Week 4: Revisit the strongest examples, remove vague words, and keep the vocabulary you are likely to see again.",
];

const CONTEXT_FAQS = [
  {
    question: "Why is learning vocabulary in context better?",
    answer:
      "Learning vocabulary in context helps you remember meaning, tone, grammar, and common word partnerships at the same time. It leads to deeper understanding than memorizing isolated definitions.",
  },
  {
    question: "Can you learn vocabulary just by reading?",
    answer:
      "Reading is one of the best sources of contextual learning, especially when the material is understandable and interesting. It works even better when you save useful words and review them actively later.",
  },
  {
    question: "What does it mean to learn a word in context?",
    answer:
      'It means learning the word inside a real sentence or situation so you can understand not just what it means, but how it is used.',
  },
];

const RESEARCH_SOURCES = [
  {
    title: "Godwin-Jones (2018), Contextualized vocabulary learning",
    href: "https://doi.org/10.64152/10125/44651",
  },
  {
    title: "van den Broek et al. (2022), Vocabulary Learning During Reading: Benefits of Contextual Inferences Versus Retrieval Opportunities",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9285746/",
  },
  {
    title: "Liu and Zhang (2018), The Effects of Extensive Reading on English Vocabulary Learning: A Meta-analysis",
    href: "https://doi.org/10.5539/elt.v11n6p1",
  },
];

export function VocabularyInContextPage() {
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
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Context Learning Guide</p>
            <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
              How to learn vocabulary in context
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              If you want vocabulary to feel natural, context matters. Learning words in context helps you remember
              what a word means, how it sounds, where it fits, and what kinds of ideas it usually appears with. That
              is why contextual learning is stronger than memorizing isolated translations alone. A word learned in
              context is not just a definition. It is a small piece of language you can understand, recognize, and
              eventually use with more confidence.
            </p>
            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Quick answer</h2>
              <p className="text-muted-foreground">
                To learn vocabulary in context, collect words from real reading and listening, keep each word with its
                sentence, notice tone and collocations, and then review the word with active recall before using it in
                your own writing or speech.
              </p>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Why isolated vocabulary lists feel limited</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Vocabulary lists can help you notice new words, but they often leave out the details that make a
                  word usable. A translation or definition tells you part of the story, but not how the word behaves,
                  what tone it carries, or which phrases it commonly appears in.
                </p>
                <p>
                  That gap matters because vocabulary knowledge is richer than meaning alone. To really know a word,
                  you need to recognize it in real sentences and understand how it fits with other words around it.
                </p>
                <p>
                  This is one reason contextual learning feels more natural over time. It builds word knowledge that
                  is closer to how language is actually encountered outside study sessions.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">What context helps you learn that definitions miss</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Context helps you notice tone. A word may be correct in meaning but wrong in level of formality. A
                  sentence shows whether it sounds academic, conversational, technical, or emotional.
                </p>
                <p>
                  Context also helps you see collocations, which are the words that naturally appear together. This is
                  one of the biggest differences between rough understanding and fluent use.
                </p>
                <p>
                  And context helps memory. When a word is tied to a topic, a scene, or a sentence you care about, it
                  is easier to store and easier to retrieve later.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {CONTEXT_STEPS.map((step) => (
                <section key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">{step.title}</h2>
                  <p className="text-muted-foreground">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">A practical routine for learning words in context</h2>
              <p className="mb-4 text-muted-foreground">
                Contextual learning works best when it is organized. This simple month-long structure can help you move
                from noticing words to understanding and using them.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {CONTEXT_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How to make contextual learning more effective</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Choose input that is understandable enough to teach you something without overwhelming you. Reading
                  or listening that is too difficult makes it hard to notice useful patterns.
                </p>
                <p>
                  Save fewer examples, but save better ones. A clear sentence with a strong clue about meaning is more
                  valuable than five vague examples you will never revisit.
                </p>
                <p>
                  Turn context into production. Once you understand the sentence, write your own version. That step is
                  where contextual knowledge starts becoming active vocabulary.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Common mistakes when learning vocabulary in context</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Do not assume context alone is enough. Exposure helps, but words usually stick better when you also
                  review them actively.
                </p>
                <p>
                  Do not keep examples that are too long or confusing. Good context should clarify a word, not bury
                  it.
                </p>
                <p>
                  Do not ignore reuse. If you never try writing or saying the pattern yourself, contextual knowledge
                  may remain passive.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">FAQ: learning words in context</h2>
              <div className="space-y-5">
                {CONTEXT_FAQS.map((item) => (
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
                For the full system, read our guide on{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to expand your vocabulary
                </a>
                . If your main goal is retention, also read{" "}
                <a href="/how-to-memorize-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to memorize vocabulary
                </a>
                . You can browse the rest on our{" "}
                <a href="/guides" className="font-medium text-primary no-underline hover:underline">
                  guides page
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Sources and further reading</h2>
              <p className="mb-4 text-muted-foreground">
                This guide is grounded in sources on contextualized vocabulary learning, extensive reading, and the
                way contextual inference and retrieval opportunities shape retention.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                {RESEARCH_SOURCES.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      className="font-medium text-primary no-underline hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Build context into your daily study workflow</h2>
              <p className="mb-4 text-muted-foreground">
                A good system makes it easier to save examples, review words, and revisit weak vocabulary in one
                place. Explore the full workflow on the{" "}
                <a href="/features" className="font-medium text-primary no-underline hover:underline">
                  Features page
                </a>
                , or compare plans on{" "}
                <a href="/pricing" className="font-medium text-primary no-underline hover:underline">
                  Pricing
                </a>
                .
              </p>
              <a
                href="/register"
                className="inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-white no-underline transition-colors hover:bg-[#5d81d6]"
              >
                Start free and learn words in context
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
