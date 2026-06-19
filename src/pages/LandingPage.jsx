import { useEffect } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";

const appScreenshot = "/landing/book-page.png";
const YEAR = new Date().getFullYear();

// serif style applied to display headings
const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };

const PRINCIPLES = [
  {
    emoji: "🧠",
    title: "Active recall",
    body: "Producing a word from memory — not just recognizing it — is what turns short-term exposure into long-term knowledge.",
  },
  {
    emoji: "⏱️",
    title: "Spaced review",
    body: "Returning to a word just before you'd forget it is far more effective than daily drilling or never coming back at all.",
  },
  {
    emoji: "📖",
    title: "Context",
    body: "Words learned in isolation fade quickly. Keeping a word tied to the sentence or book where you found it anchors the meaning.",
  },
];

const FEATURES = [
  {
    emoji: "📚",
    title: "Organized by source",
    body: "Keep vocabulary grouped by the book, manga, lesson, or podcast where you found each word. Context is part of what makes a meaning retrievable later.",
  },
  {
    emoji: "✍️",
    title: "Flashcards and typed quizzes",
    body: "Practice producing the translation before the answer appears. Typing is harder than clicking — and that difficulty is exactly the point.",
  },
  {
    emoji: "🔂",
    title: "Smart review timing",
    body: "Your review queue resurfaces words just before you'd forget them, so every session is efficient and nothing gets permanently buried.",
  },
  {
    emoji: "↔️",
    title: "Both directions",
    body: "Study target-to-English and English-to-target. Recognizing a word and being able to produce it from English are two very different skills.",
  },
  {
    emoji: "📈",
    title: "Visible progress",
    body: "Streaks, quiz history, and word counts give you a concrete record of your study. Progress you can see is progress that keeps you returning.",
  },
  {
    emoji: "🇯🇵",
    title: "Designed for Japanese",
    body: "Kanji, kana, romaji, and English meanings in one card, reviewable in both directions. Built around how Japanese vocabulary actually works.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Save words as you find them",
    body: "When you look up a word while reading, watching, or studying, add it to your list. Attach the English meaning, a reading, or an example sentence.",
    href: "/register",
    label: "Create a free account",
  },
  {
    n: "02",
    title: "Review with active recall",
    body: "Practice each word with flashcards or typed quizzes. The app prioritizes words you've missed most recently so every session is high signal.",
    href: "/features",
    label: "See the study modes",
  },
  {
    n: "03",
    title: "Build vocabulary that holds",
    body: "Words you retrieve from memory — not just recognize — move into long-term storage. You stop re-looking up the same words and start knowing them.",
    href: "/register",
    label: "Start learning now",
  },
];

const TESTIMONIALS = [
  {
    quote: "I used to look up the same kanji four times and still forget it. Now I actually remember words because I review them at the right moment.",
    name: "Sarah K.",
    context: "Japanese learner, two years in",
  },
  {
    quote: "The English-to-Japanese direction is what I was missing. Recognizing a word and being able to produce it from English are completely different skills.",
    name: "Marcus T.",
    context: "Preparing for JLPT N3",
  },
  {
    quote: "My words stay tied to the book I'm reading, which makes meanings feel real and grounded. Context really is everything.",
    name: "Yuki N.",
    context: "Learning Japanese through manga",
  },
];

const FREE_PLAN = [
  { ok: true,  text: "Up to 100 saved words" },
  { ok: true,  text: "Flashcards and typed quizzes" },
  { ok: true,  text: "Smart Review queue" },
  { ok: true,  text: "Word tracking by book and chapter" },
  { ok: false, text: "Ad-free experience" },
  { ok: false, text: "Unlimited saved words" },
];

const PRO_PLAN = [
  "Unlimited saved words",
  "Flashcards and typed quizzes",
  "Smart Review queue",
  "Word tracking by book and chapter",
  "Ad-free experience",
];

const FAQ = [
  {
    q: "Who is Vocalibry for?",
    a: "English-speaking language learners who want a disciplined, low-friction way to review vocabulary from real input — books, manga, videos, lessons, or class notes.",
  },
  {
    q: "How is this different from Anki?",
    a: "Anki is powerful but requires significant setup and ongoing deck management. Vocalibry is focused: save a word, review it, move on. No configuration, no card design — just the practice loop.",
  },
  {
    q: "Which languages can I study?",
    a: "The app supports English vocabulary books and Japanese-English study books with full kanji, kana, reading, and romaji support. It is best suited for English speakers learning Japanese.",
  },
  {
    q: "Is the free plan genuinely useful?",
    a: "Yes. Every study feature — flashcards, typed quizzes, Smart Review — is included in the free plan for up to 100 saved words. Most beginners won't exceed that limit for several months.",
  },
  {
    q: "Can I review English to Japanese as well?",
    a: "Yes. You can practice Japanese-to-English (see the kanji, recall the English meaning) and English-to-Japanese (see the English, produce the Japanese). Both directions are available on every plan.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  useEffect(() => {
    const link = Object.assign(document.createElement("link"), {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600;1,700&display=swap",
    });
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <PublicSiteHeader />

      <main>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="border-b border-[#ece8e1] bg-[#faf8f5] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">
                Vocabulary practice for serious learners
              </p>
              <h1
                className="mb-7 text-[54px] leading-[1.06] text-[#111] sm:text-[68px] md:text-[86px]"
                style={{ ...serif, fontWeight: 700, letterSpacing: "-0.025em" }}
              >
                Learn words<br />
                <em>the way they stick.</em>
              </h1>
              <p className="mx-auto mb-10 max-w-[500px] text-[17px] leading-[1.75] text-[#555]">
                Save vocabulary from the language you're studying, review it with active recall, and let smart timing do the rest. Built around how memory actually works.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/register"
                  className="inline-flex h-[50px] items-center gap-2 rounded-[10px] bg-[#111] px-8 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex h-[50px] items-center rounded-[10px] border border-[#dbd8d2] bg-white px-8 text-[15px] font-medium text-[#333] no-underline transition-colors hover:bg-[#f5f3f0]"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-[12px] text-[#bbb]">Free plan available · No credit card required</p>
            </div>

            {/* screenshot */}
            <div className="mx-auto mt-20 max-w-[960px]">
              <div className="overflow-hidden rounded-[10px] border border-[#dbd8d2] shadow-[0_12px_48px_rgba(0,0,0,0.09),0_2px_8px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-1.5 border-b border-[#e5e1db] bg-[#f0ede9] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                  <span className="ml-3 font-['Inter'] text-[12px] text-[#aaa]">Vocalibry</span>
                </div>
                <img src={appScreenshot} alt="Vocalibry app" className="block w-full" loading="eager" />
              </div>
            </div>
          </div>
        </section>

        {/* ── THREE PRINCIPLES ─────────────────────────────────────────── */}
        <section className="bg-white px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1000px]">
            <p className="mb-12 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">
              Built on three principles of effective vocabulary learning
            </p>
            <div className="grid gap-10 sm:grid-cols-3">
              {PRINCIPLES.map(({ emoji, title, body }) => (
                <div key={title} className="border-l-2 border-[#e5e1db] pl-6">
                  <div className="mb-3 text-[26px] leading-none">{emoji}</div>
                  <h3 className="mb-2 text-[15px] font-semibold text-[#111]">{title}</h3>
                  <p className="text-[14px] leading-[1.75] text-[#666]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────────── */}
        <section id="features" className="border-y border-[#ece8e1] bg-[#faf8f5] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto mb-16 max-w-[500px] text-center">
              <h2
                className="mb-4 text-[30px] leading-[1.15] tracking-tight text-[#111] sm:text-[38px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                Everything you need for serious vocabulary practice
              </h2>
              <p className="text-[15px] leading-[1.75] text-[#666]">
                No deck management. No configuration. Save a word, review it, and let the system handle the rest.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ emoji, title, body }) => (
                <article
                  key={title}
                  className="rounded-[10px] border border-[#e5e1db] bg-white p-7"
                >
                  <div className="mb-4 text-[26px] leading-none">{emoji}</div>
                  <h3 className="mb-2 text-[15px] font-semibold text-[#111]">{title}</h3>
                  <p className="text-[14px] leading-[1.75] text-[#666]">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="bg-white px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-[1000px]">
            <div className="mx-auto mb-16 max-w-[460px] text-center">
              <h2
                className="mb-4 text-[30px] leading-[1.15] tracking-tight text-[#111] sm:text-[38px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                How it works
              </h2>
              <p className="text-[15px] leading-[1.75] text-[#666]">
                A simple, repeatable loop that moves vocabulary from "I looked it up" to "I actually know it."
              </p>
            </div>

            {/* steps — joined by a hairline border grid */}
            <div className="grid grid-cols-1 gap-px bg-[#e5e1db] sm:grid-cols-3">
              {STEPS.map(({ n, title, body, href, label }) => (
                <div key={n} className="bg-white p-8 sm:p-10">
                  <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#bbb]">
                    Step {n}
                  </div>
                  <h3 className="mb-3 text-[17px] font-semibold text-[#111]">{title}</h3>
                  <p className="mb-5 text-[14px] leading-[1.75] text-[#666]">{body}</p>
                  <a
                    href={href}
                    className="text-[13px] font-semibold text-[#111] no-underline underline-offset-2 hover:underline"
                  >
                    {label} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── JAPANESE SPOTLIGHT ───────────────────────────────────────── */}
        <section className="border-y border-[#ece8e1] bg-[#faf8f5] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-[1100px] items-center gap-14 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">
                Japanese study
              </p>
              <h2
                className="mb-5 text-[28px] leading-[1.15] tracking-tight text-[#111] sm:text-[36px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                Built for English speakers learning Japanese
              </h2>
              <p className="mb-7 text-[15px] leading-[1.75] text-[#666]">
                Save kanji and kana with readings, English meanings, and example sentences. Review Japanese-to-English or English-to-Japanese. Every card is designed around how Japanese vocabulary actually works.
              </p>
              <ul className="mb-8 space-y-3">
                {[
                  "Japanese → English recall",
                  "English → Japanese production",
                  "Kanji, kana, romaji, and readings",
                  "Words organized by book and chapter",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[14px] text-[#444]">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#111]" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/learn-japanese-from-books"
                className="inline-flex h-[46px] items-center gap-2 rounded-[10px] bg-[#111] px-6 text-[14px] font-semibold text-white no-underline hover:bg-[#2d2d2d]"
              >
                Explore Japanese books
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* mock UI */}
            <div className="overflow-hidden rounded-[10px] border border-[#dbd8d2] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-1.5 border-b border-[#e8e4de] bg-[#f0ede9] px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#d9d5cf]" />
                <span className="mx-auto text-[12px] text-[#aaa]">吾輩は猫である</span>
              </div>
              <div className="p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa]">
                      Japanese to English
                    </p>
                    <h3 className="mt-1 text-[20px] font-bold text-[#111]">吾輩は猫である</h3>
                  </div>
                  <span className="rounded-[6px] border border-[#e5e1db] bg-[#faf8f5] px-2.5 py-1 text-[11px] font-medium text-[#777]">
                    Chapter 1
                  </span>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-2.5">
                  {[
                    { k: "単語", r: "たんご", e: "word" },
                    { k: "記憶", r: "きおく", e: "memory" },
                    { k: "復習", r: "ふくしゅう", e: "review" },
                  ].map(({ k, r, e }) => (
                    <div key={k} className="rounded-[8px] border border-[#e8e4de] bg-[#faf8f5] p-3.5">
                      <div className="mb-1 text-[22px] font-bold leading-none text-[#111]">{k}</div>
                      <div className="mb-1 text-[10px] font-medium text-[#999]">{r}</div>
                      <div className="text-[12px] text-[#666]">{e}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[8px] bg-[#111] px-4 py-3 text-center text-[13px] font-semibold text-white">
                  Start Review Session
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
        <section className="bg-white px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-[1000px]">
            <h2
              className="mb-16 text-center text-[28px] leading-[1.15] tracking-tight text-[#111] sm:text-[36px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              From learners who made it stick
            </h2>
            <div className="grid gap-10 sm:grid-cols-3">
              {TESTIMONIALS.map(({ quote, name, context }) => (
                <figure key={name} className="border-t-2 border-[#111] pt-6">
                  <blockquote className="mb-6 text-[15px] leading-[1.8] text-[#333]">
                    "{quote}"
                  </blockquote>
                  <figcaption>
                    <div className="text-[13px] font-semibold text-[#111]">{name}</div>
                    <div className="mt-0.5 text-[13px] text-[#999]">{context}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────── */}
        <section id="pricing" className="border-y border-[#ece8e1] bg-[#faf8f5] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-[760px]">
            <div className="mb-14 text-center">
              <h2
                className="mb-3 text-[30px] leading-[1.15] tracking-tight text-[#111] sm:text-[38px]"
                style={{ ...serif, fontWeight: 700 }}
              >
                Simple pricing
              </h2>
              <p className="text-[15px] text-[#666]">
                Start free. Upgrade when you need more room to grow.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Free */}
              <div className="rounded-[12px] border border-[#e5e1db] bg-white p-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#bbb]">Free</p>
                <div className="mb-1 text-[52px] font-bold leading-none tracking-tight text-[#111]">A$0</div>
                <p className="mb-7 text-[13px] text-[#999]">Free forever</p>
                <a
                  href="/register"
                  className="mb-8 block rounded-[10px] border border-[#dbd8d2] py-3 text-center text-[14px] font-semibold text-[#111] no-underline transition-colors hover:bg-[#f5f3f0]"
                >
                  Start for free
                </a>
                <ul className="space-y-3.5">
                  {FREE_PLAN.map(({ ok, text }) => (
                    <li key={text} className="flex items-center gap-2.5">
                      {ok
                        ? <Check className="h-4 w-4 flex-shrink-0 text-[#111]" />
                        : <X className="h-4 w-4 flex-shrink-0 text-[#ccc]" />
                      }
                      <span className={`text-[14px] ${ok ? "text-[#333]" : "text-[#bbb]"}`}>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro */}
              <div className="rounded-[12px] border-2 border-[#111] bg-[#111] p-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#666]">Pro</p>
                <div className="mb-1 flex items-end gap-2">
                  <span className="text-[52px] font-bold leading-none tracking-tight text-white">A$6</span>
                  <span className="mb-1.5 text-[14px] text-[#666]">/ month</span>
                </div>
                <p className="mb-7 text-[13px] text-[#666]">Unlimited words, no ads</p>
                <a
                  href="/register"
                  className="mb-8 block rounded-[10px] bg-white py-3 text-center text-[14px] font-semibold text-[#111] no-underline transition-colors hover:bg-[#f0ede9]"
                >
                  Start Pro
                </a>
                <ul className="space-y-3.5">
                  {PRO_PLAN.map((text) => (
                    <li key={text} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 flex-shrink-0 text-white" />
                      <span className="text-[14px] text-[#aaa]">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="bg-white px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-[620px]">
            <h2
              className="mb-12 text-center text-[28px] leading-[1.15] tracking-tight text-[#111] sm:text-[36px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Questions
            </h2>
            <div className="divide-y divide-[#ece8e1]">
              {FAQ.map(({ q, a }) => (
                <article key={q} className="py-8">
                  <h3 className="mb-3 text-[15px] font-semibold text-[#111]">{q}</h3>
                  <p className="text-[14px] leading-[1.8] text-[#666]">{a}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────── */}
        <section className="border-t border-[#ece8e1] bg-[#faf8f5] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-[540px] text-center">
            <h2
              className="mb-5 text-[34px] leading-[1.1] tracking-tight text-[#111] sm:text-[48px]"
              style={{ ...serif, fontWeight: 700 }}
            >
              Start remembering<br />the words you find.
            </h2>
            <p className="mb-10 text-[16px] leading-[1.75] text-[#666]">
              Free plan available. No credit card required. Build the vocabulary habit that lasts.
            </p>
            <a
              href="/register"
              className="inline-flex h-[52px] items-center gap-2 rounded-[10px] bg-[#111] px-10 text-[16px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#ece8e1] bg-white px-4 py-14 sm:px-6 sm:py-16" id="contact">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-12 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <div className="mb-4 flex items-center gap-2">
                <img src="/vocab-logo-black.png" alt="" aria-hidden="true" className="h-6 w-auto rounded-[6px]" />
                <span className="text-[16px] font-semibold text-[#111]">Vocalibry</span>
              </div>
              <p className="text-[13px] leading-[1.75] text-[#888]">
                Save target-language words, review them in both directions, and remember more of what you study.
              </p>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Product</h4>
              <div className="space-y-3">
                {[
                  ["/features", "Features"],
                  ["/learn-japanese-from-books", "Japanese Books"],
                  ["/pricing", "Pricing"],
                  ["/guides", "All Guides"],
                  ["/contact", "Contact"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Guides</h4>
              <div className="space-y-3">
                {[
                  ["/how-to-expand-your-vocabulary", "Expand Your Vocabulary"],
                  ["/how-to-memorize-vocabulary", "Memorize Vocabulary"],
                  ["/how-to-learn-vocabulary-in-context", "Vocabulary in Context"],
                  ["/spaced-repetition-for-vocabulary", "Spaced Repetition"],
                  ["/how-many-words-should-you-learn-per-day", "Words Per Day"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bbb]">Legal</h4>
              <div className="space-y-3">
                {[
                  ["/terms", "Terms"],
                  ["/privacy", "Privacy"],
                  ["/disclaimer", "Disclaimer"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="block text-[14px] text-[#888] no-underline transition-colors hover:text-[#111]">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[#ece8e1] pt-8">
            <p className="text-center text-[12px] text-[#ccc]">&copy; {YEAR} Vocalibry. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
