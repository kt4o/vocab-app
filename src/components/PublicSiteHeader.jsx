import { FOUNDING_MEMBER_DEADLINE_LABEL } from "../config/launchOffer.js";

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="border-b border-[#d9e6ff] bg-[#eef4ff] px-4 py-2">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 text-[13px] text-foreground">
          <p>
            Founding Member launch: create your account by {FOUNDING_MEMBER_DEADLINE_LABEL} and unlock Pro for life.
          </p>
          <a href="/register" className="font-medium text-primary no-underline hover:underline">
            Claim offer
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2 no-underline">
            <img src="/favicon.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold text-foreground">Vocalibry</span>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="/guides" className="text-foreground no-underline transition-colors hover:text-primary">
              Guides
            </a>
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
              Claim lifetime Pro
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
