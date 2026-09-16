import { createFileRoute, Outlet, Link, redirect, useRouter } from "@tanstack/react-router";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { adminMiddleware } from "@/lib/auth/middleware";
import { useLocale } from "@/lib/locale-context";
import { AdminHeader } from "@/components/admin/admin-header";

export const Route = createFileRoute("/admin/_layout")({
  server: {
    middleware: [adminMiddleware],
  },
  // Garde côté client : pas de session locale → login (avec retour).
  // Lecture du stockage local uniquement, aucun appel réseau.
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },
  errorComponent: AdminLayoutError,
  component: AdminLayout,
});

function AdminLayoutError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const isUnauthorized = error instanceof Response && error.status === 401;

  useEffect(() => {
    if (isUnauthorized) {
      void router.navigate({ to: "/auth/login", search: { redirect: "/admin" }, replace: true });
    }
  }, [isUnauthorized, router]);

  // Session expirée ou absente (SSR / hard refresh) → on bascule vers le
  // login au lieu d'afficher une page 500.
  if (isUnauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">{t("admin.login.redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("admin.common.loadError")}</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            {t("admin.common.retry")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/auth/login" search={{ redirect: "/admin" }}>
              {t("admin.login.title")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminLayout() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#admin-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:text-primary-foreground"
      >
        {t("a11y.skip")}
      </a>

      <AdminHeader />

      <main
        id="admin-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-28 sm:px-6 lg:px-8 focus-visible:outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}
