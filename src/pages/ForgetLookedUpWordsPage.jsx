import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const BREADCRUMB_ITEMS = getBreadcrumbItems("forget-looked-up-words");

const FORGETTING_REASONS = [
  {
    title: "1. Looking up a word helps comprehension, not automatic retention",
    body:
      "When you stop to check a word in a book, you often understand the sentence immediately. That solves the reading problem in the moment, but it does not guarantee the word will still be available tomorrow. Comprehension and memory are related, but they are not the same thing.",
  },
  {
    title: "2. A single lookup creates shallow familiarity",
    body:
      "Many words feel familiar right after you have seen the definition. That feeling can be misleading. Familiarity is weaker than recall, and it disappears quickly when you have not had to retrieve the word without help.",
  },
  {
    title: "3. Reading gives exposure, but recall needs a second step",
    body:
      "Books are excellent sources of vocabulary because they provide tone, context, and repeated encounters. But reading alone often leaves the word in passive memory. To remember it later, you usually need a short follow-up review that forces retrieval.",
  },
  {
    title: "4. Many looked-up words are never seen again soon enough",
    body:
      "A word becomes easier to remember when it returns before it has fully faded. If you look up a word once and do not revisit it for weeks, memory has very little to build on. That is why timing matters so much.",
  },
];

const READING_MEMORY_ROUTINE = [
  "While reading: save only useful words you would be happy to recognize and use again.",
  "Right after reading: keep the word with a sentence, chapter, or short context clue.",
  "Later the same day or next day: test yourself with a flashcard or recall prompt instead of rereading the definition.",
  "Over the next week: revisit weak words more often and drop words that are too rare or not worth the effort.",
];

const FORGETTING_FAQS = [
  {
    question: "Why do I forget words I look up while reading?",
    answer:
      "Because a dictionary lookup usually helps you understand the sentence, but it does not automatically create long-term memory. Words tend to stick better when you revisit them with active recall and a little spacing.",
  },
  {
    question: "Is reading alone enough to remember new vocabulary?",
    answer:
      "Reading is one of the best ways to meet useful words in context, but it often works better when you save important words and review them later. Exposure helps, while recall practice makes the memory more durable.",
  },
  {
    question: "What is the best way to remember words from books?",
    answer:
      "Save useful words in context, review them with active recall, and revisit the ones you keep missing. A short follow-up routine usually works better than relying on the original lookup.",
  },
];

const RESEARCH_SOURCES = [
  {
    title: "van den Broek et al. (2022), Vocabulary Learning During Reading: Benefits of Contextual Inferences Versus Retrieval Opportunities",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9285746/",
  },
  {
    title: "Godwin-Jones (2018), Contextualized vocabulary learning",
    href: "https://doi.org/10.64152/10125/44651",
  },
  {
    title: "Karpicke and Blunt (2011), Retrieval practice produces more learning than elaborative studying with concept mapping",
    href: "https://doi.org/10.1126/science.1199327",
  },
];

export function ForgetLookedUpWordsPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        <section className="px-4 py-16">
          <article className="mx-auto max-w-4xl">
            <GuideBreadcrumbs items={BREADCRUMB_ITEMS} />
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">Reading Vocabulary Guide</p>
            <h1 className="mb-6 text-[36px] font-bold leading-[1.1] tracking-tight text-[#111] md:text-[48px]" style={serif}>
              Why you forget words you look up while reading and how to remember them
            </h1>
            <p className="mb-8 text-lg text-[#666]">
              If you read in English often, you may recognize this pattern: you stop at an unfamiliar word, look it up,
              understand the sentence, keep reading, and then realize a day later that the word is gone. This happens to
              strong readers all the time. The issue is usually not intelligence or effort. It is that a lookup solves
              comprehension in the moment, while long-term memory needs a second step.
            </p>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Quick answer</h2>
              <p className="text-[#666]">
                You forget words you look up while reading because understanding them once does not create durable
                memory. The best fix is to save useful words in context, review them with active recall, and revisit the
                weak ones before they fade.
              </p>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Why this happens so often to readers</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Reading is one of the best environments for vocabulary growth because words arrive with real context,
                  tone, and meaning. But a lot of reading-related vocabulary learning is still passive. You notice the
                  word, decode it, and move on before memory has had to work.
                </p>
                <p>
                  That is why many readers end up looking up the same useful words more than once. The word was
                  understood, but not fully stored. The problem is not that reading failed. The problem is that the
                  learning loop ended too early.
                </p>
                <p>
                  Once you understand that difference, the solution becomes simpler. Keep reading for input, but add a
                  lightweight review habit so useful words get another chance to stick.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">What stronger retention depends on</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  The strongest vocabulary growth usually combines context with retrieval. Context helps you understand
                  what the word means and how it behaves. Retrieval helps you remember it later without seeing the answer.
                </p>
                <p>
                  This is why looked-up words often need a second encounter outside the book itself. A short flashcard,
                  quiz prompt, or self-test creates the effort that memory needs.
                </p>
                <p>
                  Timing matters too. Words are easier to retain when they come back before they have completely faded,
                  especially if the follow-up review asks you to recall rather than reread.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {FORGETTING_REASONS.map((item) => (
                <section key={item.title} className="rounded-[10px] border border-[#e5e1db] bg-white p-7">
                  <h2 className="mb-2 text-[18px] font-semibold text-[#111]">{item.title}</h2>
                  <p className="text-[#666]">{item.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">A simple routine for remembering words from books</h2>
              <p className="mb-4 text-[#666]">
                You do not need to turn reading into a heavy study session. A lightweight process is usually enough if
                you stay selective and review consistently.
              </p>
              <ul className="space-y-2 text-[#666]">
                {READING_MEMORY_ROUTINE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">How to choose which looked-up words are worth saving</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Not every unfamiliar word deserves a place in your review system. Prioritize words that feel useful,
                  expressive, repeated, or likely to appear again in future reading.
                </p>
                <p>
                  This matters because overload weakens memory. A small set of worthwhile words that you actually review
                  will help more than a giant list you never revisit.
                </p>
                <p>
                  Good candidates are often words that sharpen your understanding of the author&apos;s tone, appear in
                  nonfiction topics you care about, or would make your own speaking and writing more precise.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Common mistakes that keep words from sticking</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Do not rely on the lookup alone. It feels productive, but it usually gives you recognition more than
                  recall.
                </p>
                <p>
                  Do not save every unfamiliar word. Selectivity improves both motivation and retention.
                </p>
                <p>
                  Do not strip the word away from the sentence completely. Keeping some context makes memory richer and
                  later recall easier.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">FAQ: remembering looked-up words</h2>
              <div className="space-y-5">
                {FORGETTING_FAQS.map((item) => (
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
                For the broader system, read our guide on{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to expand your vocabulary
                </a>
                . To improve retention, also see{" "}
                <a href="/how-to-memorize-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to memorize vocabulary
                </a>{" "}
                and{" "}
                <a href="/how-to-learn-vocabulary-in-context" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to learn vocabulary in context
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Sources and further reading</h2>
              <p className="mb-4 text-[#666]">
                This article is grounded in research on contextualized vocabulary learning, reading-based vocabulary
                growth, and retrieval practice.
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
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Turn looked-up words into remembered words</h2>
              <p className="mb-4 text-[#666]">
                A good system makes it easier to capture useful vocabulary from reading, review it later, and revisit
                weak words before they disappear. Explore the full workflow on the{" "}
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
                Start free and save your next word
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
