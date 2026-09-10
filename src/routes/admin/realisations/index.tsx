import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getRealisations, deleteRealisation } from "@/server/functions/realisations";
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
import { Plus, Search, Pencil, Trash2, FolderKanban, Star } from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import type { Realisation } from "@/types/database";

export const Route = createFileRoute("/admin/realisations/")({
  component: RealisationsListPage,
});

function RealisationsListPage() {
  const { t } = useLocale();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [realisations, setRealisations] = useState<Realisation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async (p = page, status = statusFilter, q = searchQuery) => {
    setIsLoading(true);
    try {
      const result = await getRealisations({
        data: {
          status: status !== "all" ? status : undefined,
          search: q || undefined,
          page: p,
        },
      });
      setRealisations(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(result.page);
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadData(1, statusFilter, searchQuery);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRealisation({ data: { id } });
      loadData();
    } catch (error) {
      console.error("Erreur suppression:", error);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.realisations.title")}</h1>
        <Link to="/admin/realisations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.realisations.new")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.realisations.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.realisations.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
                loadData(1, v, searchQuery);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.realisations.colProject")}</TableHead>
                <TableHead>{t("admin.realisations.colStatus")}</TableHead>
                <TableHead>{t("admin.realisations.colClient")}</TableHead>
                <TableHead>{t("admin.realisations.colOrder")}</TableHead>
                <TableHead className="text-right">{t("admin.realisations.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realisations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {isLoading ? t("admin.realisations.loading") : t("admin.realisations.empty")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                realisations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            {r.title}
                            {r.featured && (
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {r.short_description}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[r.status] ?? ""}>
                        {t((STATUS_LABELS[r.status] ?? r.status) as "status.all")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.client_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to="/admin/realisations/$id" params={{ id: r.id }}>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("admin.realisations.deleteConfirm")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("admin.realisations.deleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("admin.realisations.deleteCancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(r.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t("admin.realisations.deleteAction")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} réalisation{total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadData(page - 1)}
            >
              {t("admin.realisations.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => loadData(page + 1)}
            >
              {t("admin.realisations.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
