import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMemory,
  useDeleteSessionMemories,
  useMemoriesList,
  useMemoryStats,
} from "@/features/admin/queries";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, SearchX, Trash2, Brain, Eye, Loader2 } from "lucide-react";
import type { AIMemory } from "@/types/database";
import { useLocale } from "@/lib/locale-context";

interface MemorySearch {
  type: string;
  q: string;
  page: number;
}

export const Route = createFileRoute("/admin/ai-memory/")({
  validateSearch: (search: Record<string, unknown>): MemorySearch => ({
    type: typeof search.type === "string" ? search.type : "all",
    q: typeof search.q === "string" ? search.q.slice(0, 100) : "",
    page:
      typeof search.page === "number" && Number.isInteger(search.page) && search.page >= 1
        ? search.page
        : 1,
  }),
  component: AIMemoryPage,
});

const memoryTypeBadge: Record<string, string> = {
  conversation: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  context: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  knowledge: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  preference: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
};

function shortSessionId(sessionId: string | null | undefined): string {
  if (!sessionId) return "—";
  return `${sessionId.slice(0, 8)}...`;
}

function formatAdminDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function AIMemoryPage() {
  const { t, locale } = useLocale();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [draft, setDraft] = useState(search.q);
  const debouncedQ = useDebouncedValue(draft, 300);
  const [selectedMemory, setSelectedMemory] = useState<AIMemory | null>(null);

  useEffect(() => {
    setDraft(search.q);
  }, [search.q]);

  useEffect(() => {
    if (debouncedQ !== search.q) {
      navigate({ search: (prev) => ({ ...prev, q: debouncedQ, page: 1 }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const memoryTypeLabels: Record<string, string> = {
    all: t("admin.aiMemory.all"),
    conversation: t("admin.aiMemory.conversation"),
    context: t("admin.aiMemory.context"),
    knowledge: t("admin.aiMemory.knowledge"),
    preference: t("admin.aiMemory.preference"),
  };

  const listQuery = useMemoriesList({
    type: search.type !== "all" ? search.type : undefined,
    search: search.q || undefined,
    page: search.page,
  });
  const statsQuery = useMemoryStats();
  const deleteMutation = useDeleteMemory();
  const deleteSessionMutation = useDeleteSessionMemories();

  const memories = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 1;
  const page = listQuery.data?.page ?? search.page;
  const isLoading = listQuery.isLoading;
  const isFetching = listQuery.isFetching && !listQuery.isLoading;
  const showSkeleton = isLoading && memories.length === 0;

  const statsTotal = statsQuery.data?.total ?? total;
  const statsSessions = statsQuery.data?.sessions ?? 0;
  const statsByType = statsQuery.data?.byType ?? [];

  const setType = (v: string) => {
    navigate({ search: (prev) => ({ ...prev, type: v, page: 1 }) });
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

  const handleDeleteSession = (sessionId: string) => {
    deleteSessionMutation.mutate(sessionId, {
      onSuccess: () => {
        toast.success(t("admin.common.deleted"));
        setSelectedMemory(null);
      },
      onError: () => toast.error(t("admin.common.deleteError")),
    });
  };

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;
  const hasFilters = search.type !== "all" || search.q !== "";
  const clearFilters = () => {
    navigate({ search: { type: "all", q: "", page: 1 } });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.aiMemory.title")}
        description={t("admin.aiMemory.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.aiMemory.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">{statsTotal}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.aiMemory.sessions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">{statsSessions}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.aiMemory.byType")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <div className="flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(memoryTypeLabels)
                  .filter(([k]) => k !== "all")
                  .map(([key, label]) => {
                    const count = statsByType.find((s) => s.memory_type === key)?.count ?? 0;
                    return (
                      <Badge key={key} className={memoryTypeBadge[key]}>
                        {label}: {count}
                      </Badge>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={t("admin.aiMemory.search")}
            aria-label={t("admin.aiMemory.search")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={search.type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t("admin.aiMemory.fType")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(memoryTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listQuery.isError && (
        <ListErrorBanner
          message={t("admin.common.loadError")}
          retryLabel={t("admin.common.retry")}
          onRetry={() => listQuery.refetch()}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className={isFetching ? "pointer-events-none opacity-60" : undefined}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.aiMemory.fKey")}</TableHead>
                    <TableHead>{t("admin.aiMemory.fType")}</TableHead>
                    <TableHead>{t("admin.aiMemory.sessionCol")}</TableHead>
                    <TableHead>{t("admin.articles.colCreated")}</TableHead>
                    <TableHead className="text-right">{t("admin.articles.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showSkeleton ? (
                    [0, 1, 2].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto h-8 w-20 animate-pulse rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : memories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        {hasFilters ? (
                          <EmptyState
                            icon={SearchX}
                            title={t("admin.aiMemory.emptyFiltered")}
                            className="py-10"
                            action={
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                {t("admin.common.clearFilters")}
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon={Brain}
                            title={t("admin.aiMemory.empty")}
                            className="py-10"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    memories.map((memory, index) => {
                      const isDeleting = deletingId === memory.id;
                      return (
                        <TableRow key={memory.id}>
                          <TableCell>
                            <p className="font-medium font-mono text-sm">{memory.key}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={memoryTypeBadge[memory.memory_type] ?? ""}>
                              {memoryTypeLabels[memory.memory_type] ?? memory.memory_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {shortSessionId(memory.session_id)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums text-muted-foreground">
                            {formatAdminDate(memory.created_at, locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("admin.common.view")}
                                onClick={() => setSelectedMemory(memory)}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>

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
                                      {t("admin.aiMemory.deleteConfirm")}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("admin.aiMemory.deleteDesc")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t("admin.aiMemory.deleteCancel")}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDelete(
                                          memory.id,
                                          memories.length === 1 && index === 0,
                                        )
                                      }
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={isDeleting}
                                    >
                                      {isDeleting
                                        ? t("admin.common.deleting")
                                        : t("admin.aiMemory.deleteAction")}
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

      <Dialog
        open={selectedMemory !== null}
        onOpenChange={(open) => !open && setSelectedMemory(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {selectedMemory?.key ?? t("admin.aiMemory.title")}
            </DialogTitle>
          </DialogHeader>
          {selectedMemory && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.aiMemory.fKey")}
                </p>
                <p className="font-mono text-sm">{selectedMemory.key}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.aiMemory.fType")}
                </p>
                <Badge className={memoryTypeBadge[selectedMemory.memory_type] ?? ""}>
                  {memoryTypeLabels[selectedMemory.memory_type] ?? selectedMemory.memory_type}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.aiMemory.sessionCol")}
                </p>
                <p className="font-mono text-xs break-all">{selectedMemory.session_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.aiMemory.fValue")}
                </p>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                  {JSON.stringify(selectedMemory.value, null, 2)}
                </pre>
              </div>
              {selectedMemory.metadata &&
                Object.keys(selectedMemory.metadata as Record<string, unknown>).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.aiMemory.fMeta")}
                    </p>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedMemory.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={deleteSessionMutation.isPending}>
                  {deleteSessionMutation.isPending
                    ? t("admin.common.deleting")
                    : t("admin.aiMemory.deleteSession")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("admin.aiMemory.deleteSession")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("admin.aiMemory.deleteSessionDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("admin.aiMemory.deleteCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteSessionMutation.isPending || !selectedMemory}
                    onClick={() => selectedMemory && handleDeleteSession(selectedMemory.session_id)}
                  >
                    {t("admin.aiMemory.deleteAction")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="secondary" onClick={() => setSelectedMemory(null)}>
              {t("admin.aiMemory.deleteCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        countText={t("admin.aiMemory.count", { count: total })}
        prevLabel={t("admin.aiMemory.prev")}
        nextLabel={t("admin.aiMemory.next")}
        pageLabel={(p, tp) => t("admin.common.pageOf", { page: p, total: tp })}
        onPageChange={setPage}
      />
    </div>
  );
}
