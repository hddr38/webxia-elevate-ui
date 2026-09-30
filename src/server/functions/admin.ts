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
  for (const r of [totalRes, publishedRes, draftsRes]) {
    if (r.error) throw new Error(`articles count failed: ${r.error.message}`);
  }
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
  for (const r of [totalRes, publishedRes, draftsRes, featuredRes]) {
    if (r.error) throw new Error(`realisations count failed: ${r.error.message}`);
  }
  return {
    total: totalRes.count ?? 0,
    published: publishedRes.count ?? 0,
    drafts: draftsRes.count ?? 0,
    featured: featuredRes.count ?? 0,
  };
}

async function getMemoryStatsFallback() {
  const admin = getSupabaseAdmin();
  const { count: total, error: totalErr } = await admin
    .from("ai_memory")
    .select("id", { count: "exact", head: true });
  if (totalErr) throw new Error(`ai_memory total count failed: ${totalErr.message}`);

  const sessions = new Set<string>();
  const pageSize = 2000;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("ai_memory")
      .select("session_id")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`ai_memory sessions page ${page} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) sessions.add(row.session_id);
    if (data.length < pageSize) break;
  }
  return { total: total ?? 0, sessions: sessions.size };
}

export async function handleGetAdminStats() {
  const admin = getSupabaseAdmin();
  // Articles stats - single query with conditional aggregation
  const { data: articlesAgg, error: articlesError } = await admin.rpc("get_articles_stats");

  // Réalisations stats - single query with conditional aggregation
  const { data: realisationsAgg, error: realisationsError } =
    await admin.rpc("get_realisations_stats");

  // AI Memory stats - single query
  const { data: memoryAgg, error: memoryError } = await admin.rpc("get_memory_stats");

  // Helper: is "function not found" error (PGRST202 / 42883)
  const isFunctionMissing = (err: { code?: string } | null) =>
    err?.code === "PGRST202" || err?.code === "42883";

  // Articles: RPC error handling
  if (articlesError && !isFunctionMissing(articlesError)) {
    throw new Error(`get_articles_stats RPC failed: ${articlesError.message}`);
  }
  // Réalisations: RPC error handling
  if (realisationsError && !isFunctionMissing(realisationsError)) {
    throw new Error(`get_realisations_stats RPC failed: ${realisationsError.message}`);
  }
  // Memory: RPC error handling
  if (memoryError && !isFunctionMissing(memoryError)) {
    throw new Error(`get_memory_stats RPC failed: ${memoryError.message}`);
  }

  const [articles, realisations, aiMemory] = await Promise.all([
    articlesError || !articlesAgg ? getArticlesStatsFallback() : Promise.resolve(articlesAgg),
    realisationsError || !realisationsAgg
      ? getRealisationsStatsFallback()
      : Promise.resolve(realisationsAgg),
    memoryError || !memoryAgg ? getMemoryStatsFallback() : Promise.resolve(memoryAgg),
  ]);

  return { articles, realisations, aiMemory };
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => handleGetAdminStats());
