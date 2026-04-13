const MEMORY_PILLARS = [
  {
    title: "1. Choose fewer words, but choose better ones",
    body:
      "Trying to memorize too many words at once usually leads to shallow review and quick forgetting. A smaller set of useful, high-frequency words gives you more chances to revisit them and use them in real situations.",
  },
  {
    title: "2. Attach each word to meaning and context",
    body:
      "A word is easier to remember when it is tied to a sentence, a situation, and a purpose. Instead of memorizing a bare translation, keep a short example and notice the tone, grammar, and collocations around the word.",
  },
  {
    title: "3. Test recall instead of rereading",
    body:
      "If you want vocabulary to stick, your memory has to do some work. Flashcards, self-quizzing, and short written recall tasks are usually more effective than looking at the same list again and again.",
  },
  {
    title: "4. Review on a spaced schedule",
    body:
      "Strong memory is usually built across several encounters, not one intense session. Review words soon after learning them, then widen the gap as they become easier. This helps move them into long-term memory.",
  },
  {
    title: "5. Use the word before you feel fully ready",
    body:
      "Writing or saying a word yourself is one of the best ways to discover whether you really know it. Even simple personal examples help turn a word from something you recognize into something you can actually use.",
  },
];

const MEMORY_PLAN = [
  "Week 1: Collect a small set of useful words and keep each one with a sentence or example.",
  "Week 2: Replace passive review with flashcards, recall prompts, and short written checks.",
  "Week 3: Focus more heavily on weak words and start using new vocabulary in your own sentences.",
  "Week 4: Retest everything, cut low-value words, and keep only the ones you are likely to meet again.",
];

const MEMORY_FAQS = [
  {
    question: "What is the fastest way to memorize vocabulary?",
    answer:
      "The fastest reliable method is to learn useful words in context, review them with active recall, and revisit them on a spaced schedule. Speed comes from consistency, not from cramming.",
  },
  {
    question: "Why do I forget new words so quickly?",
    answer:
      "Many learners forget words quickly because they only reread them. Words last longer when you retrieve them from memory, meet them again in context, and use them yourself.",
  },
  {
    question: "How many words should I memorize at a time?",
    answer:
      "A smaller set is usually better. For many learners, 5 to 15 words in a session is enough if the words are reviewed properly and reused over several days.",
  },
];

const RESEARCH_SOURCES = [
  {
    title: "Karpicke and Blunt (2011), Retrieval practice produces more learning than elaborative studying with concept mapping",
    href: "https://doi.org/10.1126/science.1199327",
  },
  {
    title: "McKeown (2019), Effective Vocabulary Instruction Fosters Knowing Words, Using Words, and Understanding How Words Work",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8753997/",
  },
  {
    title: "Godwin-Jones (2018), Contextualized vocabulary learning",
    href: "https://doi.org/10.64152/10125/44651",
  },
];

export function MemorizeVocabularyPage() {
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
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Vocabulary Memory Guide</p>
            <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
              How to memorize vocabulary and actually remember it
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              If you want to memorize vocabulary fast, the real goal is not short-term recognition. It is long-term
              recall. A lot of learners can recognize a word on Tuesday and forget it by Thursday because the learning
              method never pushed the word beyond familiarity. Stronger retention usually comes from a different
              approach: learn useful words in context, retrieve them from memory, revisit them on a spaced schedule,
              and use them before they feel fully comfortable.
            </p>
            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Quick answer</h2>
              <p className="text-muted-foreground">
                To memorize vocabulary more effectively, focus on useful words, attach them to examples, practice
                active recall, review with spaced repetition, and use the words in your own sentences.
              </p>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Why memorizing vocabulary often fails</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Many vocabulary routines fail because they aim for quick exposure instead of durable memory. Looking
                  at a list several times can make words feel familiar, but familiarity is fragile. It disappears fast
                  when you have not been forced to recall the word without help.
                </p>
                <p>
                  Another problem is overload. Learners often collect more words than they can realistically review.
                  That creates the feeling of progress without the stability that real retention requires. A smaller
                  set, studied well, almost always beats a large set studied badly.
                </p>
                <p>
                  The better question is not just, "How many words can I memorize today?" It is, "Which words can I
                  still recall and use next week?" That shift changes the whole method.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">What stronger memory usually depends on</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Strong vocabulary memory usually comes from repeated, effortful contact. Research on retrieval
                  practice supports the idea that trying to remember a word strengthens later recall more effectively
                  than passive rereading.
                </p>
                <p>
                  Context matters too. A word tied to a sentence, a topic, or a real situation is easier to store and
                  easier to retrieve later because it has more meaning attached to it.
                </p>
                <p>
                  And finally, review timing matters. Returning to a word after a little forgetting has started helps
                  memory consolidate. That is why spacing and active recall work so well together.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {MEMORY_PILLARS.map((pillar) => (
                <section key={pillar.title} className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">{pillar.title}</h2>
                  <p className="text-muted-foreground">{pillar.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">A practical memory routine for new words</h2>
              <p className="mb-4 text-muted-foreground">
                If you want a simple structure, use a routine like this. The point is not to make vocabulary study
                feel complicated. The point is to create enough repetition and retrieval for memory to hold.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {MEMORY_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How to make memorized words stick longer</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Keep your review active. Hide the answer, explain the word aloud, type it from memory, or use it in
                  a new sentence. The more your memory has to reconstruct, the stronger recall becomes.
                </p>
                <p>
                  Return to difficult words more often, but do not abandon easy ones completely. Memory grows through
                  a mix of reinforcement and spacing, not through one perfect session.
                </p>
                <p>
                  Try to connect each word to something concrete: a class topic, a phrase you have heard, a sentence
                  from a book, or a personal example. Memory improves when words feel attached to something real.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Common mistakes when trying to memorize vocabulary</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Do not treat vocabulary like a one-day task. Cramming can create short-term recognition, but it is
                  usually poor preparation for long-term recall.
                </p>
                <p>
                  Do not rely only on translation pairs. If you never see how a word behaves in a sentence, your
                  memory will be thinner and less flexible.
                </p>
                <p>
                  Do not collect more words than you can revisit. Review quality matters more than collection speed.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">FAQ: memorizing vocabulary</h2>
              <div className="space-y-5">
                {MEMORY_FAQS.map((item) => (
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
                For the bigger system behind memory and retention, read our guide on{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to expand your vocabulary
                </a>{" "}
                or learn{" "}
                <a href="/how-to-learn-vocabulary-in-context" className="font-medium text-primary no-underline hover:underline">
                  how to learn vocabulary in context
                </a>
                . For review timing, also read{" "}
                <a href="/spaced-repetition-for-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  spaced repetition for vocabulary
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Sources and further reading</h2>
              <p className="mb-4 text-muted-foreground">
                This article draws on a small set of reliable sources about retrieval practice, contextual learning,
                and what effective vocabulary instruction looks like in practice.
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
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Build a memory-friendly study system</h2>
              <p className="mb-4 text-muted-foreground">
                Memory improves when your words, review sessions, and weak-word tracking are easy to revisit. Explore
                the full workflow on the{" "}
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
                Start free and remember more words
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
