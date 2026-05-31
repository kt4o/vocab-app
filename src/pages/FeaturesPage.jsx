import { BookOpen, Brain, Zap, Target, BarChart3, Languages } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const FEATURE_SECTIONS = [
  {
    icon: BookOpen,
    title: "Word Tracking and Organization",
    description:
      "Create books, group words by chapter, and keep your vocabulary aligned with school units, exams, or personal goals.",
  },
  {
    icon: Zap,
    title: "Flashcards and Quiz Modes",
    description:
      "Practice with flashcards, multiple-choice quizzes, typing quizzes, and mistake review to reinforce active recall.",
  },
  {
    icon: Brain,
    title: "Smart Review and Weak-Word Focus",
    description:
      "Prioritize words that need attention with smart review queues and focused sessions on mistakes.",
  },
  {
    icon: BarChart3,
    title: "Progress and Learning Analytics",
    description:
      "Track consistency, questions completed, and vocabulary growth over time to stay motivated.",
  },
  {
    icon: Target,
    title: "Level-Appropriate Learning",
    description:
      "Build confidence in speaking, reading, and writing by practicing vocabulary matched to your current level.",
  },
  {
    icon: Languages,
    title: "Japanese Books",
    description:
      "Use Japanese-to-English or English-to-Japanese books to save kanji, kana, and translations from real reading.",
    href: "/learn-japanese-from-books",
    label: "New",
  },
];

export function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicSiteHeader />

      <main>
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h1 className="mb-4 text-5xl font-bold text-foreground md:text-6xl">Features Built for Real Progress</h1>
              <p className="mx-auto max-w-3xl text-xl text-muted-foreground">
                Vocalibry combines organization, active recall, and smart review to help you remember vocabulary and
                use it confidently.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURE_SECTIONS.map((section) => (
                <article
                  key={section.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  {section.label ? (
                    <span className="mb-3 inline-flex rounded-full bg-[#dff6ec] px-3 py-1 text-xs font-semibold text-[#157347]">
                      {section.label}
                    </span>
                  ) : null}
                  <h2 className="mb-2 text-xl font-semibold text-foreground">{section.title}</h2>
                  <p className="text-muted-foreground">{section.description}</p>
                  {section.href ? (
                    <a href={section.href} className="mt-4 inline-flex font-medium text-primary no-underline hover:text-[#5d81d6]">
                      Learn more
                    </a>
                  ) : null}
                </article>
              ))}
            </div>

            <section className="mt-12 rounded-2xl border border-border bg-secondary p-8 text-center">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">Want the strategy behind the features?</h2>
              <p className="mx-auto mb-5 max-w-3xl text-muted-foreground">
                If you are trying to improve vocabulary, the tools work best when they are tied to a clear learning
                method. Read our research-backed guide on how to expand your vocabulary with contextual learning,
                retrieval practice, spaced repetition, and active use.
              </p>
              <a
                href="/how-to-expand-your-vocabulary"
                className="font-medium text-primary no-underline transition-colors hover:text-[#5d81d6]"
              >
                Read the vocabulary guide
              </a>
            </section>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/register"
                className="rounded-lg bg-primary px-8 py-3 font-medium text-white no-underline shadow-[0_4px_12px_rgba(29,79,143,0.25)] transition-colors hover:bg-[#5d81d6]"
              >
                Create Free Account
              </a>
              <a
                href="/pricing"
                className="rounded-lg border border-border bg-secondary px-8 py-3 font-medium text-foreground no-underline transition-colors hover:bg-muted"
              >
                Compare Plans
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
