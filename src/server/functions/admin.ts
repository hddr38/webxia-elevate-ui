import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function getArticlesStatsFallback() {
  const admin = getSupabaseAdmin();
  const [totalRes, publishedRes, draftsRes] = await Promise.all([
    admin.from("articles").select("id", { count: "exact", head: true }),
    admin.from("articles").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("articles").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  return {
    total: totalRes.count ?? 0,
    published: publishedRes.count ?? 0,
    drafts: draftsRes.count ?? 0,
  };
}

async function getRealisationsStatsFallback() {
  const admin = getSupabaseAdmin();
  const [totalRes, publishedRes, draftsRes, featuredRes] = await Promise.all([
    admin.from("realisations").select("id", { count: "exact", head: true }),
    admin
      .from("realisations")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin.from("realisations").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin.from("realisations").select("id", { count: "exact", head: true }).eq("featured", true),
  ]);
  return {
    total: totalRes.count ?? 0,
    published: publishedRes.count ?? 0,
    drafts: draftsRes.count ?? 0,
    featured: featuredRes.count ?? 0,
  };
}

async function getMemoryStatsFallback() {
  const admin = getSupabaseAdmin();
  const { count: total } = await admin
    .from("ai_memory")
    .select("id", { count: "exact", head: true });
  // sessions = distinct session_id — paginé par lots pour éviter le full-scan OOM.
  const sessions = new Set<string>();
  const pageSize = 2000;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("ai_memory")
      .select("session_id")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) sessions.add(row.session_id);
    if (data.length < pageSize) break;
  }
  return { total: total ?? 0, sessions: sessions.size };
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const admin = getSupabaseAdmin();
    // Articles stats - single query with conditional aggregation
    const { data: articlesAgg, error: articlesError } = await admin.rpc("get_articles_stats");

    // Réalisations stats - single query with conditional aggregation
    const { data: realisationsAgg, error: realisationsError } =
      await admin.rpc("get_realisations_stats");

    // AI Memory stats - single query
    const { data: memoryAgg, error: memoryError } = await admin.rpc("get_memory_stats");

    // Fallback to direct counts if an RPC is missing (e.g. migration not applied).
    // This prevents the whole /admin dashboard from crashing with error.500.
    if (articlesError)
      console.error("[admin] get_articles_stats RPC failed, fallback:", articlesError.message);
    if (realisationsError)
      console.error(
        "[admin] get_realisations_stats RPC failed, fallback:",
        realisationsError.message,
      );
    if (memoryError)
      console.error("[admin] get_memory_stats RPC failed, fallback:", memoryError.message);

    const [articles, realisations, aiMemory] = await Promise.all([
      articlesError
        ? getArticlesStatsFallback()
        : Promise.resolve(articlesAgg ?? { total: 0, published: 0, drafts: 0 }),
      realisationsError
        ? getRealisationsStatsFallback()
        : Promise.resolve(realisationsAgg ?? { total: 0, published: 0, drafts: 0, featured: 0 }),
      memoryError
        ? getMemoryStatsFallback()
        : Promise.resolve(memoryAgg ?? { total: 0, sessions: 0 }),
    ]);

    return { articles, realisations, aiMemory };
  });
