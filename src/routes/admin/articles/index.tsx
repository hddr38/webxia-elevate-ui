import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useArticlesList, useDeleteArticle } from "@/features/admin/queries";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ListErrorBanner } from "@/components/admin/list-error-banner";
import { ListPagination } from "@/components/admin/list-pagination";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, SearchX, Pencil, Trash2, FileText, Loader2, Eye } from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";

interface ArticlesSearch {
  status: string;
  q: string;
  page: number;
}

export const Route = createFileRoute("/admin/articles/")({
  validateSearch: (search: Record<string, unknown>): ArticlesSearch => ({
    status: typeof search.status === "string" ? search.status : "all",
    q: typeof search.q === "string" ? search.q.slice(0, 100) : "",
    page:
      typeof search.page === "number" && Number.isInteger(search.page) && search.page >= 1
        ? search.page
        : 1,
  }),
  component: ArticlesListPage,
});

function formatAdminDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function ArticlesListPage() {
  const { t, locale } = useLocale();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [draft, setDraft] = useState(search.q);
  const debouncedQ = useDebouncedValue(draft, 300);

  useEffect(() => {
    setDraft(search.q);
  }, [search.q]);

  useEffect(() => {
    if (debouncedQ !== search.q) {
      navigate({ search: (prev) => ({ ...prev, q: debouncedQ, page: 1 }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const queryParams = {
    status: search.status !== "all" ? search.status : undefined,
    search: search.q || undefined,
    page: search.page,
  };
  const articlesQuery = useArticlesList(queryParams);
  const deleteMutation = useDeleteArticle();

  const articles = articlesQuery.data?.data ?? [];
  const total = articlesQuery.data?.total ?? 0;
  const totalPages = articlesQuery.data?.totalPages ?? 1;
  const page = articlesQuery.data?.page ?? search.page;
  const isLoading = articlesQuery.isLoading;
  const isFetching = articlesQuery.isFetching && !articlesQuery.isLoading;
  const showSkeleton = isLoading && articles.length === 0;

  const setStatus = (v: string) => {
    navigate({ search: (prev) => ({ ...prev, status: v, page: 1 }) });
  };
  const setPage = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, page: p }) });
  };

  const handleDelete = (id: string, isLastRowOfPage: boolean) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("admin.common.deleted"));
        if (isLastRowOfPage && page > 1) setPage(page - 1);
      },
      onError: () => toast.error(t("admin.common.deleteError")),
    });
  };

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;
  const hasFilters = search.status !== "all" || search.q !== "";
  const clearFilters = () => {
    navigate({ search: { status: "all", q: "", page: 1 } });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.articles.title")}
        description={t("admin.articles.description")}
        actions={
          <Button asChild>
            <Link to="/admin/articles/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("admin.articles.new")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={t("admin.articles.search")}
            aria-label={t("admin.articles.search")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={search.status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t("admin.articles.colStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {t(label as "status.all")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {articlesQuery.isError && (
        <ListErrorBanner
          message={t("admin.common.loadError")}
          retryLabel={t("admin.common.retry")}
          onRetry={() => articlesQuery.refetch()}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className={isFetching ? "pointer-events-none opacity-60" : undefined}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.articles.colTitle")}</TableHead>
                    <TableHead>{t("admin.articles.colStatus")}</TableHead>
                    <TableHead>{t("admin.articles.colCreated")}</TableHead>
                    <TableHead className="text-right">{t("admin.articles.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showSkeleton ? (
                    [0, 1, 2].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                          <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto h-8 w-20 animate-pulse rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : articles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        {hasFilters ? (
                          <EmptyState
                            icon={SearchX}
                            title={t("admin.articles.emptyFiltered")}
                            className="py-10"
                            action={
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                {t("admin.common.clearFilters")}
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon={FileText}
                            title={t("admin.articles.empty")}
                            className="py-10"
                            action={
                              <Button size="sm" asChild>
                                <Link to="/admin/articles/new">
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                  {t("admin.articles.new")}
                                </Link>
                              </Button>
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    articles.map((article, index) => {
                      const isDeleting = deletingId === article.id;
                      return (
                        <TableRow key={article.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{article.title}</p>
                              <p className="text-sm text-muted-foreground truncate max-w-md">
                                {article.excerpt}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_BADGE[article.status] ?? ""}>
                              {t((STATUS_LABELS[article.status] ?? article.status) as "status.all")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums text-muted-foreground">
                            {formatAdminDate(article.created_at, locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {article.status === "published" && article.slug.trim() !== "" && (
                                <Link
                                  to="/journal/$slug"
                                  params={{ slug: article.slug }}
                                  target="_blank"
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("admin.common.view")}
                                  >
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </Link>
                              )}
                              <Link to="/admin/articles/$id" params={{ id: article.id }}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("admin.common.edit")}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("admin.common.delete")}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? (
                                      <Loader2
                                        className="h-4 w-4 animate-spin text-red-500"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Trash2
                                        className="h-4 w-4 text-red-500 dark:text-red-400"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {t("admin.articles.deleteConfirm")}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("admin.articles.deleteDesc")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t("admin.articles.deleteCancel")}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDelete(
                                          article.id,
                                          articles.length === 1 && index === 0,
                                        )
                                      }
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={isDeleting}
                                    >
                                      {isDeleting
                                        ? t("admin.common.deleting")
                                        : t("admin.articles.deleteAction")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        countText={t("admin.articles.count", { count: total })}
        prevLabel={t("admin.articles.prev")}
        nextLabel={t("admin.articles.next")}
        pageLabel={(p, tp) => t("admin.common.pageOf", { page: p, total: tp })}
        onPageChange={setPage}
      />
    </div>
  );
}
