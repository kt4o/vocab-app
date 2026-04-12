import { BookOpen, Brain, Trophy, Zap, Target, BarChart3 } from "lucide-react";

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
    icon: Trophy,
    title: "Social Motivation",
    description:
      "Compete in leaderboards, add friends, and turn daily practice into a measurable routine.",
  },
  {
    icon: Target,
    title: "Level-Appropriate Learning",
    description:
      "Build confidence in speaking, reading, and writing by practicing vocabulary matched to your current level.",
  },
];

export function FeaturesPage() {
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
                  <h2 className="mb-2 text-xl font-semibold text-foreground">{section.title}</h2>
                  <p className="text-muted-foreground">{section.description}</p>
                </article>
              ))}
            </div>

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
