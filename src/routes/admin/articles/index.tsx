import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { getArticles, deleteArticle } from "@/server/functions/articles";
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
import { Plus, Search, Pencil, Trash2, FileText } from "lucide-react";
import { STATUS_LABELS, STATUS_BADGE } from "@/lib/constants";
import { useLocale } from "@/lib/locale-context";
import type { Article } from "@/types/database";

export const Route = createFileRoute("/admin/articles/")({
  component: ArticlesListPage,
});

function ArticlesListPage() {
  const { t, locale } = useLocale();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const loadArticles = useCallback(async (p: number, status: string, q: string) => {
    setIsLoading(true);
    try {
      const result = await getArticles({
        data: {
          status: status !== "all" ? status : undefined,
          search: q || undefined,
          page: p,
        },
      });
      setArticles(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(result.page);
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setPage(1);
    loadArticles(1, statusFilter, searchQuery);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArticle({ data: { id } });
      loadArticles(page, statusFilter, searchQuery);
    } catch (error) {
      console.error("Erreur suppression:", error);
    }
  };

  useEffect(() => {
    loadArticles(1, "all", "");
  }, [loadArticles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.articles.title")}</h1>
        <Link to="/admin/articles/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.articles.new")}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.articles.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.articles.search")}
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
                loadArticles(1, v, searchQuery);
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
                <TableHead>{t("admin.articles.colTitle")}</TableHead>
                <TableHead>{t("admin.articles.colStatus")}</TableHead>
                <TableHead>{t("admin.articles.colCreated")}</TableHead>
                <TableHead className="text-right">{t("admin.articles.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {isLoading ? t("admin.articles.loading") : t("admin.articles.empty")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => (
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
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(article.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to="/admin/articles/$id" params={{ id: article.id }}>
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
                              <AlertDialogTitle>{t("admin.articles.deleteConfirm")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("admin.articles.deleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("admin.articles.deleteCancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(article.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t("admin.articles.deleteAction")}
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
            {total} article{total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadArticles(page - 1, statusFilter, searchQuery)}
            >
              {t("admin.articles.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => loadArticles(page + 1, statusFilter, searchQuery)}
            >
              {t("admin.articles.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}