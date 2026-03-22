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
    number: "01",
    phase: "Step 1",
    title: "Capture",
    description: "Add a word to your chapter.",
    cue: "Word saved",
    progress: 24,
    icon: "capture",
  },
  {
    number: "02",
    phase: "Step 2",
    title: "Recognize",
    description: "Review meaning with flashcards.",
    cue: "Recall started",
    progress: 52,
    icon: "recognize",
  },
  {
    number: "03",
    phase: "Step 3",
    title: "Produce",
    description: "Type the word from memory.",
    cue: "Spelling locked",
    progress: 78,
    icon: "produce",
  },
  {
    number: "04",
    phase: "Step 4",
    title: "Retain",
    description: "Revisit mistakes until mastered.",
    cue: "Mastery reached",
    progress: 100,
    icon: "retain",
  },
];

function MasteryIcon({ icon }) {
  switch (icon) {
    case "capture":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 5.5h7.5l3.5 3.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V7a1.5 1.5 0 0 1 1-1.4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 5.5V9H18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 10v5M9.5 12.5h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "recognize":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="5"
            y="7"
            width="10"
            height="7"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M8 10.5h4M8 12.5h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M13.5 16.5c2.7 0 4.8-1.2 5.9-3.1c-1.1-1.9-3.2-3.1-5.9-3.1s-4.8 1.2-5.9 3.1c1.1 1.9 3.2 3.1 5.9 3.1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13.5" cy="13.4" r="1.4" fill="currentColor" />
        </svg>
      );
    case "produce":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="4.5"
            y="7"
            width="15"
            height="10"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M7.5 10.5h.01M10 10.5h.01M12.5 10.5h.01M15 10.5h.01M8.5 13.5h7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="m15.5 5.5 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "retain":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 4.5 18 7v4.4c0 3.5-2.2 6.6-6 8.1c-3.8-1.5-6-4.6-6-8.1V7l6-2.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m9.3 12.3 1.8 1.9 3.6-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

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
            <span className="landingV2MasteryLead">
              Move from first capture to long-term recall with one clear sequence.
            </span>
          </div>

          <ol className="landingV2MasteryFlow">
            {MASTERY_FLOW.map((item, index) => (
              <li key={item.phase} className="landingV2MasteryStep">
                <article className="landingV2MasteryCard">
                  <div className="landingV2MasteryCardTop">
                    <span className="landingV2MasteryIndex">{item.phase}</span>
                    <strong className="landingV2MasteryCount">{item.number}</strong>
                  </div>
                  <div className="landingV2MasteryIconWrap" aria-hidden="true">
                    <span className="landingV2MasteryIcon">
                      <MasteryIcon icon={item.icon} />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="landingV2MasteryFooter">
                    <span className="landingV2MasteryCue">{item.cue}</span>
                    <div className="landingV2MasteryMeter" aria-hidden="true">
                      <span style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </article>
                {index < MASTERY_FLOW.length - 1 ? (
                  <span className="landingV2MasteryConnector" aria-hidden="true">
                    <svg viewBox="0 0 64 16" focusable="false">
                      <path
                        d="M2 8h56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <path
                        d="m52 3 8 5-8 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : null}
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
