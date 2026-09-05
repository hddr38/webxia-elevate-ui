import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PenTool,
  FolderKanban,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { adminMiddleware } from "@/lib/auth/middleware";
import { useLocale } from "@/lib/locale-context";

export const Route = createFileRoute("/admin/_layout")({
  server: {
    middleware: [adminMiddleware],
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const navigation = [
    { name: t("admin.nav.dashboard"), href: "/admin", icon: LayoutDashboard },
    { name: t("admin.nav.articles"), href: "/admin/articles", icon: PenTool },
    { name: t("admin.nav.realisations"), href: "/admin/realisations", icon: FolderKanban },
    { name: t("admin.nav.aiMemory"), href: "/admin/ai-memory", icon: Brain },
    { name: "Paramètres", href: "/admin/settings", icon: Settings },
  ];

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? null);
      } else {
        navigate({ to: "/auth/login", replace: true });
      }
    });
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      navigate({ to: "/auth/login", replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const currentPath = routerState.location.pathname;

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 transform bg-card border-r transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <Link to="/admin" className="font-bold text-xl">
              WebXIA Admin
            </Link>
            <button className="lg:hidden p-2" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? currentPath === "/admin"
                  : currentPath.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            {userEmail && (
              <div className="flex items-center gap-3 mb-4 px-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.nav.administration")}</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-red-600 hover:text-red-700"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>{t("admin.nav.logout")}</span>
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button className="lg:hidden p-2" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("admin.nav.administration")}</h1>
        </header>

        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
