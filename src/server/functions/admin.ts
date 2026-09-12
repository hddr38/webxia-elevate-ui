import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function getArticlesStatsFallback() {
  const admin = getSupabaseAdmin();
  const { count: total } = await admin
    .from("articles")
    .select("id", { count: "exact", head: true });
  const { count: published } = await admin
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  const { count: drafts } = await admin
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  return { total: total ?? 0, published: published ?? 0, drafts: drafts ?? 0 };
}

async function getRealisationsStatsFallback() {
  const admin = getSupabaseAdmin();
  const { count: total } = await admin
    .from("realisations")
    .select("id", { count: "exact", head: true });
  const { count: published } = await admin
    .from("realisations")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  const { count: drafts } = await admin
    .from("realisations")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: featured } = await admin
    .from("realisations")
    .select("id", { count: "exact", head: true })
    .eq("featured", true);
  return {
    total: total ?? 0,
    published: published ?? 0,
    drafts: drafts ?? 0,
    featured: featured ?? 0,
  };
}

async function getMemoryStatsFallback() {
  const admin = getSupabaseAdmin();
  const { count: total } = await admin
    .from("ai_memory")
    .select("id", { count: "exact", head: true });
  // sessions = distinct session_id count — approximate via fetching session_ids
  // (ai_memory volume is low, this avoids a missing-RPC crash)
  const { data } = await admin.from("ai_memory").select("session_id");
  const sessions = new Set((data ?? []).map((r) => r.session_id)).size;
  return { total: total ?? 0, sessions };
}

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  // Articles stats - single query with conditional aggregation
  const { data: articlesAgg, error: articlesError } =
    await getSupabaseAdmin().rpc("get_articles_stats");

  // Réalisations stats - single query with conditional aggregation
  const { data: realisationsAgg, error: realisationsError } =
    await getSupabaseAdmin().rpc("get_realisations_stats");

  // AI Memory stats - single query
  const { data: memoryAgg, error: memoryError } = await getSupabaseAdmin().rpc("get_memory_stats");

  // Fallback to direct counts if an RPC is missing (e.g. migration not applied).
  // This prevents the whole /admin dashboard from crashing with error.500.
  return {
    articles: articlesError
      ? await getArticlesStatsFallback()
      : (articlesAgg ?? { total: 0, published: 0, drafts: 0 }),
    realisations: realisationsError
      ? await getRealisationsStatsFallback()
      : (realisationsAgg ?? { total: 0, published: 0, drafts: 0, featured: 0 }),
    aiMemory: memoryError
      ? await getMemoryStatsFallback()
      : (memoryAgg ?? { total: 0, sessions: 0 }),
  };
});
