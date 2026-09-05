import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getMemories, deleteMemory, deleteSessionMemories } from "@/server/functions/ai-memory";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Brain, Eye, Trash } from "lucide-react";
import type { AIMemory } from "@/types/database";
import { useLocale } from "@/lib/locale-context";

export const Route = createFileRoute("/admin/ai-memory/")({
  component: AIMemoryPage,
});

const memoryTypeBadge: Record<string, string> = {
  conversation: "bg-blue-100 text-blue-800",
  context: "bg-purple-100 text-purple-800",
  knowledge: "bg-green-100 text-green-800",
  preference: "bg-orange-100 text-orange-800",
};

function AIMemoryPage() {
  const { t, locale } = useLocale();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<AIMemory | null>(null);

  const memoryTypeLabels: Record<string, string> = {
    all: t("admin.aiMemory.all"),
    conversation: t("admin.aiMemory.conversation"),
    context: t("admin.aiMemory.context"),
    knowledge: "Knowledge",
    preference: "Preference",
  };

  const loadData = async (p = page, type = typeFilter, q = searchQuery) => {
    setIsLoading(true);
    try {
      const result = await getMemories({
        data: {
          memory_type: type !== "all" ? type : undefined,
          search: q || undefined,
          page: p,
        },
      });
      const r = result as { data: AIMemory[]; total: number; page: number; totalPages: number };
      setMemories(r.data);
      setTotal(r.total);
      setTotalPages(r.totalPages);
      setPage(r.page);
    } catch (error) {
      console.error("Load error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory({ data: { id } });
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionMemories({ data: { session_id: sessionId } });
      loadData();
    } catch (error) {
      console.error("Delete session error:", error);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group by session_id
  const sessionGroups = memories.reduce(
    (acc, memory) => {
      const sid = memory.session_id;
      if (!acc[sid]) acc[sid] = [];
      acc[sid].push(memory);
      return acc;
    },
    {} as Record<string, AIMemory[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.aiMemory.title")}</h1>
          <p className="text-muted-foreground">{t("admin.aiMemory.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.dashboard.totalArticles")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(sessionGroups).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Par type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(memoryTypeLabels)
                .filter(([k]) => k !== "all")
                .map(([key, label]) => {
                  const count = memories.filter((m) => m.memory_type === key).length;
                  return (
                    <Badge key={key} className={memoryTypeBadge[key]}>
                      {label}: {count}
                    </Badge>
                  );
                })}
            </div>
          </CardContent>
        </Card>
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
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                loadData(1, v, searchQuery);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.articles.colTitle")}</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>{t("admin.articles.colCreated")}</TableHead>
                <TableHead className="text-right">{t("admin.articles.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {isLoading ? t("admin.aiMemory.loading") : t("admin.aiMemory.empty")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                memories.map((memory) => (
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
                      {memory.session_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(memory.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedMemory(memory)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{t("admin.aiMemory.title")}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Clé</p>
                                <p className="font-mono text-sm">{selectedMemory?.key}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Type</p>
                                <Badge
                                  className={
                                    memoryTypeBadge[selectedMemory?.memory_type ?? ""] ?? ""
                                  }
                                >
                                  {memoryTypeLabels[selectedMemory?.memory_type ?? ""] ??
                                    selectedMemory?.memory_type}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Valeur (JSON)
                                </p>
                                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                                  {JSON.stringify(selectedMemory?.value, null, 2)}
                                </pre>
                              </div>
                              {selectedMemory?.metadata &&
                                Object.keys(selectedMemory.metadata).length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Métadonnées
                                    </p>
                                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-40">
                                      {JSON.stringify(selectedMemory.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("admin.aiMemory.deleteConfirm")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("admin.aiMemory.deleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("admin.aiMemory.deleteCancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(memory.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t("admin.aiMemory.deleteAction")}
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
            {total} entrée{total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadData(page - 1)}
            >
              {t("admin.articles.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => loadData(page + 1)}
            >
              {t("admin.articles.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
