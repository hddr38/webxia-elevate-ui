import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/lib/locale-context";
import { useTheme } from "@/lib/theme-context";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background/40 p-0.5 text-xs font-medium backdrop-blur-md">
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`min-h-8 min-w-8 px-2.5 py-1.5 rounded-full transition-colors ${
            locale === l
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label={`Switch to ${l.toUpperCase()}`}
          aria-pressed={locale === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { locale } = useLocale();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={locale === "fr" ? "Basculer le thème" : "Toggle theme"}
      aria-pressed={theme === "dark"}
      className="rounded-full"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2">
      <img src="/logo.svg" alt="WebXIA" width={39} height={32} className="h-8 w-auto" />
      <span className="font-display text-base font-semibold tracking-tight">
        WebXIA<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

import { navItems } from "./nav-items";

export function Header() {
  const { t, locale } = useLocale();
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
                inactiveProps={{
                  className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
                }}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={locale === "fr" ? "Ouvrir le menu" : "Open menu"}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] sm:w-96">
                <SheetTitle className="sr-only">
                  {locale === "fr" ? "Menu de navigation" : "Navigation menu"}
                </SheetTitle>
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
