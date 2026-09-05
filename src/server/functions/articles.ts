import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { slugify, sanitizeIlike, getPaginationParams, buildPaginatedResponse, prepareSlugAndPublish } from "@/lib/utils";
import { getAdminAuthorId } from "@/lib/auth/session";
import type { CreateArticleInput, UpdateArticleInput } from "@/types/database";

// List articles with optional filters
export const getArticles = createServerFn({ method: "GET" })
  .validator((data: { status?: string; search?: string; page?: number; limit?: number }) => data)
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    let query = getSupabaseAdmin()
      .from("articles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status as "draft" | "published" | "archived");
    }

    if (data.search) {
      const search = sanitizeIlike(data.search);
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) throw new Error(error.message);

    return buildPaginatedResponse(articles, count, page, limit);
  });

// Get single article by id
export const getArticle = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { data: article, error } = await getSupabaseAdmin()
      .from("articles")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return article!;
  });

// Get single article by slug (public)
export const getArticleBySlug = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: article, error } = await supabase
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .single();

    if (error) throw new Error(error.message);
    return article!;
  });

// Create article
export const createArticle = createServerFn({ method: "POST" })
  .validator((data: CreateArticleInput) => data)
  .handler(async ({ data, context }: any) => {
    const { slug, publishedAt } = prepareSlugAndPublish(data);
    const authorId = await getAdminAuthorId(context);

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
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return article!;
  });

// Update article
export const updateArticle = createServerFn({ method: "POST" })
  .validator((data: UpdateArticleInput) => data)
  .handler(async ({ data }: any) => {
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

    if (error) throw new Error(error.message);
    return article!;
  });

// Get published articles (public site)
export const getPublishedArticles = createServerFn({ method: "GET" })
  .validator((data: { category?: string; page?: number; limit?: number }) => data)
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    const supabase = createPublicClient();
    let query = supabase
      .from("articles")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.category && data.category !== "all") {
      query = query.contains("category", [data.category]);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) throw new Error(error.message);

    return buildPaginatedResponse(articles, count, page, limit);
  });

// Delete article
export const deleteArticle = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }: any) => {
    const { error } = await getSupabaseAdmin().from("articles").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
