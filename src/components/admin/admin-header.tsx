import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PenTool, FolderKanban, Brain, LogOut, Menu, ExternalLink, Inbox } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher, ThemeToggle } from "@/components/site/header";
import { navItems } from "@/components/site/nav-items";

// Liens admin intégrés à la même navbar que la home (icônes pour distinguer
// "Réalisations" vitrine de "Réalisations" admin, libellés inchangés).
// Liens explicites (pas de map sur union) : les routes listes exigent `search`.
function AdminLinks({
  onNavigate,
  variant,
}: {
  onNavigate?: () => void;
  variant: "pill" | "drawer";
}) {
  const { t } = useLocale();
  const isDrawer = variant === "drawer";
  const linkClass = isDrawer
    ? "flex items-center gap-3 rounded-xl px-4 py-3 font-display text-2xl font-semibold tracking-tight text-foreground transition-colors hover:bg-secondary"
    : "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors";
  const iconClass = isDrawer ? "size-6 shrink-0 text-brand" : "size-3.5";
  return (
    <>
      <Link
        to="/admin/articles"
        search={{ status: "all", q: "", page: 1 }}
        onClick={onNavigate}
        activeProps={{ className: "bg-secondary text-foreground" }}
        inactiveProps={{
          className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        }}
        className={linkClass}
      >
        <PenTool className={iconClass} aria-hidden="true" />
        {t("admin.nav.articles")}
      </Link>
      <Link
        to="/admin/realisations"
        search={{ status: "all", q: "", page: 1 }}
        onClick={onNavigate}
        activeProps={{ className: "bg-secondary text-foreground" }}
        inactiveProps={{
          className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        }}
        className={linkClass}
      >
        <FolderKanban className={iconClass} aria-hidden="true" />
        {t("admin.nav.realisations")}
      </Link>
      <Link
        to="/admin/ai-memory"
        search={{ type: "all", q: "", page: 1 }}
        onClick={onNavigate}
        activeProps={{ className: "bg-secondary text-foreground" }}
        inactiveProps={{
          className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        }}
        className={linkClass}
      >
        <Brain className={iconClass} aria-hidden="true" />
        {t("admin.nav.aiMemory")}
      </Link>
      <Link
        to="/admin/messages"
        search={{ status: "all", q: "", page: 1 }}
        onClick={onNavigate}
        activeProps={{ className: "bg-secondary text-foreground" }}
        inactiveProps={{
          className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        }}
        className={linkClass}
      >
        <Inbox className={iconClass} aria-hidden="true" />
        {t("admin.nav.messages")}
      </Link>
    </>
  );
}

function AdminLogo() {
  return (
    <Link
      to="/admin"
      className="group flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img src="/logo.svg" alt="WebXIA" width={39} height={32} className="h-8 w-auto" />
      <span className="font-display text-base font-semibold tracking-tight">
        WebXIA<span className="text-brand">.</span>
      </span>
    </Link>
  );
}

/**
 * Navbar admin unique — la même pill que la home (logo, liens site,
 * langue, thème, drawer mobile) + le groupe admin (Articles, Réalisations,
 * Mémoire IA) et le menu utilisateur.
 */
export function AdminHeader() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) setUserEmail(data.user.email ?? null);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate({ to: "/auth/login", search: { redirect: undefined }, replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("admin.nav.logoutError"));
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-full border border-border bg-background/60 px-4 py-2.5 shadow-[0_8px_30px_-12px_color-mix(in_oklab,var(--foreground)_15%,transparent)] backdrop-blur-xl">
          <AdminLogo />

          {/* Liens site (xl+) + groupe admin (md+) dans la même pill */}
          <nav
            className="hidden min-w-0 items-center gap-1 md:flex"
            aria-label={t("admin.nav.administration")}
          >
            <span className="hidden items-center gap-1 xl:flex">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  activeProps={{ className: "bg-secondary text-foreground" }}
                  inactiveProps={{
                    className: "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  }}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors"
                >
                  {t(item.key)}
                </Link>
              ))}
              <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-border" />
            </span>
            <AdminLinks variant="pill" />
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LocaleSwitcher />
            <ThemeToggle />
            {userEmail && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t("admin.nav.userMenu")}
                    className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand transition-colors hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden="true">{userEmail.charAt(0).toUpperCase()}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal">
                    <span className="block text-sm font-medium">{userEmail}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/" className="cursor-pointer">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t("admin.nav.viewSite")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleSignOut();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t("admin.nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] rounded-full"
                  aria-label={t("admin.common.openMenu")}
                >
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] overflow-y-auto sm:w-96">
                <SheetTitle className="sr-only">{t("admin.nav.administration")}</SheetTitle>
                <div className="mt-10 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.key}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-4 py-2.5 font-display text-xl font-semibold tracking-tight text-foreground transition-colors hover:bg-secondary"
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-1 border-t border-border pt-6">
                  <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
                    {t("admin.nav.administration")}
                  </p>
                  <AdminLinks variant="drawer" onNavigate={() => setOpen(false)} />
                </div>
                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <LocaleSwitcher />
                    {userEmail && (
                      <span className="truncate text-sm text-muted-foreground">{userEmail}</span>
                    )}
                  </div>
                  <Button variant="outline" asChild className="min-h-[44px] justify-start">
                    <Link to="/" onClick={() => setOpen(false)}>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t("admin.nav.viewSite")}
                    </Link>
                  </Button>
                  {userEmail && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        void handleSignOut();
                      }}
                      className="min-h-[44px] justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      {t("admin.nav.logout")}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
