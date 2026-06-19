import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const BREADCRUMB_ITEMS = getBreadcrumbItems("guides");

const GUIDE_CARDS = [
  {
    title: "How to remember vocabulary from books",
    description:
      "Learn how to keep useful words from books by saving them in context, reviewing them with recall, and revisiting weak words.",
    href: "/how-to-remember-vocabulary-from-books",
  },
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
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        <section className="border-b border-[#ece8e1] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1180px] text-center">
            <GuideBreadcrumbs items={BREADCRUMB_ITEMS} />
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">
              Learning guides
            </p>
            <h1
              className="mx-auto mb-5 max-w-3xl text-[42px] leading-[1.06] tracking-tight text-[#111] sm:text-[54px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Vocabulary guides and study strategies
            </h1>
            <p className="mx-auto max-w-2xl text-[17px] leading-relaxed text-[#666]">
              Practical guides on how to improve vocabulary, memorize words, learn in context, and build a study
              routine that actually lasts.
            </p>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {GUIDE_CARDS.map((guide) => (
                <article
                  key={guide.href}
                  className="rounded-[10px] border border-[#e5e1db] bg-white p-7"
                >
                  <h2 className="mb-3 text-[17px] font-semibold leading-[1.3] text-[#111]">{guide.title}</h2>
                  <p className="mb-5 text-[14px] leading-[1.75] text-[#666]">{guide.description}</p>
                  <a
                    href={guide.href}
                    className="text-[13px] font-semibold text-[#111] no-underline underline-offset-2 hover:underline"
                  >
                    Read guide →
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
