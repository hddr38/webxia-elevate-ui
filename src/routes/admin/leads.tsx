import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useDeleteLeadMutation,
  useLeadsQuery,
  useLeadsCount,
} from "@/features/admin/leads-queries";
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
import { Search, SearchX, Trash2, Eye, Loader2, Mail, Phone, Calendar } from "lucide-react";
import type { LeadRow } from "@/server/functions/leads";
import { useLocale } from "@/lib/locale-context";

interface LeadsSearch {
  page: number;
  dateRange: string;
  hasEmail: boolean;
  hasPhone: boolean;
}

export const Route = createFileRoute("/admin/leads")({
  validateSearch: (search: Record<string, unknown>): LeadsSearch => ({
    page:
      typeof search.page === "number" && Number.isInteger(search.page) && search.page >= 1
        ? search.page
        : 1,
    dateRange: typeof search.dateRange === "string" ? search.dateRange : "last30",
    hasEmail: typeof search.hasEmail === "boolean" ? search.hasEmail : false,
    hasPhone: typeof search.hasPhone === "boolean" ? search.hasPhone : false,
  }),
  component: LeadsPage,
});

const dateRangeLabels: Record<string, string> = {
  last7: "last7",
  last30: "last30",
  last90: "last90",
  all: "all",
};

function formatAdminDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function LeadsPage() {
  const { t, locale } = useLocale();
  const search = Route.useSearch() as LeadsSearch;
  const navigate = useNavigate({ from: Route.fullPath });

  const [draft, setDraft] = useState(search.dateRange);
  const debouncedDateRange = useDebouncedValue(draft, 300);

  useEffect(() => {
    setDraft(search.dateRange);
  }, [search.dateRange]);

  useEffect(() => {
    if (debouncedDateRange !== search.dateRange) {
      navigate({ search: (prev) => ({ ...prev, dateRange: debouncedDateRange, page: 1 }) });
    }
  }, [debouncedDateRange, navigate]);

  const setDateRange = (value: string) => {
    setDraft(value);
  };

  const setHasEmail = (checked: boolean) => {
    navigate({ search: (prev) => ({ ...prev, hasEmail: checked, page: 1 }) });
  };

  const setHasPhone = (checked: boolean) => {
    navigate({ search: (prev) => ({ ...prev, hasPhone: checked, page: 1 }) });
  };

  const setPage = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, page: p }) });
  };

  const listQuery = useLeadsQuery({
    page: search.page,
    limit: 100,
    dateRange: search.dateRange,
    hasEmail: search.hasEmail,
    hasPhone: search.hasPhone,
  });
  const countQuery = useLeadsCount();
  const deleteMutation = useDeleteLeadMutation();

  const allLeads = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 1;
  const page = listQuery.data?.page ?? search.page;
  const isLoading = listQuery.isLoading;
  const isFetching = listQuery.isFetching && !listQuery.isLoading;
  const showSkeleton = isLoading && allLeads.length === 0;

  const totalCount = countQuery.data ?? 0;

  const hasFilters = search.dateRange !== "all" || search.hasEmail || search.hasPhone;
  const clearFilters = () => {
    navigate({ search: { dateRange: "all", hasEmail: false, hasPhone: false, page: 1 } });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("admin.common.deleted"));
      },
      onError: () => toast.error(t("admin.common.deleteError")),
    });
  };

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const filteredLeads = useMemo(() => {
    let leads = allLeads;
    const now = new Date();

    if (search.dateRange !== "all") {
      const days = Number.parseInt(search.dateRange.replace("last", ""), 10);
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      leads = leads.filter((l) => new Date(l.created_at) >= cutoff);
    }
    if (search.hasEmail) {
      leads = leads.filter((l) => l.email);
    }
    if (search.hasPhone) {
      leads = leads.filter((l) => l.phone);
    }
    return leads;
  }, [allLeads, search.dateRange, search.hasEmail, search.hasPhone]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t("admin.leads.title")} description={t("admin.leads.description")} />

      <Card>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Select value={search.dateRange} onValueChange={setDateRange}>
                <SelectTrigger
                  className="w-full pl-10"
                  aria-label={t("admin.leads.filters.dateRange")}
                >
                  <SelectValue placeholder={t("admin.leads.filters.dateRange")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="last7" value="last7">
                    {t("admin.leads.filters.last7")}
                  </SelectItem>
                  <SelectItem key="last30" value="last30">
                    {t("admin.leads.filters.last30")}
                  </SelectItem>
                  <SelectItem key="last90" value="last90">
                    {t("admin.leads.filters.last90")}
                  </SelectItem>
                  <SelectItem key="all" value="all">
                    {t("admin.leads.filters.all")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={search.hasEmail}
                  onChange={(e) => setHasEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">{t("admin.leads.filters.hasEmail")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={search.hasPhone}
                  onChange={(e) => setHasPhone(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">{t("admin.leads.filters.hasPhone")}</span>
              </label>
            </div>
          </div>

          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <SearchX className="h-4 w-4 mr-2" aria-hidden="true" />
              {t("admin.common.clearFilters")}
            </Button>
          )}
        </CardContent>
      </Card>

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
                    <TableHead>{t("admin.leads.table.firstName")}</TableHead>
                    <TableHead>{t("admin.leads.table.email")}</TableHead>
                    <TableHead>{t("admin.leads.table.phone")}</TableHead>
                    <TableHead>{t("admin.leads.table.summary")}</TableHead>
                    <TableHead>{t("admin.leads.table.createdAt")}</TableHead>
                    <TableHead className="text-right">{t("admin.leads.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showSkeleton ? (
                    [0, 1, 2].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto h-8 w-20 animate-pulse rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        {hasFilters ? (
                          <EmptyState
                            icon={SearchX}
                            title={t("admin.leads.emptyFiltered")}
                            className="py-10"
                            action={
                              <Button variant="outline" size="sm" onClick={clearFilters}>
                                {t("admin.common.clearFilters")}
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon={SearchX}
                            title={t("admin.leads.empty.title")}
                            description={t("admin.leads.empty.description")}
                            className="py-10"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead, index) => {
                      const isDeleting = deletingId === lead.id;
                      return (
                        <TableRow
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">{lead.first_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.email ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.phone ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {truncate(lead.summary, 80)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums text-muted-foreground">
                            {formatAdminDate(lead.created_at, locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("admin.common.delete")}
                                    disabled={isDeleting}
                                    onClick={(e) => e.stopPropagation()}
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
                                      {t("admin.leads.deleteConfirm")}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("admin.leads.deleteDesc")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {t("admin.leads.deleteCancel")}
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(lead.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={isDeleting}
                                    >
                                      {isDeleting
                                        ? t("admin.common.deleting")
                                        : t("admin.leads.deleteAction")}
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

      <Dialog open={selectedLead !== null} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {selectedLead
                ? `${selectedLead.first_name} — ${selectedLead.email ?? "—"}`
                : t("admin.leads.detail.title")}
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.table.firstName")}
                </p>
                <p>{selectedLead.first_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.table.email")}
                </p>
                <p>{selectedLead.email ?? <span className="text-muted-foreground">—</span>}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.table.phone")}
                </p>
                <p>{selectedLead.phone ?? <span className="text-muted-foreground">—</span>}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.table.summary")}
                </p>
                <p className="whitespace-pre-wrap">{selectedLead.summary}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.detail.sessionId")}
                </p>
                <p className="font-mono text-xs break-all">{selectedLead.session_id}</p>
              </div>
              {selectedLead.conversation_id && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("admin.leads.detail.conversationId")}
                  </p>
                  <p className="font-mono text-xs break-all">{selectedLead.conversation_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("admin.leads.table.createdAt")}
                </p>
                <p>{formatAdminDate(selectedLead.created_at, locale)}</p>
              </div>
              {selectedLead.metadata &&
                Object.keys(selectedLead.metadata as Record<string, unknown>).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("admin.leads.detail.metadata")}
                    </p>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                      {JSON.stringify(selectedLead.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setSelectedLead(null)}>
              {t("admin.common.back")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        countText={t("admin.common.pageOf", { page, total: totalPages })}
        prevLabel={t("admin.common.prev")}
        nextLabel={t("admin.common.next")}
        pageLabel={(p, tp) => t("admin.common.pageOf", { page: p, total: tp })}
        onPageChange={setPage}
      />
    </div>
  );
}
