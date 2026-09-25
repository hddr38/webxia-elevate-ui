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
  ListRealisationsSchema,
  PublicRealisationsSchema,
  CreateRealisationSchema,
  UpdateRealisationSchema,
  AdminIdSchema,
  SlugSchema,
} from "@/lib/admin/schemas";

// List realisations (admin — drafts inclus, protégé)
export const getRealisations = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => ListRealisationsSchema.parse(data))
  .handler(async ({ data }) => {
    const { page, limit, offset } = getPaginationParams(data);

    let query = getSupabaseAdmin()
      .from("realisations")
      .select("*", { count: "exact" })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.featured !== undefined) {
      query = query.eq("featured", data.featured);
    }

    if (data.search) {
      const search = sanitizeOrSearchTerm(data.search);
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,short_description.ilike.%${search}%,client_name.ilike.%${search}%`,
        );
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data: realisations, error, count } = await query;

    if (error) mapDatabaseError(error, "Réalisations");

    return buildPaginatedResponse(realisations, count, page, limit);
  });

// Get single realisation by id (admin — protégé)
export const getRealisation = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const { data: realisation, error } = await getSupabaseAdmin()
      .from("realisations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) mapDatabaseError(error, "Réalisation");
    if (!realisation) throwNotFound("Réalisation");
    return realisation!;
  });

// Get single realisation by slug (public — RLS published-only)
export const getRealisationBySlug = createServerFn({ method: "GET" })
  .validator((data: unknown) => SlugSchema.parse((data as { slug: string })?.slug))
  .handler(async ({ data: slug }) => {
    const supabase = createPublicClient();
    const { data: realisation, error } = await supabase
      .from("realisations")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) mapDatabaseError(error, "Réalisation");
    if (!realisation) throwNotFound("Réalisation");
    return realisation!;
  });

// Create realisation (admin)
export const createRealisation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => CreateRealisationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { slug, publishedAt } = prepareSlugAndPublish(data);
    const authorId = await getAdminAuthorId(context.request as Request);
    if (!authorId) throw new Response("Unauthorized", { status: 401 });

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
        category: data.category ?? [],
        meta_title: data.meta_title ?? null,
        meta_description: data.meta_description ?? null,
        featured: data.featured ?? false,
        sort_order: data.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) mapDatabaseError(error, "Réalisation");
    return realisation!;
  });

// Update realisation (admin — author_id non modifiable côté client)
export const updateRealisation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => UpdateRealisationSchema.parse(data))
  .handler(async ({ data }) => {
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

    if (error) mapDatabaseError(error, "Réalisation");
    if (!realisation) throwNotFound("Réalisation");
    return realisation!;
  });

// Get published realisations (public site — RLS)
export const getPublishedRealisations = createServerFn({ method: "GET" })
  .validator((data: unknown) => PublicRealisationsSchema.parse(data))
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
      query = query.contains("category", [data.category.trim().slice(0, 120)]);
    }

    if (data.featured !== undefined) {
      query = query.eq("featured", data.featured);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: realisations, error, count } = await query;

    if (error) mapDatabaseError(error, "Réalisations");

    return buildPaginatedResponse(realisations, count, page, limit);
  });

// Delete realisation (admin)
export const deleteRealisation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => AdminIdSchema.parse((data as { id: string })?.id))
  .handler(async ({ data: id }) => {
    const { error } = await getSupabaseAdmin().from("realisations").delete().eq("id", id);

    if (error) mapDatabaseError(error, "Réalisation");
    return { success: true };
  });
