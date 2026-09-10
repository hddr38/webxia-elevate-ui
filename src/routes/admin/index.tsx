import { createFileRoute } from "@tanstack/react-router";
import { getAdminStats } from "@/server/functions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Briefcase, Brain, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    const stats = await getAdminStats();
    return stats;
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = Route.useLoaderData();
  const { t } = useLocale();

  const statCards = [
    {
      title: t("admin.nav.articles"),
      value: stats?.articles.total ?? 0,
      published: stats?.articles.published ?? 0,
      drafts: stats?.articles.drafts ?? 0,
      icon: FileText,
      color: "text-blue-600 bg-blue-100",
      href: "/admin/articles",
    },
    {
      title: t("admin.nav.realisations"),
      value: stats?.realisations.total ?? 0,
      published: stats?.realisations.published ?? 0,
      drafts: stats?.realisations.drafts ?? 0,
      icon: Briefcase,
      color: "text-green-600 bg-green-100",
      href: "/admin/realisations",
    },
    {
      title: t("admin.nav.aiMemory"),
      value: stats?.aiMemory.total ?? 0,
      sessions: stats?.aiMemory.sessions ?? 0,
      icon: Brain,
      color: "text-purple-600 bg-purple-100",
      href: "/admin/ai-memory",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("admin.dashboard.title")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.published !== undefined && (
                  <>
                    <span className="text-green-600">
                      {card.published} {t("admin.dashboard.publishedArticles")}
                    </span>
                    {card.drafts !== undefined && <span className="mx-1 text-gray-400">·</span>}
                    {card.drafts !== undefined && (
                      <span className="text-yellow-600">
                        {card.drafts} {t("admin.dashboard.draftArticles")}
                      </span>
                    )}
                  </>
                )}
                {card.sessions !== undefined && (
                  <span className="text-purple-600">{card.sessions} sessions</span>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dashboard.quickStats")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/articles/new"
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 text-sm font-medium",
                "transition-colors hover:bg-accent",
              )}
            >
              <FileText className="h-5 w-5 text-blue-600" />
              <span>{t("admin.dashboard.newArticle")}</span>
            </a>
            <a
              href="/admin/realisations/new"
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 text-sm font-medium",
                "transition-colors hover:bg-accent",
              )}
            >
              <Briefcase className="h-5 w-5 text-green-600" />
              <span>{t("admin.dashboard.newProject")}</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dashboard.quickStats")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.dashboard.totalArticles")}</span>
              <span className="font-medium">
                {(stats?.articles.total ?? 0) + (stats?.realisations.total ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("admin.dashboard.publishedArticles")}
              </span>
              <span className="font-medium text-green-600">
                {(stats?.articles.published ?? 0) + (stats?.realisations.published ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("admin.dashboard.draftArticles")}</span>
              <span className="font-medium text-yellow-600">
                {(stats?.articles.drafts ?? 0) + (stats?.realisations.drafts ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
