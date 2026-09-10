import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  // Articles stats - single query with conditional aggregation
  const { data: articlesAgg, error: articlesError } =
    await getSupabaseAdmin().rpc("get_articles_stats");

  if (articlesError) throw new Error(articlesError.message);

  // Réalisations stats - single query with conditional aggregation
  const { data: realisationsAgg, error: realisationsError } =
    await getSupabaseAdmin().rpc("get_realisations_stats");

  if (realisationsError) throw new Error(realisationsError.message);

  // AI Memory stats - single query
  const { data: memoryAgg, error: memoryError } = await getSupabaseAdmin().rpc("get_memory_stats");

  if (memoryError) throw new Error(memoryError.message);

  return {
    articles: articlesAgg ?? { total: 0, published: 0, drafts: 0 },
    realisations: realisationsAgg ?? { total: 0, published: 0, drafts: 0, featured: 0 },
    aiMemory: memoryAgg ?? { total: 0, sessions: 0 },
  };
});
