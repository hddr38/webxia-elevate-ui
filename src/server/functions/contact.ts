import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeOrSearchTerm, getPaginationParams, buildPaginatedResponse } from "@/lib/utils";
import { createRateLimiter, getClientIdentifier } from "@/lib/ai/security/rate-limiter";
import { mapDatabaseError, throwNotFound } from "@/lib/admin/errors";
import {
  AdminIdSchema,
  ListContactMessagesSchema,
  SubmitContactMessageSchema,
  UpdateContactMessageStatusSchema,
} from "@/lib/admin/schemas";

// Anti-spam : 5 dépôts / minute / IP (compteur en mémoire par instance).
const contactLimiter = createRateLimiter("sliding-window", {
  windowMs: 60_000,
  maxRequests: 5,
  keyPrefix: "contact",
});

// Middleware public : injecte `request` dans le contexte (sans authentification).
// `context.request` n'existe que si un middleware le fournit (cf. adminMiddleware) :
// sans lui, getClientIdentifier() casserait sur `undefined.headers`.
const requestMiddleware = createMiddleware({ type: "request" }).server(async ({ request, next }) =>
  next({ context: { request } }),
);

// Dépôt public d'un brief (formulaire /contact, sans authentification).
export const submitContactMessage = createServerFn({ method: "POST" })
  .middleware([requestMiddleware])
  .validator((data: unknown) => SubmitContactMessageSchema.parse(data))
  .handler(async ({ data, context }) => {
    const request = context.request as Request;
    const check = await contactLimiter.checkLimit(getClientIdentifier(request));
    if (!check.allowed) {
      throw new Response("Too many requests", { status: 429 });
    }

    // Honeypot : les bots remplissent `website` → succès simulé, rien en base.
    if (data.website) return { ok: true as const };

    const { error } = await getSupabaseAdmin()
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        company: data.company || null,
        budget: data.budget || null,
        message: data.message,
        locale: data.locale,
      });

    if (error) {
      console.error("[contact] insert failed", error);
      throw new Response("Failed to save message", { status: 500 });
    }

    return { ok: true as const };
  });

// Liste des messages (admin — protégé)
export const getContactMessages = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => ListContactMessagesSchema.parse(data))
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    let query = getSupabaseAdmin()
      .from("contact_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.search) {
      const search = sanitizeOrSearchTerm(data.search);
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`,
        );
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data: messages, error, count } = await query;

    if (error) mapDatabaseError(error, "Messages");

    return buildPaginatedResponse(messages, count, page, limit);
  });

// Marquer un message lu / non lu (admin — protégé)
export const updateContactMessageStatus = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => UpdateContactMessageStatusSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: message, error } = await getSupabaseAdmin()
      .from("contact_messages")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();

    if (error) mapDatabaseError(error, "Message");
    if (!message) throwNotFound("Message");
    return message;
  });

// Supprimer un message (admin — protégé)
export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const { error } = await getSupabaseAdmin().from("contact_messages").delete().eq("id", id);

    if (error) mapDatabaseError(error, "Message");

    return { ok: true as const };
  });
