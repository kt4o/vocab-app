import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const BREADCRUMB_ITEMS = getBreadcrumbItems("remember-vocabulary-from-books");

const BOOK_MEMORY_STEPS = [
  {
    title: "1. Save only the words that feel worth keeping",
    body:
      "Books expose you to a lot of unfamiliar vocabulary, but not every word deserves a place in your review system. Focus on words that are useful, expressive, repeated, or likely to appear again in the kinds of books and articles you actually read.",
  },
  {
    title: "2. Keep the word attached to its sentence or scene",
    body:
      "Vocabulary from books is easier to remember when it stays connected to the moment where you met it. A sentence, chapter, or short note about the scene gives memory more to hold onto than an isolated definition.",
  },
  {
    title: "3. Review with recall, not just recognition",
    body:
      "If you want words from books to stay with you, you usually need more than a lookup. Flashcards, short quizzes, or self-explanations force your memory to retrieve the word later, which is what makes it more durable.",
  },
  {
    title: "4. Revisit weak words before they disappear",
    body:
      "Words that still feel shaky should come back sooner than words you can already recall easily. Short follow-up review sessions are often enough to keep useful vocabulary from slipping away.",
  },
  {
    title: "5. Use the strongest words in your own writing or speech",
    body:
      "A word becomes more stable when you actively use it. Even one short sentence of your own can move a word from something you recognize in a novel to something you can actually use yourself.",
  },
];

const BOOK_ROUTINE = [
  "While reading: mark useful unfamiliar words, but stay selective.",
  "After reading: save the word with a sentence, chapter, or short context clue.",
  "Within 24 hours: test yourself on the word without looking at the definition first.",
  "Later in the week: revisit weak words, type answers from memory, and drop words that are too rare to matter.",
];

const BOOK_FAQS = [
  {
    question: "What is the best way to remember vocabulary from books?",
    answer:
      "The best way is to save useful words in context, review them with active recall, and revisit the ones you keep forgetting. A short follow-up routine usually works better than relying on the original lookup alone.",
  },
  {
    question: "Should I save every unfamiliar word I see in a book?",
    answer:
      "Usually no. It is better to save the words that feel useful, repeated, expressive, or likely to appear again. Selectivity makes review easier and improves retention.",
  },
  {
    question: "Why do words from novels disappear so quickly?",
    answer:
      "Because seeing a word once, even in good context, often creates recognition more than lasting recall. The word usually needs retrieval practice and a second encounter before it sticks.",
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
    href: "https://doi.org/10.1017/S0272263119000102",
  },
];

export function RememberVocabularyFromBooksPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        <section className="px-4 py-16">
          <article className="mx-auto max-w-4xl">
            <GuideBreadcrumbs items={BREADCRUMB_ITEMS} />
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">Book Vocabulary Guide</p>
            <h1 className="mb-6 text-[36px] font-bold leading-[1.1] tracking-tight text-[#111] md:text-[48px]" style={serif}>
              How to remember vocabulary from books
            </h1>
            <p className="mb-8 text-lg text-[#666]">
              Books are one of the richest sources of vocabulary growth because they give you words in real context,
              with tone, nuance, and repeated exposure. But many readers still forget the words they notice or look up.
              The solution is usually not to read less or study harder. It is to add a small memory system after the
              reading moment so useful words have a chance to stick.
            </p>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Quick answer</h2>
              <p className="text-[#666]">
                To remember vocabulary from books, save useful words in context, review them with active recall, revisit
                weak words on a spaced schedule, and use the strongest words in your own writing or speech.
              </p>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Why books are powerful for vocabulary growth</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Books do something isolated word lists cannot do well: they show vocabulary in action. You see how a
                  word behaves in a sentence, what tone it carries, which words it tends to appear with, and what kind of
                  scene or idea it belongs to.
                </p>
                <p>
                  That is why reading is such a strong foundation for vocabulary growth. The word does not arrive as a
                  bare label. It arrives with meaning and texture already attached.
                </p>
                <p>
                  The problem is that context alone does not always make memory durable. A lot of useful vocabulary fades
                  unless you bring it back once or twice after reading.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Why words from books often get forgotten</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  During reading, your main job is understanding the text. Even when you stop to look up a word, your
                  attention quickly returns to the story or argument. That means the word may be understood, but not
                  deeply stored.
                </p>
                <p>
                  Many readers also save too many words at once. That creates a large list with very little follow-up.
                  A smaller set of useful words almost always leads to better retention than a huge collection that never
                  gets reviewed properly.
                </p>
                <p>
                  A short recall step changes the picture. Once you come back to the word later and retrieve it again,
                  the word has a much better chance of becoming part of your vocabulary instead of remaining a one-time
                  lookup.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {BOOK_MEMORY_STEPS.map((step) => (
                <section key={step.title} className="rounded-[10px] border border-[#e5e1db] bg-white p-7">
                  <h2 className="mb-2 text-[18px] font-semibold text-[#111]">{step.title}</h2>
                  <p className="text-[#666]">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">A practical routine for book vocabulary</h2>
              <p className="mb-4 text-[#666]">
                You do not need to interrupt reading constantly or build a giant study spreadsheet. A simple routine is
                enough if you stay consistent.
              </p>
              <ul className="space-y-2 text-[#666]">
                {BOOK_ROUTINE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">How to decide which words are worth reviewing</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Good candidates are usually words that you are likely to see again, words that sharpen your sense of
                  tone, or words that would help you express yourself more precisely.
                </p>
                <p>
                  Rare decorative words are not always a good investment unless they genuinely matter to you. Review time
                  is limited, so it makes sense to spend it on vocabulary with a higher chance of return.
                </p>
                <p>
                  A useful question is: would I be glad to recognize or use this word again next month? If the answer is
                  yes, it probably belongs in your review queue.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Common mistakes readers make</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Do not confuse noticing a word with learning it. The reading moment is valuable, but it is often only
                  the start of memory.
                </p>
                <p>
                  Do not collect too many words at once. Volume without review usually leads to forgetting.
                </p>
                <p>
                  Do not strip away all the context. A sentence, chapter, or small note about the scene often makes the
                  word easier to retrieve later.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">FAQ: remembering vocabulary from books</h2>
              <div className="space-y-5">
                {BOOK_FAQS.map((item) => (
                  <div key={item.question}>
                    <h3 className="mb-2 text-[16px] font-semibold text-[#111]">{item.question}</h3>
                    <p className="text-[#666]">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Related guides</h2>
              <p className="mb-4 text-[#666]">
                If you often forget the words you look up, read{" "}
                <a href="/why-you-forget-words-you-look-up-while-reading" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  why you forget words you look up while reading
                </a>
                . For the bigger system, also see{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to expand your vocabulary
                </a>{" "}
                and{" "}
                <a href="/how-to-memorize-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to memorize vocabulary
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Sources and further reading</h2>
              <p className="mb-4 text-[#666]">
                This article is based on research about contextualized vocabulary learning, extensive reading, and
                retrieval-based retention.
              </p>
              <ul className="space-y-3 text-[#666]">
                {RESEARCH_SOURCES.map((source) => (
                  <li key={source.href}>
                    <a href={source.href} className="font-medium text-[#111] no-underline underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Build a better system for words from books</h2>
              <p className="mb-4 text-[#666]">
                The easier it is to save words from reading, review them later, and revisit weak vocabulary, the more
                likely those words are to stay with you. Explore the full workflow on the{" "}
                <a href="/features" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  Features page
                </a>
                , or compare options on{" "}
                <a href="/pricing" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  Pricing
                </a>
                .
              </p>
              <a
                href="/register"
                className="inline-flex h-[46px] items-center rounded-[10px] bg-[#111] px-7 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
              >
                Start free and remember more from reading
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
