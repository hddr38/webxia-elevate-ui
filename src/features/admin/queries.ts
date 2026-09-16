import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getAdminStats } from "@/server/functions/admin";
import {
  createArticle,
  deleteArticle,
  getArticles,
  updateArticle,
} from "@/server/functions/articles";
import {
  createRealisation,
  deleteRealisation,
  getRealisations,
  updateRealisation,
} from "@/server/functions/realisations";
import {
  deleteMemory,
  deleteSessionMemories,
  getMemories,
  getMemoryStats,
} from "@/server/functions/ai-memory";
import { AdminStatsSchema } from "@/lib/admin/schemas";

export const adminKeys = {
  // "v2" : la forme du payload est désormais validée par Zod (AdminStatsSchema).
  // Nouvelle clé = aucun cache d'une forme antérieure ne peut être réutilisé.
  stats: ["admin", "stats", "v2"] as const,
  articlesList: (params: { status?: string; search?: string; page: number }) =>
    ["admin", "articles", "list", params] as const,
  realisationsList: (params: { status?: string; search?: string; page: number }) =>
    ["admin", "realisations", "list", params] as const,
  memoriesList: (params: { type?: string; search?: string; page: number }) =>
    ["admin", "ai-memory", "list", params] as const,
  memoryStats: ["admin", "ai-memory", "stats"] as const,
};

export function adminStatsOptions() {
  return queryOptions({
    queryKey: adminKeys.stats,
    // Validation à la frontière : un payload inattendu devient une erreur
    // (bandeau + Réessayer) au lieu d'un crash du dashboard. Les rejets ne
    // sont jamais mis en cache comme données.
    queryFn: async () => AdminStatsSchema.parse(await getAdminStats()),
    staleTime: 30_000,
  });
}

export function articlesListOptions(params: { status?: string; search?: string; page: number }) {
  return queryOptions({
    queryKey: adminKeys.articlesList(params),
    queryFn: () => getArticles({ data: params }),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function realisationsListOptions(params: {
  status?: string;
  search?: string;
  page: number;
}) {
  return queryOptions({
    queryKey: adminKeys.realisationsList(params),
    queryFn: () => getRealisations({ data: params }),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function memoriesListOptions(params: { type?: string; search?: string; page: number }) {
  return queryOptions({
    queryKey: adminKeys.memoriesList(params),
    queryFn: () =>
      getMemories({
        data: {
          memory_type: params.type,
          search: params.search,
          page: params.page,
        },
      }),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function memoryStatsOptions() {
  return queryOptions({
    queryKey: adminKeys.memoryStats,
    queryFn: () => getMemoryStats(),
    staleTime: 30_000,
  });
}

export function useAdminStats() {
  return useQuery(adminStatsOptions());
}

export function useArticlesList(params: { status?: string; search?: string; page: number }) {
  return useQuery(articlesListOptions(params));
}

export function useRealisationsList(params: { status?: string; search?: string; page: number }) {
  return useQuery(realisationsListOptions(params));
}

export function useMemoriesList(params: { type?: string; search?: string; page: number }) {
  return useQuery(memoriesListOptions(params));
}

export function useMemoryStats() {
  return useQuery(memoryStatsOptions());
}

function invalidateAdminLists(queryClient: ReturnType<typeof useQueryClient>, key: string) {
  void queryClient.invalidateQueries({ queryKey: ["admin", key] });
  void queryClient.invalidateQueries({ queryKey: adminKeys.stats });
  void queryClient.invalidateQueries({ queryKey: adminKeys.memoryStats });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArticle({ data: { id } }),
    onSuccess: () => invalidateAdminLists(queryClient, "articles"),
  });
}

import type {
  CreateArticleSchema,
  UpdateArticleSchema,
  CreateRealisationSchema,
  UpdateRealisationSchema,
} from "@/lib/admin/schemas";
import type { z } from "zod";

type CreateArticleData = z.infer<typeof CreateArticleSchema>;
type UpdateArticleData = z.infer<typeof UpdateArticleSchema>;
type CreateRealisationData = z.infer<typeof CreateRealisationSchema>;
type UpdateRealisationData = z.infer<typeof UpdateRealisationSchema>;

export function useSaveArticle(mode: "create" | "edit") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateArticleData | UpdateArticleData) =>
      mode === "create"
        ? createArticle({ data: payload as CreateArticleData })
        : updateArticle({ data: payload as UpdateArticleData }),
    onSuccess: () => invalidateAdminLists(queryClient, "articles"),
  });
}

export function useSaveRealisation(mode: "create" | "edit") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRealisationData | UpdateRealisationData) =>
      mode === "create"
        ? createRealisation({ data: payload as CreateRealisationData })
        : updateRealisation({ data: payload as UpdateRealisationData }),
    onSuccess: () => invalidateAdminLists(queryClient, "realisations"),
  });
}

export function useDeleteRealisation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRealisation({ data: { id } }),
    onSuccess: () => invalidateAdminLists(queryClient, "realisations"),
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMemory({ data: { id } }),
    onSuccess: () => invalidateAdminLists(queryClient, "ai-memory"),
  });
}

export function useDeleteSessionMemories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => deleteSessionMemories({ data: { session_id: sessionId } }),
    onSuccess: () => invalidateAdminLists(queryClient, "ai-memory"),
  });
}
