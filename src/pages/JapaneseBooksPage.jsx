import { ArrowRight, BookOpen } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };

const JAPANESE_FEATURES = [
  {
    emoji: "🔀",
    title: "Choose the learning direction",
    description:
      "Set a book to English-to-Japanese or Japanese-to-English so each vocabulary list stays focused.",
  },
  {
    emoji: "🔍",
    title: "Look up Japanese vocabulary",
    description:
      "Save kanji, kana, and meanings while keeping words attached to the book or chapter where you found them.",
  },
  {
    emoji: "🧠",
    title: "Review with active recall",
    description:
      "Practice Japanese vocabulary with flashcards, quizzes, typing review, and spaced repetition.",
  },
];

const SAMPLE_WORDS = [
  ["物語", "story"],
  ["記憶", "memory"],
  ["言葉", "word"],
  ["復習", "review"],
];

export function JapaneseBooksPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-[#ece8e1] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid w-full max-w-[1180px] gap-12 md:grid-cols-[1fr_1.05fr] md:items-center">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">Japanese Books</p>
              <h1
                className="mb-5 text-[42px] leading-[1.06] tracking-tight text-[#111] sm:text-[54px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                Learn Japanese vocabulary from the books you read.
              </h1>
              <p className="mb-8 max-w-[600px] text-[17px] leading-relaxed text-[#666]">
                Vocalibry supports Japanese learning books so you can save useful kanji and kana vocabulary, review
                translations, and keep every word connected to real reading.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/register"
                  className="inline-flex h-[50px] items-center gap-2 rounded-[10px] bg-[#111] px-8 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/features"
                  className="inline-flex h-[50px] items-center rounded-[10px] border border-[#dbd8d2] bg-white px-8 text-[15px] font-medium text-[#333] no-underline transition-colors hover:bg-[#f5f3f0]"
                >
                  See all features
                </a>
              </div>
            </div>

            {/* Word card preview */}
            <div className="overflow-hidden rounded-[10px] border border-[#e5e1db] bg-white p-6 shadow-[0_12px_48px_rgba(0,0,0,0.07)]">
              <div className="mb-5 flex items-center justify-between border-b border-[#e5e1db] pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#999]">Japanese to English</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[#111]">Japanese novel vocabulary</h2>
                </div>
                <BookOpen className="h-5 w-5 text-[#bbb]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SAMPLE_WORDS.map(([word, meaning]) => (
                  <div key={word} className="rounded-[8px] border border-[#e5e1db] bg-[#faf8f5] p-5">
                    <span className="mb-2 block text-[30px] font-semibold leading-none text-[#111]">{word}</span>
                    <span className="text-[14px] text-[#666]">{meaning}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[8px] border border-[#e5e1db] bg-white p-4">
                <p className="text-[13px] font-medium text-[#111]">Next review: 12 Japanese words due today</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features strip */}
        <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1180px]">
            <div className="mb-10 text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">How it fits</p>
              <h2
                className="text-[30px] tracking-tight text-[#111] sm:text-[38px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                A Japanese feature, not a different app
              </h2>
              <p className="mx-auto mt-4 max-w-[700px] text-[16px] leading-relaxed text-[#666]">
                The same book-based workflow still applies: save words from real reading, review them with recall, and
                revisit weak vocabulary before it fades.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {JAPANESE_FEATURES.map((f) => (
                <article key={f.title} className="rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
                  <div className="mb-4 text-[26px] leading-none">{f.emoji}</div>
                  <h3 className="mb-2 text-[15px] font-semibold text-[#111]">{f.title}</h3>
                  <p className="text-[14px] leading-[1.75] text-[#666]">{f.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-[#ece8e1] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[780px]">
            <div className="rounded-[10px] border border-[#e5e1db] bg-white p-8 md:p-10">
              <p className="mb-3 text-[36px] leading-none">🗾</p>
              <h2
                className="mb-3 text-[24px] leading-[1.2] tracking-tight text-[#111]"
                style={{ ...serif, fontWeight: 700 }}
              >
                Use it for manga, novels, textbooks, or reading notes
              </h2>
              <p className="mb-6 text-[15px] leading-[1.75] text-[#666]">
                Make a separate Japanese book, add chapters for units or volumes, and keep your Japanese vocabulary
                practice separate from your English reading lists.
              </p>
              <a
                href="/register"
                className="inline-flex h-[46px] items-center rounded-[10px] bg-[#111] px-7 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
              >
                Create your first Japanese book
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
