export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background">
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
              Start for free
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
