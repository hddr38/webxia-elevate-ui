import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAdminStats,
  useArticlesList,
  useMemoryStats,
  useRealisationsList,
} from "@/features/admin/queries";
import { ListErrorBanner } from "@/components/admin/list-error-banner";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { RecentItem } from "@/components/admin/recent-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FolderKanban, Brain, Plus } from "lucide-react";
import { STATUS_LABELS } from "@/lib/constants";
import { useLocale, type Locale } from "@/lib/locale-context";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function formatAdminDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

interface BreakdownBarProps {
  label: string;
  total: number;
  published: number;
  drafts: number;
  publishedLabel: string;
  draftsLabel: string;
}

function BreakdownBar({
  label,
  total,
  published,
  drafts,
  publishedLabel,
  draftsLabel,
}: BreakdownBarProps) {
  const pubPct = total > 0 ? (published / total) * 100 : 0;
  const draftPct = total > 0 ? (drafts / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total}</span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${published} ${publishedLabel}, ${drafts} ${draftsLabel}, ${total}`}
      >
        {pubPct > 0 && (
          <span className="block h-full bg-emerald-500" style={{ width: `${pubPct}%` }} />
        )}
        {draftPct > 0 && (
          <span className="block h-full bg-amber-400" style={{ width: `${draftPct}%` }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="tabular-nums">{published}</span> {publishedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="tabular-nums">{drafts}</span> {draftsLabel}
        </span>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2" aria-hidden="true">
      <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="w-full space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function AdminDashboard() {
  const { t, locale } = useLocale();
  const statsQuery = useAdminStats();
  const recentArticlesQuery = useArticlesList({ page: 1 });
  const recentRealisationsQuery = useRealisationsList({ page: 1 });
  const memoryStatsQuery = useMemoryStats();

  const stats = statsQuery.data;
  const memoryStats = memoryStatsQuery.data;

  const recentArticles = (recentArticlesQuery.data?.data ?? []).slice(0, 5);
  const recentRealisations = (recentRealisationsQuery.data?.data ?? []).slice(0, 5);

  const memoryTypeLabel: Record<string, string> = {
    conversation: t("admin.aiMemory.conversation"),
    context: t("admin.aiMemory.context"),
    knowledge: t("admin.aiMemory.knowledge"),
    preference: t("admin.aiMemory.preference"),
  };

  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
          {t("admin.nav.administration")}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
          {t("admin.dashboard.title")}
        </h1>
        <p className="mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          {t("admin.dashboard.subtitle")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="brand" asChild>
            <Link to="/admin/articles/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("admin.dashboard.newArticle")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/realisations/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("admin.dashboard.newProject")}
            </Link>
          </Button>
        </div>
      </section>

      {statsQuery.isError && (
        <ListErrorBanner
          message={t("admin.common.loadError")}
          retryLabel={t("admin.common.retry")}
          onRetry={() => statsQuery.refetch()}
        />
      )}

      {!statsQuery.isError && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            loading={statsQuery.isLoading}
            to="/admin/articles"
            title={t("admin.nav.articles")}
            value={stats?.articles?.total ?? 0}
            icon={FileText}
            details={
              <>
                <span className="tabular-nums">
                  {stats?.articles?.published ?? 0} {t("admin.dashboard.publishedArticles")}
                </span>
                {" · "}
                <span className="tabular-nums">
                  {stats?.articles?.drafts ?? 0} {t("admin.dashboard.draftArticles")}
                </span>
              </>
            }
          />
          <StatCard
            loading={statsQuery.isLoading}
            to="/admin/realisations"
            title={t("admin.nav.realisations")}
            value={stats?.realisations?.total ?? 0}
            icon={FolderKanban}
            details={
              <>
                <span className="tabular-nums">
                  {stats?.realisations?.published ?? 0} {t("admin.dashboard.publishedArticles")}
                </span>
                {" · "}
                <span className="tabular-nums">
                  {stats?.realisations?.drafts ?? 0} {t("admin.dashboard.draftArticles")}
                </span>
              </>
            }
          />
          <StatCard
            loading={statsQuery.isLoading}
            to="/admin/ai-memory"
            title={t("admin.aiMemory.title")}
            value={stats?.aiMemory?.total ?? 0}
            icon={Brain}
            details={
              <span className="tabular-nums">
                {stats?.aiMemory?.sessions ?? 0} {t("admin.aiMemory.sessions")}
              </span>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{t("admin.dashboard.recentArticles")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/articles" search={{ status: "all", q: "", page: 1 }}>
                {t("admin.common.viewAll")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 pt-2">
            {recentArticlesQuery.isError && (
              <ListErrorBanner
                message={t("admin.common.loadError")}
                retryLabel={t("admin.common.retry")}
                onRetry={() => recentArticlesQuery.refetch()}
              />
            )}
            {recentArticlesQuery.isLoading ? (
              <div className="space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ) : !recentArticlesQuery.isError && recentArticles.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t("admin.dashboard.noArticles")}
                action={
                  <Button size="sm" asChild>
                    <Link to="/admin/articles/new">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t("admin.dashboard.noArticlesCta")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              !recentArticlesQuery.isError && (
                <ul className="-mx-2" aria-label={t("admin.dashboard.recentArticles")}>
                  {recentArticles.map((article) => (
                    <RecentItem
                      key={article.id}
                      id={article.id}
                      title={article.title}
                      subtitle={article.excerpt}
                      status={article.status}
                      statusLabel={t(
                        (STATUS_LABELS[article.status] ?? article.status) as "status.all",
                      )}
                      dateLabel={formatAdminDate(article.created_at, locale)}
                      coverUrl={article.cover_image_url}
                      fallbackIcon={FileText}
                      editTo="/admin/articles/$id"
                      viewTo="/journal/$slug"
                      viewSlug={article.slug}
                      viewLabel={t("admin.common.view")}
                    />
                  ))}
                </ul>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.dashboard.content")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {statsQuery.isLoading ? (
              <div className="space-y-5" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !stats ? null : (
              <>
                <BreakdownBar
                  label={t("admin.nav.articles")}
                  total={stats.articles.total}
                  published={stats.articles.published}
                  drafts={stats.articles.drafts}
                  publishedLabel={t("admin.dashboard.publishedArticles")}
                  draftsLabel={t("admin.dashboard.draftArticles")}
                />
                <BreakdownBar
                  label={t("admin.nav.realisations")}
                  total={stats.realisations.total}
                  published={stats.realisations.published}
                  drafts={stats.realisations.drafts}
                  publishedLabel={t("admin.dashboard.publishedArticles")}
                  draftsLabel={t("admin.dashboard.draftArticles")}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{t("admin.dashboard.recentRealisations")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/realisations" search={{ status: "all", q: "", page: 1 }}>
                {t("admin.common.viewAll")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 pt-2">
            {recentRealisationsQuery.isError && (
              <ListErrorBanner
                message={t("admin.common.loadError")}
                retryLabel={t("admin.common.retry")}
                onRetry={() => recentRealisationsQuery.refetch()}
              />
            )}
            {recentRealisationsQuery.isLoading ? (
              <div className="space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <RowSkeleton key={i} />
                ))}
              </div>
            ) : !recentRealisationsQuery.isError && recentRealisations.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title={t("admin.dashboard.noRealisations")}
                action={
                  <Button size="sm" asChild>
                    <Link to="/admin/realisations/new">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t("admin.dashboard.noRealisationsCta")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              !recentRealisationsQuery.isError && (
                <ul className="-mx-2" aria-label={t("admin.dashboard.recentRealisations")}>
                  {recentRealisations.map((r) => (
                    <RecentItem
                      key={r.id}
                      id={r.id}
                      title={r.title}
                      subtitle={r.client_name}
                      status={r.status}
                      statusLabel={t((STATUS_LABELS[r.status] ?? r.status) as "status.all")}
                      dateLabel={formatAdminDate(r.created_at, locale)}
                      coverUrl={r.cover_image_url}
                      fallbackIcon={FolderKanban}
                      editTo="/admin/realisations/$id"
                      viewTo="/work/$slug"
                      viewSlug={r.slug}
                      viewLabel={t("admin.common.view")}
                    />
                  ))}
                </ul>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{t("admin.aiMemory.title")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ai-memory" search={{ type: "all", q: "", page: 1 }}>
                {t("admin.common.viewAll")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {memoryStatsQuery.isLoading ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ) : memoryStatsQuery.isError ? (
              <ListErrorBanner
                message={t("admin.common.loadError")}
                retryLabel={t("admin.common.retry")}
                onRetry={() => memoryStatsQuery.refetch()}
              />
            ) : (
              <>
                <dl className="space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">{t("admin.aiMemory.total")}</dt>
                    <dd className="text-xl font-semibold tabular-nums tracking-tight">
                      {memoryStats?.total ?? 0}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">
                      {t("admin.aiMemory.sessions")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums tracking-tight">
                      {memoryStats?.sessions ?? 0}
                    </dd>
                  </div>
                </dl>
                {memoryStats?.byType && memoryStats.byType.length > 0 && (
                  <ul className="space-y-1.5 border-t pt-3">
                    {memoryStats.byType.map((row, index) => (
                      <li
                        key={`memory-type-${row.memory_type}-${index}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {memoryTypeLabel[row.memory_type] ?? row.memory_type}
                        </span>
                        <span className="tabular-nums font-medium">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
