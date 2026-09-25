import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { Conversation, ConversationStatus, Message, MessageRole } from "@/lib/ai/contracts";

export type ConversationRole = MessageRole;

export interface ConversationContext {
  sessionId: string;
  userId?: string;
}

export interface AddMessageInput {
  role: ConversationRole;
  content: string;
  metadata?: Record<string, unknown>;
}

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export class ConversationNotFoundError extends Error {
  readonly conversationId: string;
  constructor(conversationId: string) {
    // Intentionally vague: a foreign conversation must look identical to a
    // missing one so callers never reveal existence across sessions.
    super("Conversation not found");
    this.name = "ConversationNotFoundError";
    this.conversationId = conversationId;
  }
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status as ConversationStatus,
    messages: [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    metadata: (row.metadata as Conversation["metadata"]) ?? undefined,
  };
}

function mapMessage(m: MessageRow): Message {
  const base = {
    id: m.id,
    content: m.content,
    timestamp: new Date(m.created_at).getTime(),
  };
  switch (m.role) {
    case "assistant":
      return { ...base, role: "assistant" as const };
    case "system":
      return { ...base, role: "system" as const };
    case "tool":
      return {
        ...base,
        role: "tool" as const,
        toolCallId: m.tool_call_id ?? "",
        toolName: m.tool_name ?? "",
      };
    case "user":
    default:
      return { ...base, role: "user" as const };
  }
}

/**
 * Conversation domain service — mechanical history (ephemeral), NOT agent
 * memory (see memory-service) and NOT the RAG knowledge base.
 *
 * Runs on the service-role client: RLS never applies here, so EVERY query
 * filters on session_id. Ownership is enforced by construction; a
 * conversation owned by another session is indistinguishable from a
 * missing one (ConversationNotFoundError, never 403 inside this module —
 * HTTP mapping is the caller's job).
 */
export async function getOrCreateConversation(ctx: ConversationContext): Promise<Conversation> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from("conversations")
    .select("*")
    .eq("session_id", ctx.sessionId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message ?? "Database error");
  if (existing) return mapConversation(existing);

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ session_id: ctx.sessionId, status: "active" })
    .select()
    .single();

  if (!insertError && created) return mapConversation(created);

  // 23505: lost a creation race against the partial unique index
  // uq_conversations_one_active_per_session — re-select the winner.
  if (insertError && (insertError as { code?: string }).code === "23505") {
    const { data: winner, error: retryError } = await supabase
      .from("conversations")
      .select("*")
      .eq("session_id", ctx.sessionId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!retryError && winner) return mapConversation(winner);
    throw new Error(retryError?.message ?? "Database error");
  }

  throw new Error(insertError?.message ?? "Database error");
}

async function requireOwnedConversationId(
  ctx: ConversationContext,
  conversationId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("session_id", ctx.sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Database error");
  if (!data) throw new ConversationNotFoundError(conversationId);
  return data.id;
}

export async function getConversationHistory(
  ctx: ConversationContext,
  conversationId: string,
  limit = 50,
): Promise<Message[]> {
  const ownedId = await requireOwnedConversationId(ctx, conversationId);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", ownedId)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw new Error(error.message ?? "Database error");
  return (data ?? []).map(mapMessage);
}

export async function getLastNMessages(
  ctx: ConversationContext,
  conversationId: string,
  n: number,
): Promise<Message[]> {
  const ownedId = await requireOwnedConversationId(ctx, conversationId);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", ownedId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(n, 200)));

  if (error) throw new Error(error.message ?? "Database error");
  return (data ?? []).map(mapMessage).reverse();
}

export async function addMessage(
  ctx: ConversationContext,
  conversationId: string,
  input: AddMessageInput,
): Promise<Message> {
  const ownedId = await requireOwnedConversationId(ctx, conversationId);
  const supabase = getSupabaseAdmin();

  // conversations.updated_at is bumped transactionally by the Postgres
  // trigger messages_update_conversation_timestamp (migration 008) —
  // no second query, no client-side transaction needed.
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: ownedId,
      role: input.role,
      content: input.content,
      metadata: (input.metadata ?? {}) as MessageRow["metadata"],
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Database error");
  return mapMessage(data);
}

export async function updateConversationStatus(
  ctx: ConversationContext,
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("session_id", ctx.sessionId)
    .select("id");

  if (error) throw new Error(error.message ?? "Database error");
  if (!data || data.length === 0) throw new ConversationNotFoundError(conversationId);
}
