import { z } from "zod";

// --- Primitives partagées (client + serveur) ---

export const AdminIdSchema = z.string().uuid("Identifiant invalide");

export const AdminPageSchema = z.coerce.number().int().min(1).default(1);

export const AdminLimitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const AdminSearchSchema = z
  .string()
  .trim()
  .max(100, "Recherche trop longue (100 caractères max)")
  .optional();

export const ArticleStatusFilterSchema = z
  .enum(["all", "draft", "published", "archived"])
  .default("all");

export const ArticleStatusSchema = z.enum(["draft", "published", "archived"]);

export const RealisationStatusSchema = z.enum(["draft", "published", "archived"]);

export const MemoryTypeSchema = z.enum(["conversation", "context", "knowledge", "preference"]);

export const MemoryTypeFilterSchema = z.union([MemoryTypeSchema, z.literal("all")]).default("all");

// Champs texte courants : on accepte les chaînes vides du formulaire,
// on normalise en trim côté serveur.
const OptionalText = z.string().trim().max(5000).optional();
const OptionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .refine((v) => !v || v.length === 0 || /^https?:\/\/.+/i.test(v), {
    message: "URL invalide (doit commencer par http:// ou https://)",
  });
const StringArray = z.array(z.string().trim().min(1).max(120)).max(50).default([]);

// --- Listes ---

export const ListArticlesSchema = z.object({
  status: ArticleStatusFilterSchema.optional(),
  search: AdminSearchSchema,
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const ListRealisationsSchema = z.object({
  status: ArticleStatusFilterSchema.optional(),
  search: AdminSearchSchema,
  featured: z.coerce.boolean().optional(),
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const ListMemoriesSchema = z.object({
  session_id: z.string().uuid("Session invalide").optional(),
  memory_type: z.string().max(32).optional(),
  search: AdminSearchSchema,
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const PublicArticlesSchema = z.object({
  category: z.string().trim().max(120).optional(),
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const PublicRealisationsSchema = z.object({
  category: z.string().trim().max(120).optional(),
  featured: z.coerce.boolean().optional(),
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Slug invalide");

// --- Articles : create / update (author_id exclu -> injecté serveur) ---

export const CreateArticleSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200),
  // Absent = génération auto serveur ; fourni vide = rejeté (un slug vide
  // rendrait la page publique injoignable : lien mort silencieux).
  slug: z
    .string()
    .trim()
    .max(220)
    .optional()
    .refine((v) => v === undefined || v.length > 0, {
      message: "Slug invalide (laissez le champ vide pour génération automatique)",
    }),
  excerpt: OptionalText,
  content_md: z.string().trim().min(1, "Contenu requis").max(200_000),
  content_html: z.string().max(500_000).optional().nullable(),
  cover_image_url: OptionalUrl,
  status: ArticleStatusSchema.default("draft"),
  tags: StringArray.optional(),
  category: StringArray.optional(),
  reading_minutes: z.coerce.number().int().min(0).max(600).default(5),
  meta_title: z.string().trim().max(160).optional(),
  meta_description: z.string().trim().max(320).optional(),
});

export const UpdateArticleSchema = CreateArticleSchema.partial().extend({
  id: AdminIdSchema,
});

// --- Réalisations : create / update ---

export const CreateRealisationSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200),
  // Absent = génération auto serveur ; fourni vide = rejeté (un slug vide
  // rendrait la page publique injoignable : lien mort silencieux).
  slug: z
    .string()
    .trim()
    .max(220)
    .optional()
    .refine((v) => v === undefined || v.length > 0, {
      message: "Slug invalide (laissez le champ vide pour génération automatique)",
    }),
  short_description: OptionalText,
  description_md: z.string().trim().min(1, "Description requise").max(200_000),
  description_html: z.string().max(500_000).optional().nullable(),
  client_name: z.string().trim().max(200).optional(),
  project_url: OptionalUrl,
  github_url: OptionalUrl,
  cover_image_url: OptionalUrl,
  gallery_images: z.array(z.string().trim().min(1).max(2048)).max(30).default([]),
  status: RealisationStatusSchema.default("draft"),
  featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(1_000_000).default(0),
  technologies: StringArray.optional(),
  category: StringArray.optional(),
  meta_title: z.string().trim().max(160).optional(),
  meta_description: z.string().trim().max(320).optional(),
});

export const UpdateRealisationSchema = CreateRealisationSchema.partial().extend({
  id: AdminIdSchema,
});

// --- AI Memory : create / update ---

const StringMap = z.record(z.string(), z.string());

export const CreateMemorySchema = z.object({
  session_id: z.string().uuid("Session invalide"),
  memory_type: MemoryTypeSchema,
  key: z.string().trim().min(1, "Clé requise").max(220),
  value: StringMap,
  metadata: StringMap.optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export const UpdateMemorySchema = z.object({
  id: AdminIdSchema,
  key: z.string().trim().min(1).max(220).optional(),
  value: StringMap.optional(),
  metadata: StringMap.optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type ListArticlesInput = z.infer<typeof ListArticlesSchema>;
export type ListRealisationsInput = z.infer<typeof ListRealisationsSchema>;
export type ListMemoriesInput = z.infer<typeof ListMemoriesSchema>;

// --- Dashboard stats (réponse getAdminStats, validée côté client) ---

const CountBlockSchema = z.object({
  total: z.coerce.number().int().min(0).default(0),
  published: z.coerce.number().int().min(0).default(0),
  drafts: z.coerce.number().int().min(0).default(0),
});

export const AdminStatsSchema = z.object({
  articles: CountBlockSchema.default({ total: 0, published: 0, drafts: 0 }),
  realisations: CountBlockSchema.extend({
    featured: z.coerce.number().int().min(0).default(0),
  }).default({ total: 0, published: 0, drafts: 0, featured: 0 }),
  aiMemory: z
    .object({
      total: z.coerce.number().int().min(0).default(0),
      sessions: z.coerce.number().int().min(0).default(0),
    })
    .default({ total: 0, sessions: 0 }),
});

export type AdminStats = z.infer<typeof AdminStatsSchema>;
