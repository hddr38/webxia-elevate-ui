import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminAuthorId } from "@/lib/auth/session";
import type { AIMemoryType } from "@/types/database";

// List AI memory entries
export const getMemories = createServerFn({ method: "GET" })
  .validator(
    (data: {
      session_id?: string;
      memory_type?: string;
      search?: string;
      page?: number;
      limit?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const page = data.page ?? 1;
    const limit = data.limit ?? 50;
    const offset = (page - 1) * limit;

    let query = getSupabaseAdmin()
      .from("ai_memory")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.session_id) {
      query = query.eq("session_id", data.session_id);
    }

    if (data.memory_type && data.memory_type !== "all") {
      query = query.eq("memory_type", data.memory_type as "conversation" | "context" | "knowledge" | "preference");
    }

    if (data.search) {
      query = query.or(`key.ilike.%${data.search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: memories, error, count } = await query;

    if (error) throw new Error(error.message);

    return {
      data: memories ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  });

// Get single memory entry
export const getMemory = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { data: memory, error } = await getSupabaseAdmin()
      .from("ai_memory")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return memory!;
  });

// Create memory entry
export const createMemory = createServerFn({ method: "POST" })
  .validator(
    (data: {
      session_id: string;
      memory_type: AIMemoryType;
      key: string;
      value: Record<string, string>;
      metadata?: Record<string, string>;
      expires_at?: string;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const userId = await getAdminAuthorId(context);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const { data: memory, error } = await getSupabaseAdmin()
      .from("ai_memory")
      .insert({
        ...data,
        user_id: userId,
        metadata: data.metadata ?? {},
        expires_at: data.expires_at ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return memory!;
  });

// Update memory entry
export const updateMemory = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      key?: string;
      value?: Record<string, string>;
      metadata?: Record<string, string>;
      expires_at?: string;
    }) => data,
  )
  .handler(async ({ data, context }: any) => {
    const userId = await getAdminAuthorId(context);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const { id, ...updates } = data;

    const { data: memory, error } = await getSupabaseAdmin()
      .from("ai_memory")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return memory!;
  });

// Delete memory entry
export const deleteMemory = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }: any) => {
    const userId = await getAdminAuthorId(context);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const { error } = await getSupabaseAdmin().from("ai_memory").delete().eq("id", data.id).eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// Delete all memories for a session
export const deleteSessionMemories = createServerFn({ method: "POST" })
  .validator((data: { session_id: string }) => data)
  .handler(async ({ data, context }: any) => {
    const userId = await getAdminAuthorId(context);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const { error } = await getSupabaseAdmin()
      .from("ai_memory")
      .delete()
      .eq("session_id", data.session_id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// Get stats
export const getMemoryStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getSupabaseAdmin().rpc("get_memory_stats");

  if (error) throw new Error(error.message);

  return data ?? { total: 0, sessions: 0, byType: [] };
});
