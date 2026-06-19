import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs.jsx";
import { PublicSiteHeader } from "../components/PublicSiteHeader.jsx";
import { getBreadcrumbItems } from "../config/breadcrumbs.js";

const serif = { fontFamily: '"Lora", Georgia, "Times New Roman", serif' };
const BREADCRUMB_ITEMS = getBreadcrumbItems("words-per-day");

const DAILY_STEPS = [
  {
    title: "1. Choose a pace you can repeat",
    body:
      "The best daily target is not the biggest number you can survive once. It is the number you can keep reviewing well across weeks. For many learners, 5 to 15 words per day is a solid range.",
  },
  {
    title: "2. Match the target to review capacity",
    body:
      "New words create future review work. If you add too many too quickly, your review pile grows faster than your memory can handle. A good pace leaves room for both learning and revisiting.",
  },
  {
    title: "3. Adjust based on difficulty and time",
    body:
      "Easier, high-frequency words can often be learned faster. Technical vocabulary, subtle synonyms, or words with unfamiliar usage usually require a lighter daily load.",
  },
  {
    title: "4. Measure retention, not just volume",
    body:
      "If your daily word count keeps rising but recall stays weak, the pace is too high. A smaller number remembered well is more valuable than a larger number forgotten quickly.",
  },
];

const DAILY_PLAN = [
  "Beginner or busy schedule: 5 useful words per day with strong review.",
  "Moderate pace: 8 to 12 words per day if you can still revisit older words properly.",
  "Higher pace: 15 words per day only if your review system is strong and recall remains stable.",
  "If accuracy starts dropping: reduce new words temporarily and put more time into review.",
];

const RESEARCH_SOURCES = [
  {
    title: "McKeown (2019), Effective Vocabulary Instruction Fosters Knowing Words, Using Words, and Understanding How Words Work",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8753997/",
  },
  {
    title: "Karpicke and Blunt (2011), Retrieval practice produces more learning than elaborative studying with concept mapping",
    href: "https://doi.org/10.1126/science.1199327",
  },
  {
    title: "Godwin-Jones (2018), Contextualized vocabulary learning",
    href: "https://doi.org/10.64152/10125/44651",
  },
];

const DAILY_FAQS = [
  {
    question: "How many vocabulary words should I learn per day?",
    answer:
      "For many learners, 5 to 15 new words per day is a realistic target. The best number depends on how much time you have for review and how difficult the words are.",
  },
  {
    question: "Is learning 20 words a day too much?",
    answer:
      "It can be too much if you do not have enough time to review them properly. High volume only helps when retention stays strong.",
  },
  {
    question: "What matters more, daily word count or review quality?",
    answer:
      "Review quality matters more. A smaller number of words that you can recall and use is better than a large number you quickly forget.",
  },
];

export function WordsPerDayPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <PublicSiteHeader />

      <main>
        <section className="px-4 py-16">
          <article className="mx-auto max-w-4xl">
            <GuideBreadcrumbs items={BREADCRUMB_ITEMS} />
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999]">Daily Study Guide</p>
            <h1 className="mb-6 text-[36px] font-bold leading-[1.1] tracking-tight text-[#111] md:text-[48px]" style={serif}>How many words should you learn per day?</h1>
            <p className="mb-8 text-lg text-[#666]">
              Most learners do better with a realistic pace than an ambitious one. A good daily target leaves enough
              time to review old words properly, not just collect new ones. The best number is not universal. It
              depends on your time, your review system, the difficulty of the words, and whether you can still
              remember and use what you learned a few days later.
            </p>
            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Quick answer</h2>
              <p className="text-[#666]">
                A useful target for many learners is 5 to 15 words per day. The right number depends on your time,
                the difficulty of the words, and whether you can still review them well over the next few days.
              </p>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Why bigger daily targets can backfire</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  A high daily word count can feel ambitious and productive, but it often hides a problem. Every new
                  word you add today becomes future review work. If your review load grows faster than your time and
                  attention can handle, retention drops.
                </p>
                <p>
                  This is why the right daily target is not just about input. It is about maintenance. Learning ten
                  words well is more useful than collecting twenty-five words you cannot remember a week later.
                </p>
                <p>
                  Strong vocabulary growth usually looks steady rather than dramatic. It favors pace you can maintain
                  over bursts of intensity that collapse after a few days.
                </p>
              </div>
            </section>

            <section className="mb-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">What should shape your daily target</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Time matters. If you only have a short study block, a smaller target gives you more room to review
                  properly instead of rushing through unfamiliar words.
                </p>
                <p>
                  Difficulty matters too. Concrete, high-frequency words are often easier to learn than abstract,
                  technical, or highly nuanced vocabulary. Harder words usually require a lighter daily load.
                </p>
                <p>
                  Review quality matters most. If your recall is strong and you are still revisiting older words
                  consistently, your pace may be fine. If accuracy is dropping, your daily target is probably too high.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {DAILY_STEPS.map((step) => (
                <section key={step.title} className="rounded-[10px] border border-[#e5e1db] bg-white p-7">
                  <h2 className="mb-2 text-[18px] font-semibold text-[#111]">{step.title}</h2>
                  <p className="text-[#666]">{step.body}</p>
                </section>
              ))}
            </div>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">A realistic way to set your daily pace</h2>
              <p className="mb-4 text-[#666]">
                If you are unsure where to start, use a conservative target first and increase only when recall stays
                strong. A framework like this is usually more useful than chasing a fixed number.
              </p>
              <ul className="space-y-2 text-[#666]">
                {DAILY_PLAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">How to tell if your target is working</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  A good daily target leaves you challenged, but not buried. You should be able to review older words
                  without feeling that the backlog is getting out of control.
                </p>
                <p>
                  It should also leave room for use. If your schedule is so crowded with new words that you never test
                  yourself or write your own examples, the pace is too high.
                </p>
                <p>
                  The clearest signal is retention. If you can still recall and use a meaningful portion of your new
                  vocabulary after several days, the target is probably sustainable.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Common mistakes when setting a daily word goal</h2>
              <div className="space-y-4 text-[#666]">
                <p>
                  Do not choose your target based on motivation alone. It is easy to overestimate what feels possible
                  on a good day and underestimate the review load that follows.
                </p>
                <p>
                  Do not compare your number with someone else&apos;s without considering context. Different learners
                  have different schedules, word difficulty, and levels of prior knowledge.
                </p>
                <p>
                  Do not judge success only by how many words you added. Judge it by recall, comprehension, and
                  whether those words are becoming usable.
                </p>
              </div>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-[#faf8f5] p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">FAQ: daily word targets</h2>
              <div className="space-y-5">
                {DAILY_FAQS.map((item) => (
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
                For the full system, read{" "}
                <a href="/how-to-expand-your-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  how to expand your vocabulary
                </a>
                , and for review strategy read{" "}
                <a href="/spaced-repetition-for-vocabulary" className="font-medium text-[#111] no-underline underline-offset-2 hover:underline">
                  spaced repetition for vocabulary
                </a>
                .
              </p>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Sources and further reading</h2>
              <p className="mb-4 text-[#666]">
                This article is informed by sources on effective vocabulary instruction, retrieval practice, and
                contextual learning. The exact daily number varies by learner, but the core principle is stable:
                sustainable review matters more than raw volume.
              </p>
              <ul className="space-y-3 text-[#666]">
                {RESEARCH_SOURCES.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      className="font-medium text-[#111] no-underline underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-[10px] border border-[#e5e1db] bg-white p-7">
              <h2 className="mb-3 text-[18px] font-semibold text-[#111]">Set a pace you can actually keep</h2>
              <p className="mb-4 text-[#666]">
                Daily vocabulary growth becomes much easier when your review system is organized and your weak words
                are easy to revisit. Explore the full workflow on the{" "}
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
                Start free and build a steady routine
              </a>
            </section>
          </article>
        </section>
      </main>
    </div>
  );
}
