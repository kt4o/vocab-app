import { useEffect, useState } from "react";

const YEAR = new Date().getFullYear();

const PARTNER_NAMES = [
  "Universities",
  "Language Schools",
  "Exam Prep Teams",
  "Private Tutors",
  "Book Clubs",
  "Study Communities",
  "Student Cohorts",
  "Self-Learners",
  "Educators",
];

const MASTERY_FLOW = [
  {
    phase: "Step 1",
    title: "Capture",
    description: "Add a word to your chapter.",
    cue: "Word saved",
    progress: 24,
  },
  {
    phase: "Step 2",
    title: "Recognize",
    description: "Review meaning with flashcards.",
    cue: "Recall started",
    progress: 52,
  },
  {
    phase: "Step 3",
    title: "Produce",
    description: "Type the word from memory.",
    cue: "Spelling locked",
    progress: 78,
  },
  {
    phase: "Step 4",
    title: "Retain",
    description: "Revisit mistakes until mastered.",
    cue: "Mastery reached",
    progress: 100,
  },
];

export function LandingPage() {
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);

  useEffect(() => {
    document.title = "Vocalibry | Learn Vocabulary";
  }, []);

  return (
    <div className="publicPage publicLanding landingV2 landingV2Notion">
      {isAnnouncementVisible ? (
        <div className="landingV2NotionAnnouncement">
          <div className="landingV2NotionAnnouncementInner">
            <span className="landingV2NotionBadge">New</span>
            <p>Vocalibry Chapter Planner is live: organize word lists by book and unit in seconds.</p>
            <a href="/register">See what&apos;s new &rarr;</a>
          </div>
          <button
            type="button"
            className="landingV2NotionAnnounceClose"
            aria-label="Dismiss banner"
            onClick={() => setIsAnnouncementVisible(false)}
          >
            &times;
          </button>
        </div>
      ) : null}

      <header className="publicHeader landingV2NotionHeader">
        <a className="publicLogo landingV2NotionLogo" href="/">
          <svg
            className="landingV2NotionLogoMark"
            viewBox="8 14 174 102"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="landingHeaderLogoGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--landing-accent-strong)" />
                <stop offset="55%" stopColor="var(--landing-accent)" />
                <stop offset="100%" stopColor="#bfd0ff" />
              </linearGradient>
            </defs>
            <path d="M22 36h20l31 69h-20z" fill="url(#landingHeaderLogoGradient)" />
            <path
              d="M74 106h68c4.3 0 8.1-2.8 9.4-6.9l20-63c2-6.4-2.7-13.1-9.4-13.1H91z"
              fill="url(#landingHeaderLogoGradient)"
            />
          </svg>
          <span>Vocalibry</span>
        </a>
        <nav className="publicNav landingV2NotionNav" aria-label="Public pages">
          <a href="/register">Get Started</a>
          <a href="/pricing">Pricing</a>
          <a href="/contact">Contact</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/disclaimer">Disclaimer</a>
        </nav>
        <div className="landingV2NotionActions">
          <a href="/login">Log in</a>
          <a className="publicHeaderCta" href="/register">
            Start for free
          </a>
        </div>
      </header>

      <main className="landingV2NotionMain">
        <section className="landingV2NotionHero">
          <div className="landingV2NotionHeroCopy">
            <h1>Turn new words into permanent memory.</h1>
            <p>
              Organize definitions, practice with flashcards and quizzes, and fix forgetting with
              targeted review.
            </p>
            <div className="heroActions landingV2NotionHeroActions">
              <a className="publicPrimaryBtn" href="/register">
                Get Vocalibry free
              </a>
            </div>
          </div>

          <div className="landingV2NotionPreview" aria-label="Product preview">
            <img
              src="/landing/book-page.png"
              alt="Vocalibry chapter planner screenshot"
              width="1896"
              height="1078"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </section>

        <section className="landingV2NotionPartners" aria-label="Trusted by teams">
          {PARTNER_NAMES.map((name, index) => (
            <span key={name}>
              {name}
              {index < PARTNER_NAMES.length - 1 ? <em aria-hidden="true">&bull;</em> : null}
            </span>
          ))}
        </section>

        <section className="landingV2Mastery" aria-label="How mastering a word works">
          <div className="landingV2MasteryHead">
            <p>Mastery flow</p>
            <h2>Master a word in four clear steps</h2>
          </div>

          <ol className="landingV2MasteryFlow">
            {MASTERY_FLOW.map((item, index) => (
              <li key={item.phase} className="landingV2MasteryStep">
                <span className="landingV2MasteryStepDot" aria-hidden="true" />
                {index < MASTERY_FLOW.length - 1 ? (
                  <span className="landingV2MasteryStepLine" aria-hidden="true" />
                ) : null}

                <article className="landingV2MasteryCard">
                  <div className="landingV2MasteryCardTop">
                    <span className="landingV2MasteryIndex">{item.phase}</span>
                    <span className="landingV2MasteryCue">{item.cue}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="landingV2MasteryMeter" aria-hidden="true">
                    <span style={{ width: `${item.progress}%` }} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="publicFooter">
        <p>(c) {YEAR} Vocalibry. All rights reserved.</p>
        <div className="publicFooterLinks">
          <a href="/pricing">Pricing</a>
          <a href="/terms">Terms & Conditions</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/disclaimer">Disclaimer</a>
          <a href="/contact">Contact</a>
        </div>
      </footer>
    </div>
  );
}
