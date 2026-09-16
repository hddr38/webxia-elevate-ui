import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminAuthorId } from "@/lib/auth/session";
import { createMemoryService } from "@/lib/ai/memory/memory-service";
import { sanitizeOrSearchTerm } from "@/lib/utils";
import { mapDatabaseError, throwNotFound } from "@/lib/admin/errors";
import {
  ListMemoriesSchema,
  CreateMemorySchema,
  UpdateMemorySchema,
  AdminIdSchema,
  MemoryTypeSchema,
} from "@/lib/admin/schemas";

// List AI memory entries (admin — protégé, cross-session légitime)
export const getMemories = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => ListMemoriesSchema.parse(data))
  .handler(async ({ data }) => {
    const service = createMemoryService(getSupabaseAdmin());
    try {
      const memoryType =
        data.memory_type && data.memory_type !== "all"
          ? MemoryTypeSchema.parse(data.memory_type)
          : undefined;
      const search = data.search ? sanitizeOrSearchTerm(data.search) : "";
      return await service.listMemoryRows(
        {
          sessionId: data.session_id,
          memoryType,
          search: search || undefined,
        },
        data.page ?? 1,
        data.limit ?? 50,
      );
    } catch (error) {
      if (error instanceof Response) throw error;
      mapDatabaseError(
        { message: error instanceof Error ? error.message : "Database error" },
        "Mémoire IA",
      );
    }
  });

// Get single memory entry (admin — protégé)
export const getMemory = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const service = createMemoryService(getSupabaseAdmin());
    try {
      return await service.getMemoryRow(id);
    } catch (error) {
      if (error instanceof Response) throw error;
      mapDatabaseError(
        { message: error instanceof Error ? error.message : "Database error" },
        "Mémoire IA",
      );
    }
    throwNotFound("Mémoire IA");
  });

// Create memory entry (admin)
export const createMemory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => CreateMemorySchema.parse(data))
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

// Update memory entry (admin)
export const updateMemory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => UpdateMemorySchema.parse(data))
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

// Delete memory entry (admin)
export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const service = createMemoryService(getSupabaseAdmin());
    await service.deleteMemoryRow(id, userId);
    return { success: true };
  });

// Delete all memories for a session (admin)
export const deleteSessionMemories = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { session_id: string })?.session_id))
  .handler(async ({ data: sessionId, context }) => {
    const userId = await getAdminAuthorId(context.request as Request);
    if (!userId) throw new Response("Unauthorized", { status: 401 });

    const service = createMemoryService(getSupabaseAdmin());
    await service.deleteSessionMemoryRows(sessionId, userId);
    return { success: true };
  });

// Get stats (admin — protégé)
export const getMemoryStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const service = createMemoryService(getSupabaseAdmin());
    return service.getMemoryStats();
  });
