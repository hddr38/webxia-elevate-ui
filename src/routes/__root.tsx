import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/lib/theme-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ChatWidget } from "@/components/chat";
import { AdminHeader } from "@/components/admin/admin-header";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { seo } from "@/lib/seo";

function NotFoundComponent() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.404.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.404.description")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.404.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useLocale();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("error.500.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.500.description")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.500.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.500.cta")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.home : seo.fr.home;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: s.title },
        { name: "description", content: s.description },
        { name: "author", content: "WebXIA" },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "WebXIA" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
        { rel: "manifest", href: "/manifest.json" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { t } = useLocale();
  const routerState = useRouterState();
  const isAdmin = routerState.location.pathname.startsWith("/admin");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        setIsAuthenticated(!!data.session);
      })
      .catch(() => {});
  }, []);

  // Dev-only: purge stale service workers. This app ships no service
  // worker, but a leftover registration on the same origin (e.g. from an
  // older build) intercepts POST fetches like /api/chat and crashes on
  // cache.put, which only supports GET. import.meta.env.DEV is replaced
  // at compile time, so this is dead-code-eliminated in production.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => {
          reg
            .unregister()
            .then((ok) => {
              if (ok) console.info("[dev] unregistered stale service worker:", reg.scope);
            })
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, []);

  // On /admin, AdminLayout (routes/admin/route.tsx) owns the chrome: AdminHeader,
  // skip-link and <main id="admin-content">. Root renders only providers + Outlet
  // there — otherwise AdminHeader would be duplicated and <main> nested in <main>.
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
          {isAdmin ? (
            <Outlet />
          ) : (
            <>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 text-sm focus:text-background"
              >
                {t("a11y.skip")}
              </a>
              {isAuthenticated ? <AdminHeader /> : <Header />}
              <main
                id="main-content"
                className={
                  isAuthenticated ? "mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8" : ""
                }
              >
                <Outlet />
              </main>
              {!isAuthenticated && <Footer />}
              {!isAuthenticated && <ChatWidget />}
            </>
          )}
          <Toaster position="bottom-right" richColors />
        </div>
      </MotionConfig>
    </QueryClientProvider>
  );
}
