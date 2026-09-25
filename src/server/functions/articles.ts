import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import {
  sanitizeOrSearchTerm,
  getPaginationParams,
  buildPaginatedResponse,
  prepareSlugAndPublish,
} from "@/lib/utils";
import { getAdminAuthorId } from "@/lib/auth/session";
import { mapDatabaseError, throwNotFound } from "@/lib/admin/errors";
import {
  ListArticlesSchema,
  PublicArticlesSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  AdminIdSchema,
  SlugSchema,
} from "@/lib/admin/schemas";

// List articles (admin — drafts inclus, protégé)
export const getArticles = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => ListArticlesSchema.parse(data))
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    let query = getSupabaseAdmin()
      .from("articles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.search) {
      const search = sanitizeOrSearchTerm(data.search);
      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) mapDatabaseError(error, "Articles");

    return buildPaginatedResponse(articles, count, page, limit);
  });

// Get single article by id (admin — protégé)
export const getArticle = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const { data: article, error } = await getSupabaseAdmin()
      .from("articles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) mapDatabaseError(error, "Article");
    if (!article) throwNotFound("Article");
    return article!;
  });

// Get single article by slug (public — RLS published-only)
export const getArticleBySlug = createServerFn({ method: "GET" })
  .validator((data: unknown) => SlugSchema.parse((data as { slug: string })?.slug))
  .handler(async ({ data: slug }) => {
    const supabase = createPublicClient();
    const { data: article, error } = await supabase
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) mapDatabaseError(error, "Article");
    if (!article) throwNotFound("Article");
    return article!;
  });

// Create article (admin)
export const createArticle = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => CreateArticleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { slug, publishedAt } = prepareSlugAndPublish(data);
    const authorId = await getAdminAuthorId(context.request as Request);
    if (!authorId) throw new Response("Unauthorized", { status: 401 });

    const { data: article, error } = await getSupabaseAdmin()
      .from("articles")
      .insert({
        ...data,
        slug,
        author_id: authorId,
        published_at: publishedAt,
        content_html: data.content_html ?? null,
        excerpt: data.excerpt ?? null,
        meta_title: data.meta_title ?? null,
        meta_description: data.meta_description ?? null,
        cover_image_url: data.cover_image_url ?? null,
        tags: data.tags ?? [],
        category: data.category ?? [],
      })
      .select()
      .single();

    if (error) mapDatabaseError(error, "Article");
    return article!;
  });

// Update article (admin — author_id non modifiable côté client)
export const updateArticle = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => UpdateArticleSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...updates } = data;

    if (updates.status === "published") {
      const { data: existing } = await getSupabaseAdmin()
        .from("articles")
        .select("published_at")
        .eq("id", id)
        .single();

      if (existing && !existing.published_at) {
        (updates as Record<string, unknown>).published_at = new Date().toISOString();
      }
    }

    const { data: article, error } = await getSupabaseAdmin()
      .from("articles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) mapDatabaseError(error, "Article");
    if (!article) throwNotFound("Article");
    return article!;
  });

// Get published articles (public site — RLS)
export const getPublishedArticles = createServerFn({ method: "GET" })
  .validator((data: unknown) => PublicArticlesSchema.parse(data))
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    const supabase = createPublicClient();
    let query = supabase
      .from("articles")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.category && data.category !== "all") {
      query = query.contains("category", [data.category.trim().slice(0, 120)]);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) mapDatabaseError(error, "Articles");

    return buildPaginatedResponse(articles, count, page, limit);
  });

// Delete article (admin)
export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const { error } = await getSupabaseAdmin().from("articles").delete().eq("id", id);

    if (error) mapDatabaseError(error, "Article");
    return { success: true };
  });
