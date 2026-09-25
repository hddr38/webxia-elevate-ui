import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMessage,
  useMessagesList,
  useUpdateMessageStatus,
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
import { Search, SearchX, Trash2, Inbox, Loader2, ChevronDown, MailOpen, Mail } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface MessagesSearch {
  status: string;
  q: string;
  page: number;
}

export const Route = createFileRoute("/admin/messages/")({
  validateSearch: (search: Record<string, unknown>): MessagesSearch => ({
    status: typeof search.status === "string" ? search.status : "all",
    q: typeof search.q === "string" ? search.q.slice(0, 100) : "",
    page:
      typeof search.page === "number" && Number.isInteger(search.page) && search.page >= 1
        ? search.page
        : 1,
  }),
  component: MessagesListPage,
});

function formatAdminDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const STATUS_FILTERS = ["all", "new", "read"] as const;

function MessagesListPage() {
  const { t, locale } = useLocale();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [draft, setDraft] = useState(search.q);
  const debouncedQ = useDebouncedValue(draft, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const messagesQuery = useMessagesList(queryParams);
  const statusMutation = useUpdateMessageStatus();
  const deleteMutation = useDeleteMessage();

  const messages = messagesQuery.data?.data ?? [];
  const total = messagesQuery.data?.total ?? 0;
  const totalPages = messagesQuery.data?.totalPages ?? 1;
  const page = messagesQuery.data?.page ?? search.page;
  const isLoading = messagesQuery.isLoading;
  const isFetching = messagesQuery.isFetching && !messagesQuery.isLoading;
  const showSkeleton = isLoading && messages.length === 0;

  const setStatus = (v: string) => {
    navigate({ search: (prev) => ({ ...prev, status: v, page: 1 }) });
  };
  const setPage = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, page: p }) });
  };

  const handleStatusToggle = (id: string, current: string) => {
    statusMutation.mutate(
      { id, status: current === "read" ? "new" : "read" },
      { onError: () => toast.error(t("admin.common.saveError")) },
    );
  };

  const handleDelete = (id: string, isLastRowOfPage: boolean) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("admin.common.deleted"));
        if (expandedId === id) setExpandedId(null);
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
        title={t("admin.messages.title")}
        description={t("admin.messages.description")}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={t("admin.messages.search")}
            aria-label={t("admin.messages.search")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={search.status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t("admin.messages.filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all"
                  ? t("admin.messages.filterAll")
                  : value === "new"
                    ? t("admin.messages.filterNew")
                    : t("admin.messages.filterRead")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {messagesQuery.isError && (
        <ListErrorBanner
          message={t("admin.common.loadError")}
          retryLabel={t("admin.common.retry")}
          onRetry={() => messagesQuery.refetch()}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className={isFetching ? "pointer-events-none opacity-60" : undefined}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.messages.colMessage")}</TableHead>
                    <TableHead>{t("admin.messages.colStatus")}</TableHead>
                    <TableHead>{t("admin.messages.colReceived")}</TableHead>
                    <TableHead className="text-right">{t("admin.messages.colActions")}</TableHead>
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
                  ) : messages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        {hasFilters ? (
                          <EmptyState
                            icon={SearchX}
                            title={t("admin.messages.emptyFiltered")}
                            className="py-10"
                            action={
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                {t("admin.common.clearFilters")}
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon={Inbox}
                            title={t("admin.messages.empty")}
                            className="py-10"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    messages.map((message, index) => {
                      const isDeleting = deletingId === message.id;
                      const isExpanded = expandedId === message.id;
                      const isRead = message.status === "read";
                      return (
                        <Fragment key={message.id}>
                          <TableRow className={isRead ? undefined : "bg-brand/[0.04]"}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {message.name}{" "}
                                  <span className="font-normal text-muted-foreground">
                                    · {message.email}
                                  </span>
                                </p>
                                <p className="max-w-md truncate text-sm text-muted-foreground">
                                  {message.message}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isRead ? "secondary" : "default"}>
                                {isRead
                                  ? t("admin.messages.statusRead")
                                  : t("admin.messages.statusNew")}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                              {formatAdminDateTime(message.created_at, locale)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    isExpanded
                                      ? t("admin.messages.collapse")
                                      : t("admin.messages.expand")
                                  }
                                  aria-expanded={isExpanded}
                                  onClick={() => setExpandedId(isExpanded ? null : message.id)}
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    aria-hidden="true"
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    isRead
                                      ? t("admin.messages.markUnread")
                                      : t("admin.messages.markRead")
                                  }
                                  onClick={() => handleStatusToggle(message.id, message.status)}
                                >
                                  {isRead ? (
                                    <Mail className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <MailOpen className="h-4 w-4" aria-hidden="true" />
                                  )}
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
                                        {t("admin.messages.deleteConfirm")}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t("admin.messages.deleteDesc")}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        {t("admin.messages.deleteCancel")}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleDelete(
                                            message.id,
                                            messages.length === 1 && index === 0,
                                          )
                                        }
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={isDeleting}
                                      >
                                        {isDeleting
                                          ? t("admin.common.deleting")
                                          : t("admin.messages.deleteAction")}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <dl className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
                                  <div>
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      Email
                                    </dt>
                                    <dd className="mt-0.5 break-all">{message.email}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      {t("form.company")}
                                    </dt>
                                    <dd className="mt-0.5">{message.company || "—"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      {t("form.budget")}
                                    </dt>
                                    <dd className="mt-0.5">{message.budget || "—"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      {t("admin.messages.colReceived")}
                                    </dt>
                                    <dd className="mt-0.5 tabular-nums">
                                      {formatAdminDateTime(message.created_at, locale)}
                                    </dd>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      {t("form.message")}
                                    </dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap">
                                      {message.message}
                                    </dd>
                                  </div>
                                </dl>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
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
        countText={t("admin.messages.count", { count: total })}
        prevLabel={t("admin.messages.prev")}
        nextLabel={t("admin.messages.next")}
        pageLabel={(p, tp) => t("admin.common.pageOf", { page: p, total: tp })}
        onPageChange={setPage}
      />
    </div>
  );
}
