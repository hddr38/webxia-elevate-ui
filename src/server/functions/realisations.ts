import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { slugify, sanitizeIlike, getPaginationParams, buildPaginatedResponse, prepareSlugAndPublish } from "@/lib/utils";
import { getAdminAuthorId } from "@/lib/auth/session";
import type { CreateRealisationInput, UpdateRealisationInput } from "@/types/database";

// List realisations with optional filters
export const getRealisations = createServerFn({ method: "GET" })
  .validator(
    (data: {
      status?: string;
      search?: string;
      featured?: boolean;
      page?: number;
      limit?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    let query = getSupabaseAdmin()
      .from("realisations")
      .select("*", { count: "exact" })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status as "draft" | "published" | "archived");
    }

    if (data.featured !== undefined) {
      query = query.eq("featured", data.featured);
    }

    if (data.search) {
      const search = sanitizeIlike(data.search);
      query = query.or(
        `title.ilike.%${search}%,short_description.ilike.%${search}%,client_name.ilike.%${search}%`,
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data: realisations, error, count } = await query;

    if (error) throw new Error(error.message);

    return buildPaginatedResponse(realisations, count, page, limit);
  });

// Get single realisation by id
export const getRealisation = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { data: realisation, error } = await getSupabaseAdmin()
      .from("realisations")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return realisation!;
  });

// Create realisation
export const createRealisation = createServerFn({ method: "POST" })
  .validator((data: CreateRealisationInput) => data)
  .handler(async ({ data, context }: any) => {
    const { slug, publishedAt } = prepareSlugAndPublish(data);
    const authorId = await getAdminAuthorId(context);

    const { data: realisation, error } = await getSupabaseAdmin()
      .from("realisations")
      .insert({
        ...data,
        slug,
        author_id: authorId,
        published_at: publishedAt,
        short_description: data.short_description ?? null,
        description_html: data.description_html ?? null,
        client_name: data.client_name ?? null,
        project_url: data.project_url ?? null,
        github_url: data.github_url ?? null,
        cover_image_url: data.cover_image_url ?? null,
        gallery_images: data.gallery_images ?? [],
        technologies: data.technologies ?? [],
        meta_title: data.meta_title ?? null,
        meta_description: data.meta_description ?? null,
        featured: data.featured ?? false,
        sort_order: data.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return realisation!;
  });

// Update realisation
export const updateRealisation = createServerFn({ method: "POST" })
  .validator((data: UpdateRealisationInput) => data)
  .handler(async ({ data }: any) => {
    const { id, ...updates } = data;

    if (updates.status === "published") {
      const { data: existing } = await getSupabaseAdmin()
        .from("realisations")
        .select("published_at")
        .eq("id", id)
        .single();

      if (existing && !existing.published_at) {
        (updates as Record<string, unknown>).published_at = new Date().toISOString();
      }
    }

    const { data: realisation, error } = await getSupabaseAdmin()
      .from("realisations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return realisation!;
  });

// Get published realisations (public site)
export const getPublishedRealisations = createServerFn({ method: "GET" })
  .validator((data: { category?: string; featured?: boolean; page?: number; limit?: number }) => data)
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    const supabase = createPublicClient();
    let query = supabase
      .from("realisations")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (data.category && data.category !== "all") {
      query = query.contains("category", [data.category]);
    }

    if (data.featured !== undefined) {
      query = query.eq("featured", data.featured);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: realisations, error, count } = await query;

    if (error) throw new Error(error.message);

    return buildPaginatedResponse(realisations, count, page, limit);
  });

// Delete realisation
export const deleteRealisation = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }: any) => {
    const { error } = await getSupabaseAdmin().from("realisations").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
