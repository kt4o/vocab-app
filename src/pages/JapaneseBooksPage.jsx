import { ArrowRight, BookOpen, Brain, Languages, Search, Sparkles } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const JAPANESE_FEATURES = [
  {
    icon: Languages,
    title: "Choose the learning direction",
    description:
      "Set a book to English-to-Japanese or Japanese-to-English so each vocabulary list stays focused.",
  },
  {
    icon: Search,
    title: "Look up Japanese vocabulary",
    description:
      "Save kanji, kana, and meanings while keeping words attached to the book or chapter where you found them.",
  },
  {
    icon: Brain,
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
    <div className="min-h-screen bg-[#f5f7fb]">
      <PublicSiteHeader />

      <main>
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid w-full max-w-[1180px] gap-10 md:grid-cols-[1fr_1.05fr] md:items-center">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6F92E8]">Japanese Books</p>
              <h1 className="mb-5 text-[42px] font-bold leading-[1.06] text-foreground sm:text-[54px]">
                Learn Japanese vocabulary from the books you read.
              </h1>
              <p className="mb-7 max-w-[680px] text-[17px] leading-relaxed text-muted-foreground">
                Vocalibry now supports Japanese learning books, so you can save useful kanji and kana vocabulary, review translations, and keep every word connected to real reading.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#8FB0FF] px-6 text-[15px] font-medium text-white no-underline transition-colors hover:bg-[#6F92E8]"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/features"
                  className="inline-flex h-11 items-center rounded-lg border border-border bg-white px-6 text-[15px] font-medium text-foreground no-underline transition-colors hover:bg-[#F6F9FF]"
                >
                  See all features
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-white p-5 shadow-[0_24px_60px_rgba(16,24,40,0.14)]">
              <div className="mb-5 flex items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <p className="text-[13px] font-semibold text-[#6F92E8]">Japanese to English</p>
                  <h2 className="text-[22px] font-semibold text-foreground">Japanese novel vocabulary</h2>
                </div>
                <BookOpen className="h-6 w-6 text-[#6F92E8]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SAMPLE_WORDS.map(([word, meaning]) => (
                  <div key={word} className="rounded-lg border border-border/40 bg-[#f8fafe] p-5">
                    <span className="mb-2 block text-[30px] font-semibold leading-none text-foreground">{word}</span>
                    <span className="text-[15px] text-muted-foreground">{meaning}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-[#eef4ff] p-4">
                <p className="text-[14px] font-medium text-[#4f6fb8]">Next review: 12 Japanese words due today</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto w-full max-w-[1180px]">
            <div className="mb-10 text-center">
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6F92E8]">How It Fits</p>
              <h2 className="text-[30px] font-bold text-foreground sm:text-[38px]">A Japanese feature, not a different app</h2>
              <p className="mx-auto mt-4 max-w-[760px] text-[16px] leading-relaxed text-muted-foreground">
                The same book-based workflow still applies: save words from real reading, review them with recall, and revisit weak vocabulary before it fades.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {JAPANESE_FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-lg border border-border/40 bg-white p-7">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#e8eefc]">
                    <feature.icon className="h-6 w-6 text-[#6F92E8]" />
                  </div>
                  <h3 className="mb-2 text-[18px] font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/40 px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto grid w-full max-w-[1040px] gap-8 rounded-lg border border-border/40 bg-white p-8 md:grid-cols-[0.8fr_1fr] md:items-center md:p-10">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-lg bg-[#dff6ec]">
              <Sparkles className="h-8 w-8 text-[#157347]" />
            </div>
            <div>
              <h2 className="mb-3 text-[28px] font-bold text-foreground">Use it for manga, novels, textbooks, or reading notes</h2>
              <p className="mb-5 text-[16px] leading-relaxed text-muted-foreground">
                Make a separate Japanese book, add chapters for units or volumes, and keep your Japanese vocabulary practice separate from your English reading lists.
              </p>
              <a href="/register" className="font-medium text-[#6F92E8] no-underline hover:text-[#5d81d6]">
                Create your first Japanese book
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
