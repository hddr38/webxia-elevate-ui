import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background/40 p-0.5 text-xs font-medium backdrop-blur-md">
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            locale === l ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Switch to ${l.toUpperCase()}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="rounded-full">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2">
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
        <span className="font-display text-sm font-black tracking-tighter">W</span>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand shadow-[0_0_12px_var(--brand)]" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight">
        WebXIA<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

const navItems = [
  { key: "nav.services", to: "/services" },
  { key: "nav.work", to: "/work" },
  { key: "nav.about", to: "/about" },
  { key: "nav.journal", to: "/journal" },
  { key: "nav.contact", to: "/contact" },
] as const;

export function Header() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-full border border-border bg-background/60 px-4 py-2.5 backdrop-blur-xl shadow-[0_8px_30px_-12px_color-mix(in_oklab,var(--foreground)_15%,transparent)]">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-secondary hover:text-foreground" }}
                className="rounded-full px-3 py-1.5 text-sm transition-colors"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LocaleSwitcher />
            <ThemeToggle />
            <Button variant="brand" size="sm" asChild>
              <Link to="/contact">
                {t("cta.book")} <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] sm:w-96">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="mt-10 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.key}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-4 py-3 text-2xl font-display font-semibold tracking-tight text-foreground transition-colors hover:bg-secondary"
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <LocaleSwitcher />
                  <Button variant="brand" size="sm" asChild>
                    <Link to="/contact" onClick={() => setOpen(false)}>
                      {t("cta.book")}
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
