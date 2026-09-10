import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { z } from "zod";

// Exposes the raw Request to handlers (cookies for session id + SSR Supabase client),
// following the same pattern as adminMiddleware in @/lib/auth/middleware.
export const requestMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => next({ context: { request } }),
);

const ConversationStatusSchema = z.enum(["active", "archived", "closed"]);

const CreateConversationSchema = z.object({
  session_id: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

const GetConversationSchema = z.object({
  id: z.string().uuid(),
});

const ListConversationsSchema = z.object({
  session_id: z.string().uuid(),
  status: ConversationStatusSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

const UpdateConversationStatusSchema = z.object({
  id: z.string().uuid(),
  status: ConversationStatusSchema,
});

const DeleteConversationSchema = z.object({
  id: z.string().uuid(),
});

const AppendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1).max(100_000),
  tool_calls: z.array(z.unknown()).optional(),
  tool_call_id: z.string().optional(),
  tool_name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ListMessagesSchema = z.object({
  conversation_id: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

async function getSessionIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      acc[name] = rest.join("=");
      return acc;
    },
    {} as Record<string, string>,
  );

  const sessionCookie = cookies["webi_session"];
  if (sessionCookie) {
    try {
      return JSON.parse(decodeURIComponent(sessionCookie)).session_id;
    } catch {
      return null;
    }
  }
  return null;
}

function validateSessionAccess(sessionId: string, requestSessionId: string): void {
  if (sessionId !== requestSessionId) {
    throw new Response("Forbidden: Session mismatch", { status: 403 });
  }
}

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => CreateConversationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    validateSessionAccess(data.session_id, requestSessionId);

    const supabase = createSupabaseServerClient(request);
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        session_id: data.session_id,
        // jsonb column: zod-validated free-form object serialized as JSON.
        metadata: (data.metadata ?? {}) as Json,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return conversation;
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => GetConversationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    const supabase = createSupabaseServerClient(request);
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    if (!conversation) throw new Response("Not found", { status: 404 });

    validateSessionAccess(conversation.session_id, requestSessionId);
    return conversation;
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => ListConversationsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    validateSessionAccess(data.session_id, requestSessionId);

    const supabase = createSupabaseServerClient(request);
    const page = data.page ?? 1;
    const limit = data.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("conversations")
      .select("*", { count: "exact" })
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: false });

    if (data.status) {
      query = query.eq("status", data.status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: conversations, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      data: conversations ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  });

export const appendMessage = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => AppendMessageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    const supabase = createSupabaseServerClient(request);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("session_id")
      .eq("id", data.conversation_id)
      .single();

    if (convError) throw new Error(convError.message);
    if (!conversation) throw new Response("Conversation not found", { status: 404 });

    validateSessionAccess(conversation.session_id, requestSessionId);

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
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => ListMessagesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    const supabase = createSupabaseServerClient(request);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("session_id")
      .eq("id", data.conversation_id)
      .single();

    if (convError) throw new Error(convError.message);
    if (!conversation) throw new Response("Conversation not found", { status: 404 });

    validateSessionAccess(conversation.session_id, requestSessionId);

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
  });

export const updateConversationStatus = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => UpdateConversationStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    const supabase = createSupabaseServerClient(request);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("session_id")
      .eq("id", data.id)
      .single();

    if (convError) throw new Error(convError.message);
    if (!conversation) throw new Response("Conversation not found", { status: 404 });

    validateSessionAccess(conversation.session_id, requestSessionId);

    const { data: updated, error } = await supabase
      .from("conversations")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => DeleteConversationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const requestSessionId = await getSessionIdFromRequest(request);
    if (!requestSessionId) throw new Response("Unauthorized: No session", { status: 401 });

    const supabase = createSupabaseServerClient(request);

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("session_id")
      .eq("id", data.id)
      .single();

    if (convError) throw new Error(convError.message);
    if (!conversation) throw new Response("Conversation not found", { status: 404 });

    validateSessionAccess(conversation.session_id, requestSessionId);

    const { error } = await supabase.from("conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });
