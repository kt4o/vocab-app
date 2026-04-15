import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const BREADCRUMB_ITEMS = getBreadcrumbItems("vocabulary-guide");

const GUIDE_STEPS = [
  {
    title: "1. Start with words you are likely to meet again",
    body:
      "Vocabulary grows faster when the input is meaningful and repeated. Instead of collecting random rare words, focus on words that show up in your reading, your course materials, your work, and the media you already consume. Research on contextualized vocabulary learning points in the same direction: repeated encounters in meaningful settings help learners attach form, meaning, tone, and usage to the same word over time.",
  },
  {
    title: "2. Learn words in context, not as isolated translations",
    body:
      "A definition is only the beginning. Strong vocabulary knowledge includes how a word behaves in sentences, which words it commonly appears with, and whether it sounds formal, technical, casual, or emotional. That is why a sentence, example, or short passage is more valuable than a bare word list. Context helps you learn nuance, not just rough meaning.",
  },
  {
    title: "3. Use retrieval practice, not just rereading",
    body:
      "One of the clearest findings in learning research is that trying to remember information strengthens memory better than simply seeing it again. For vocabulary, that means flashcards, self-quizzing, recall drills, and short written answers usually beat passive review. Retrieval feels harder in the moment, but that effort is part of why it works.",
  },
  {
    title: "4. Space your review so memory has to work",
    body:
      "Cramming can create short-term familiarity, but it is weak preparation for long-term use. Spaced review is more effective because it asks you to return to a word after some forgetting has started. The research literature on spacing is broad, and the practical takeaway is simple: review words across days and weeks instead of trying to master them in one sitting.",
  },
  {
    title: "5. Move words from recognition to use",
    body:
      "A learner can often recognize a word long before they can use it naturally. That gap matters. Strong vocabulary instruction emphasizes not only knowing words but using them and understanding how they work. Write your own sentence, explain the word in plain language, or use it in speech. Production reveals whether you really own the word.",
  },
  {
    title: "6. Read and listen widely enough to meet words again",
    body:
      "Vocabulary expands through deliberate study, but also through volume of input. Extensive reading and regular listening expose you to words repeatedly and in varied contexts. That repetition helps consolidate meaning and usage. The most durable gains usually come from combining explicit study with large amounts of understandable input.",
  },
];

const QUICK_PLAN = [
  "Day 1-7: Save 10 to 15 useful words from real content, and keep each word with a sentence or example.",
  "Day 8-14: Start short retrieval sessions with flashcards or quizzes instead of rereading your list.",
  "Day 15-21: Use each word in your own writing or speech, and note which ones still feel unnatural.",
  "Day 22-30: Revisit weak words on a spaced schedule, then test yourself on meaning, form, and usage.",
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
    title: "McKeown (2019), Effective Vocabulary Instruction Fosters Knowing Words, Using Words, and Understanding How Words Work",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8753997/",
  },
  {
    title: "Liu and Zhang (2018), The Effects of Extensive Reading on English Vocabulary Learning: A Meta-analysis",
    href: "https://doi.org/10.5539/elt.v11n6p1",
  },
  {
    title: "Karpicke and Blunt (2011), Retrieval practice produces more learning than elaborative studying with concept mapping",
    href: "https://doi.org/10.1126/science.1199327",
  },
];

const FAQS = [
  {
    question: "What is the best way to expand your vocabulary?",
    answer:
      "The strongest approach is to learn useful words in context, review them with active recall, space your practice over time, and use the words in your own speaking or writing. That combination supports both memory and real-world use.",
  },
  {
    question: "How can I improve my vocabulary every day?",
    answer:
      "A short daily routine works well. Save a few useful words from real reading or listening, review them with flashcards or quiz prompts, and use at least one of them in a sentence of your own.",
  },
  {
    question: "Is reading enough to improve vocabulary?",
    answer:
      "Reading helps a lot, especially when it is extensive and understandable, but it works better when combined with deliberate review. Reading gives you exposure, while retrieval practice and active use help words stick.",
  },
  {
    question: "How many new words should you learn each week?",
    answer:
      "A manageable target is usually better than an ambitious one. For many learners, 10 to 20 useful words per week is enough if the words are reviewed well and reused in context.",
  },
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
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-primary">Vocabulary Learning Guide</p>
            <h1 className="mb-6 text-4xl font-bold text-foreground md:text-5xl">
              How to expand your vocabulary: what research suggests actually works
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              If you want to know how to expand your vocabulary, the short answer is this: do not rely on random word
              lists alone. The best way to improve vocabulary is to learn useful words in context, retrieve them from
              memory, review them over time, and use them in real sentences. The goal is not to sound impressive. The
              goal is to understand more, communicate more precisely, and make new language feel natural.
            </p>
            <div className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Quick answer</h2>
              <p className="text-muted-foreground">
                If you want to expand your vocabulary efficiently, do five things consistently: choose useful words,
                learn them in context, practice retrieval, review them on a spaced schedule, and use them in your own
                speaking or writing. That combination is far more effective than passive rereading or random
                memorization because it trains both memory and real-world use.
              </p>
            </div>

            <section className="mb-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Why common vocabulary-building advice underdelivers</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  A lot of vocabulary advice confuses exposure with learning. Looking at a word repeatedly can make it
                  feel familiar, but familiarity is not the same as recall. You notice the term, recognize it when you
                  see it, and assume it has been learned. Then, a day later, you cannot define it or use it.
                </p>
                <p>
                  Research on vocabulary development also shows that word knowledge is not one thing. Knowing a word
                  includes meaning, form, use, associations, and appropriateness. That is why a strategy focused only
                  on definitions usually produces shallow learning. You may remember what a word means in a narrow
                  sense without knowing when to use it, what tone it carries, or which words it naturally belongs
                  beside.
                </p>
                <p>
                  A better method combines meaningful exposure, repeated encounters, and effortful recall. That mix is
                  more realistic, more durable, and more useful than memorizing disconnected lists.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How strong learners improve vocabulary more effectively</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  They do not treat vocabulary like a pile of flashcards with no background. They connect new words to
                  situations, examples, tone, and purpose. Research on contextualized vocabulary learning supports that
                  instinct: words are easier to retain when they live inside meaningful language rather than in
                  isolation.
                </p>
                <p>
                  They also test themselves instead of only rereading notes. Studies on retrieval practice repeatedly
                  show that trying to recall information strengthens later memory more than passive restudy. For
                  vocabulary learners, this supports routines built around self-testing, flashcards, and recall drills.
                </p>
                <p>
                  And they do not stop at recognition. Work on vocabulary instruction and productive vocabulary
                  suggests that learners need chances to explain, write, and say words so that knowledge becomes
                  usable, not just familiar.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {GUIDE_STEPS.map((step) => (
                <section key={step.title} className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-2 text-2xl font-semibold text-foreground">{step.title}</h2>
                  <p className="text-muted-foreground">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">30-day plan to improve your vocabulary</h2>
              <p className="mb-4 text-muted-foreground">
                If you want something practical, this is a reasonable starting structure. The aim is not to collect as
                many words as possible. The aim is to create a routine that helps useful words move from first contact
                to reliable use. Even a small daily habit works if you stay consistent with it.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                {QUICK_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">How to make new vocabulary stick</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Keep your list smaller than your ambition. A compact set of high-value words reviewed well is far
                  more effective than a long list you barely revisit.
                </p>
                <p>
                  Review earlier when a word is new, then widen the interval as it becomes easier. This is the logic
                  behind spaced repetition, and it works because forgetting is part of the learning cycle, not a sign
                  that learning has failed. Needing to work a little to remember something is often exactly what helps
                  it last.
                </p>
                <p>
                  Mix input and output. Read the word, hear it, define it, type it, say it, and use it in a sentence.
                  The more ways you interact with a word, the more flexible and durable your knowledge becomes.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Common mistakes people make when trying to improve vocabulary</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Do not collect impressive-looking words you are unlikely to meet again. Frequency and usefulness
                  usually matter more than difficulty.
                </p>
                <p>
                  Do not confuse recognition with mastery. If you never test recall, you will overestimate what you
                  know.
                </p>
                <p>
                  Do not wait for perfect confidence before using a word. Early use is messy, but it is also where
                  real learning happens.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-secondary p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">FAQ: how to improve vocabulary</h2>
              <div className="space-y-5">
                {FAQS.map((item) => (
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
                If you want to go deeper, read our guide on{" "}
                <a href="/how-to-memorize-vocabulary" className="font-medium text-primary no-underline hover:underline">
                  how to memorize vocabulary
                </a>{" "}
                for retention strategies, or learn{" "}
                <a href="/how-to-learn-vocabulary-in-context" className="font-medium text-primary no-underline hover:underline">
                  how to learn vocabulary in context
                </a>{" "}
                for a deeper look at meaning, tone, and usage. You can also browse all of our{" "}
                <a href="/guides" className="font-medium text-primary no-underline hover:underline">
                  vocabulary guides
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Sources and further reading</h2>
              <p className="mb-4 text-muted-foreground">
                This article is based on a small set of reliable sources covering contextualized vocabulary learning,
                retrieval practice, productive vocabulary, and extensive reading. Each source below is linked directly.
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
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Build the habit with the right tools</h2>
              <p className="mb-4 text-muted-foreground">
                A good system becomes easier to maintain when your words, reviews, and weak-word tracking live in one
                place. If you are looking for a practical way to build vocabulary every day, explore the full study
                workflow on the{" "}
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
