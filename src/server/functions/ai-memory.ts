import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminAuthorId } from "@/lib/auth/session";
import { createMemoryService } from "@/lib/ai/memory/memory-service";
import type { AIMemoryType } from "@/types/database";

// Admin context: service-role is retained deliberately (see report).
// These endpoints serve /admin/ai-memory, whose legitimate reads span
// sessions; the anon+RLS path (owner-only) would deny them. Authorization
// stays explicit via the admin session (user_id scoping on every
// write/delete) without weakening any RLS policy.

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
    const service = createMemoryService(getSupabaseAdmin());
    return service.listMemoryRows(
      {
        sessionId: data.session_id,
        memoryType:
          data.memory_type && data.memory_type !== "all"
            ? (data.memory_type as "conversation" | "context" | "knowledge" | "preference")
            : undefined,
        search: data.search,
      },
      data.page ?? 1,
      data.limit ?? 50,
    );
  });

// Get single memory entry
export const getMemory = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const service = createMemoryService(getSupabaseAdmin());
    return service.getMemoryRow(data.id);
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
  .handler(async ({ data, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const service = createMemoryService(getSupabaseAdmin());
    return service.createMemoryRow({
      sessionId: data.session_id,
      userId,
      memoryType: data.memory_type,
      key: data.key,
      value: data.value,
      metadata: data.metadata,
      expiresAt: data.expires_at,
    });
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
  .handler(async ({ data, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const { id, ...updates } = data;
    const service = createMemoryService(getSupabaseAdmin());
    return service.updateMemoryRow(id, userId, {
      key: updates.key,
      value: updates.value,
      metadata: updates.metadata,
      expiresAt: updates.expires_at,
    });
  });

// Delete memory entry
export const deleteMemory = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const service = createMemoryService(getSupabaseAdmin());
    await service.deleteMemoryRow(data.id, userId);
    return { success: true };
  });

// Delete all memories for a session
export const deleteSessionMemories = createServerFn({ method: "POST" })
  .validator((data: { session_id: string }) => data)
  .handler(async ({ data, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const service = createMemoryService(getSupabaseAdmin());
    await service.deleteSessionMemoryRows(data.session_id, userId);
    return { success: true };
  });

// Get stats
export const getMemoryStats = createServerFn({ method: "GET" }).handler(async () => {
  const service = createMemoryService(getSupabaseAdmin());
  return service.getMemoryStats();
});
