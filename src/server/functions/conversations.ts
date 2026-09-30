import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";

// Exposes the raw Request to handlers (kept exported for health.ts and future
// SSR needs), following the same pattern as adminMiddleware in @/lib/auth/middleware.
export const requestMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => next({ context: { request } }),
);

const ConversationStatusSchema = z.enum(["active", "archived", "closed"]);

const CreateConversationSchema = z.object({
  session_id: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

const GetConversationSchema = z.object({
  session_id: z.string().uuid(),
  id: z.string().uuid(),
});

const ListConversationsSchema = z.object({
  session_id: z.string().uuid(),
  status: ConversationStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

const UpdateConversationStatusSchema = z.object({
  session_id: z.string().uuid(),
  id: z.string().uuid(),
  status: ConversationStatusSchema,
});

const DeleteConversationSchema = z.object({
  session_id: z.string().uuid(),
  id: z.string().uuid(),
});

const AppendMessageSchema = z.object({
  session_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1).max(100_000),
  tool_calls: z.array(z.unknown()).optional(),
  tool_call_id: z.string().optional(),
  tool_name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ListMessagesSchema = z.object({
  session_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type GetConversationInput = z.infer<typeof GetConversationSchema>;
export type ListConversationsInput = z.infer<typeof ListConversationsSchema>;
export type UpdateConversationStatusInput = z.infer<typeof UpdateConversationStatusSchema>;
export type DeleteConversationInput = z.infer<typeof DeleteConversationSchema>;
export type AppendMessageInput = z.infer<typeof AppendMessageSchema>;
export type ListMessagesInput = z.infer<typeof ListMessagesSchema>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Webi session id is the ONLY ownership key (ADR-006). It travels in the
 * validated payload: the `webi_session` cookie is never set by the client, and
 * the anon JWT carries no `session_id` claim with the modern `sb_*` keys.
 * A missing/malformed session id is an auth failure (401), never a 403 — and
 * never a silent pass.
 */
export function resolveSessionId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Response("Unauthorized: No session", { status: 401 });
  }
  return value;
}

/**
 * 404 (not 403) for a conversation that is missing OR owned by another
 * session: existence of a foreign id must never leak.
 */
function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

type ConversationRow = {
  id: string;
  session_id: string;
  status: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

type MessageTitleRow = { conversation_id: string; content: string };

/**
 * Pure derivation of a display title: the first `user` message of the
 * conversation (messages arrive ordered by created_at ASC). Conversations
 * without a user message get `null` → the UI falls back to the translated
 * "new conversation" label. Kept pure so it is unit-testable without a DB.
 */
export function withConversationTitle<T extends { id: string }>(
  conversations: T[],
  messages: MessageTitleRow[],
): Array<T & { title: string | null }> {
  const firstUserMessage = new Map<string, string>();
  for (const message of messages) {
    if (firstUserMessage.has(message.conversation_id)) continue;
    const content = message.content.trim();
    if (!content) continue;
    firstUserMessage.set(message.conversation_id, content);
  }
  return conversations.map((conversation) => ({
    ...conversation,
    title: firstUserMessage.get(conversation.id) ?? null,
  }));
}

/** Ownership check shared by every read/write on an existing conversation. */
async function assertConversationOwnership(
  conversationId: string,
  sessionId: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!conversation) throw notFound();
}

export async function handleCreateConversation(
  data: CreateConversationInput,
): Promise<ConversationRow> {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  // uq_conversations_one_active_per_session: exactly one ACTIVE row per
  // session. Archive the previous active conversation first instead of
  // dropping the constraint (schema.sql + migration stay in sync).
  const { error: archiveError } = await supabase
    .from("conversations")
    .update({ status: "archived" })
    .eq("session_id", sessionId)
    .eq("status", "active");
  if (archiveError) throw new Error(archiveError.message);

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      session_id: sessionId,
      // jsonb column: zod-validated free-form object serialized as JSON.
      metadata: (data.metadata ?? {}) as Json,
      status: "active",
    })
    .select()
    .single();

  if (!error && conversation) return conversation;

  // 23505: a concurrent create won the archive race — adopt the winner
  // instead of surfacing a raw constraint error to the client.
  if (error && error.code === "23505") {
    const { data: winner, error: winnerError } = await supabase
      .from("conversations")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (winnerError) throw new Error(winnerError.message);
    if (winner) return winner;
  }

  throw new Error(error?.message ?? "Database error");
}

export async function handleGetConversation(data: GetConversationInput): Promise<ConversationRow> {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", data.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!conversation) throw notFound();
  return conversation;
}

export async function handleListConversations(data: ListConversationsInput) {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  const page = data.page ?? 1;
  const limit = data.limit ?? 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("conversations")
    .select("*", { count: "exact" })
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });

  if (data.status) {
    query = query.eq("status", data.status);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: conversations, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (conversations ?? []) as ConversationRow[];
  let items: Array<ConversationRow & { title: string | null }> = rows.map((conversation) => ({
    ...conversation,
    title: null,
  }));

  if (rows.length > 0) {
    const { data: firstMessages, error: messagesError } = await supabase
      .from("messages")
      .select("conversation_id, content")
      .in(
        "conversation_id",
        rows.map((conversation) => conversation.id),
      )
      .eq("role", "user")
      .order("created_at", { ascending: true });

    if (messagesError) throw new Error(messagesError.message);
    items = withConversationTitle(rows, (firstMessages ?? []) as MessageTitleRow[]);
  }

  return {
    data: items,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function handleAppendMessage(data: AppendMessageInput) {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  await assertConversationOwnership(data.conversation_id, sessionId);

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: data.conversation_id,
      role: data.role,
      content: data.content,
      // jsonb columns: zod-validated values serialized as JSON.
      tool_calls: (data.tool_calls ?? null) as Json,
      tool_call_id: data.tool_call_id ?? null,
      tool_name: data.tool_name ?? null,
      metadata: (data.metadata ?? {}) as Json,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return message;
}

export async function handleListMessages(data: ListMessagesInput) {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  await assertConversationOwnership(data.conversation_id, sessionId);

  const page = data.page ?? 1;
  const limit = data.limit ?? 50;
  const offset = (page - 1) * limit;

  const {
    data: messages,
    error,
    count,
  } = await supabase
    .from("messages")
    .select("*", { count: "exact" })
    .eq("conversation_id", data.conversation_id)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return {
    data: messages ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function handleUpdateConversationStatus(
  data: UpdateConversationStatusInput,
): Promise<ConversationRow> {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  await assertConversationOwnership(data.id, sessionId);

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({ status: data.status })
    .eq("id", data.id)
    .eq("session_id", sessionId)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw notFound();
  return updated;
}

export async function handleDeleteConversation(
  data: DeleteConversationInput,
): Promise<{ success: true }> {
  const sessionId = resolveSessionId(data.session_id);
  const supabase = getSupabaseAdmin();

  await assertConversationOwnership(data.id, sessionId);

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", data.id)
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);

  return { success: true };
}

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => CreateConversationSchema.parse(data))
  .handler(({ data }) => handleCreateConversation(data));

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => GetConversationSchema.parse(data))
  .handler(({ data }) => handleGetConversation(data));

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => ListConversationsSchema.parse(data))
  .handler(({ data }) => handleListConversations(data));

export const appendMessage = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => AppendMessageSchema.parse(data))
  .handler(({ data }) => handleAppendMessage(data));

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => ListMessagesSchema.parse(data))
  .handler(({ data }) => handleListMessages(data));

export const updateConversationStatus = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => UpdateConversationStatusSchema.parse(data))
  .handler(({ data }) => handleUpdateConversationStatus(data));

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => DeleteConversationSchema.parse(data))
  .handler(({ data }) => handleDeleteConversation(data));
