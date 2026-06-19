import { useEffect } from "react";

export function PublicSiteHeader() {
  useEffect(() => {
    const link = Object.assign(document.createElement("link"), {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;0,700;1,600;1,700&display=swap",
    });
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="relative flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2 no-underline">
            <img src="/vocab-logo-black.png" alt="" aria-hidden="true" className="h-7 w-auto rounded-[6px]" />
            <span className="text-[17px] font-semibold text-foreground">Vocalibry</span>
          </a>
          <nav className="hidden items-center gap-8 md:absolute md:left-1/2 md:flex md:-translate-x-1/2">
            <a href="/guides" className="text-[15px] text-foreground no-underline transition-colors hover:text-primary">
              Guides
            </a>
            <a href="/features" className="text-[15px] text-foreground no-underline transition-colors hover:text-primary">
              Features
            </a>
            <a href="/learn-japanese-from-books" className="text-[15px] text-foreground no-underline transition-colors hover:text-primary">
              Japanese
            </a>
            <a href="/pricing" className="text-[15px] text-foreground no-underline transition-colors hover:text-primary">
              Pricing
            </a>
            <a href="/contact" className="text-[15px] text-foreground no-underline transition-colors hover:text-primary">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-[15px] font-medium text-foreground no-underline transition-colors hover:text-primary">
              Log in
            </a>
            <a
              href="/register"
              className="rounded-[10px] bg-[#111] px-5 py-2 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2d2d2d]"
            >
              Start free
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
