import { ArrowRight } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };

const FEATURES = [
  {
    emoji: "📖",
    title: "Word Tracking and Organization",
    description:
      "Create books, group words by chapter, and keep your vocabulary aligned with exams, reading projects, or personal goals.",
  },
  {
    emoji: "⚡",
    title: "Flashcards and Quiz Modes",
    description:
      "Practice with flashcards, multiple-choice quizzes, typing quizzes, and mistake review to reinforce active recall.",
  },
  {
    emoji: "🧠",
    title: "Smart Review and Weak-Word Focus",
    description:
      "Prioritize words that need attention with smart review queues and focused sessions on mistakes.",
  },
  {
    emoji: "📊",
    title: "Progress and Learning Analytics",
    description:
      "Track consistency, questions completed, and vocabulary growth over time to stay motivated.",
  },
  {
    emoji: "🎯",
    title: "Level-Appropriate Learning",
    description:
      "Build confidence in speaking, reading, and writing by practicing vocabulary matched to your current level.",
  },
  {
    emoji: "🗾",
    title: "Japanese Books",
    description:
      "Use Japanese-to-English or English-to-Japanese books to save kanji, kana, and translations from real reading.",
    href: "/learn-japanese-from-books",
    label: "New",
  },
];

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        <section className="border-b border-[#ece8e1] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1180px] text-center">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">
              Everything you need
            </p>
            <h1
              className="mx-auto mb-5 max-w-3xl text-[42px] leading-[1.06] tracking-tight text-[#111] sm:text-[54px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Features built for real progress
            </h1>
            <p className="mx-auto max-w-2xl text-[17px] leading-relaxed text-[#666]">
              Vocalibry combines organization, active recall, and smart review to help you remember vocabulary and use
              it confidently.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="rounded-[10px] border border-[#e5e1db] bg-white p-7">
                  <div className="mb-4 text-[28px] leading-none">{f.emoji}</div>
                  {f.label ? (
                    <span className="mb-3 inline-flex rounded-full bg-[#f0ede9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#999]">
                      {f.label}
                    </span>
                  ) : null}
                  <h2 className="mb-2 text-[15px] font-semibold text-[#111]">{f.title}</h2>
                  <p className="text-[14px] leading-[1.75] text-[#666]">{f.description}</p>
                  {f.href ? (
                    <a href={f.href} className="mt-4 inline-flex text-[13px] font-semibold text-[#111] no-underline underline-offset-2 hover:underline">
                      Learn more →
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#ece8e1] bg-white px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-[780px] text-center">
            <h2
              className="mb-4 text-[26px] leading-[1.2] tracking-tight text-[#111] sm:text-[32px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Want the strategy behind the features?
            </h2>
            <p className="mb-6 text-[15px] leading-[1.75] text-[#666]">
              The tools work best when tied to a clear learning method. Read our research-backed guide on how to expand
              your vocabulary with contextual learning, retrieval practice, spaced repetition, and active use.
            </p>
            <a
              href="/how-to-expand-your-vocabulary"
              className="text-[14px] font-semibold text-[#111] no-underline underline-offset-2 hover:underline"
            >
              Read the vocabulary guide →
            </a>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-4">
            <a
              href="/register"
              className="inline-flex h-[50px] items-center gap-2 rounded-[10px] bg-[#111] px-8 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/pricing"
              className="inline-flex h-[50px] items-center rounded-[10px] border border-[#dbd8d2] bg-white px-8 text-[15px] font-medium text-[#333] no-underline transition-colors hover:bg-[#f5f3f0]"
            >
              Compare plans
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
