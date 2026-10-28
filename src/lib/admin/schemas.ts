import { z } from "zod";

// --- Primitives partagées (client + serveur) ---

export const AdminIdSchema = z.string().uuid("Identifiant invalide");

const AdminPageSchema = z.coerce.number().int().min(1).default(1);

const AdminLimitSchema = z.coerce.number().int().min(1).max(100).default(20);

const AdminSearchSchema = z
  .string()
  .trim()
  .max(100, "Recherche trop longue (100 caractères max)")
  .optional();

const ArticleStatusFilterSchema = z.enum(["all", "draft", "published", "archived"]).default("all");

const ArticleStatusSchema = z.enum(["draft", "published", "archived"]);

const RealisationStatusSchema = z.enum(["draft", "published", "archived"]);

export const MemoryTypeSchema = z.enum(["conversation", "context", "knowledge", "preference"]);

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
  scope: z.enum(["session", "global"]).optional(),
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

// --- Contact : dépôt public (honeypot `website` inclus, jamais persisté) ---

const ContactMessageStatusSchema = z.enum(["new", "read"]);

const ContactMessageStatusFilterSchema = z.enum(["all", "new", "read"]).default("all");

export const SubmitContactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  budget: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(["fr", "en"]).optional().default("fr"),
  website: z.string().max(500).optional().default(""),
});

export const ListContactMessagesSchema = z.object({
  status: ContactMessageStatusFilterSchema.optional(),
  search: AdminSearchSchema,
  page: AdminPageSchema.optional(),
  limit: AdminLimitSchema.optional(),
});

export const UpdateContactMessageStatusSchema = z.object({
  id: AdminIdSchema,
  status: ContactMessageStatusSchema,
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

// --- expires_at : datetime-local (saisie formulaire) <-> ISO UTC (API) ---
//
// FIX-MEMORY-DATE — cause racine : <input type="datetime-local"> produit
// "YYYY-MM-DDTHH:mm" (heure locale, sans secondes ni fuseau), alors que
// z.string().datetime({ offset: true }) exige "YYYY-MM-DDTHH:mm:ss" suivi d'un
// fuseau : toute saisie native était donc rejetée ("Invalid datetime"), y
// compris la chaîne vide d'un champ non rempli.
//
// Règle retenue :
//   - formulaire -> null | undefined | "" (-> null) | datetime-local strict ;
//   - API        -> null | undefined | "" (-> null) | ISO 8601 UTC ;
//   - formats locaux ambigus (28/06/2030, 06/28/2030…) volontairement rejetés.
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const EXPIRES_FORM_MESSAGE =
  "Date invalide. Format attendu : AAAA-MM-JJTHH:MM (sélecteur de date natif).";
const EXPIRES_API_MESSAGE =
  "Date d'expiration invalide (ISO 8601 attendu, ex. 2030-06-28T10:04:00.000Z).";

const emptyToNull = (value: string | null | undefined): string | null =>
  value === undefined || value === "" ? null : value;

// Saisie du formulaire (RHF) : la valeur reste au format datetime-local
// pendant toute la frappe ; la conversion ISO UTC n'a lieu qu'à la soumission.
export const ExpiresAtFormSchema = z
  .union([
    z.null(),
    z.undefined(),
    z.literal(""),
    z.string().regex(DATETIME_LOCAL_RE, EXPIRES_FORM_MESSAGE),
  ])
  .transform(emptyToNull);

// Payload create/update réellement envoyé à la Server Function.
export const ExpiresAtApiSchema = z
  .union([
    z.null(),
    z.undefined(),
    z.literal(""),
    z.string().datetime({ offset: true, message: EXPIRES_API_MESSAGE }),
  ])
  .transform(emptyToNull);

// datetime-local (heure locale) -> ISO UTC. Appelé au moment de la soumission,
// jamais pendant la saisie.
export function toExpiresAtIso(value: string | null | undefined): string | null {
  const normalized = emptyToNull(value);
  if (normalized === null) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ISO UTC -> valeur datetime-local, uniquement pour pré-remplir l'input en
// édition (l'input ne peut pas afficher une chaîne ISO avec secondes + fuseau).
export function toDateTimeLocalValue(value: string | null | undefined): string {
  const normalized = emptyToNull(value);
  if (normalized === null) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const CreateMemoryObject = z.object({
  scope: z.enum(["session", "global"]).default("session"),
  session_id: z.string().uuid("Session invalide").optional(),
  memory_type: MemoryTypeSchema,
  key: z.string().trim().min(1, "Clé requise").max(220),
  value: StringMap,
  metadata: StringMap.optional(),
  expires_at: ExpiresAtApiSchema,
});

const createMemoryRefine = (data: z.infer<typeof CreateMemoryObject>) => {
  if (data.scope === "global") {
    return data.session_id === undefined || data.session_id === null;
  }
  return typeof data.session_id === "string" && data.session_id.length > 0;
};

const CREATE_SESSION_ID_MESSAGE =
  'session_id requis pour une mémoire "session", interdit pour une mémoire "global"';

// Payload API (create) — validé par la Server Function `createMemory`.
export const CreateMemorySchema = CreateMemoryObject.refine(createMemoryRefine, {
  message: CREATE_SESSION_ID_MESSAGE,
  path: ["session_id"],
});

// Valeurs du formulaire (create / edit) : mêmes règles métier, mais le champ
// `expires_at` reste au format datetime-local tant qu'il n'est pas soumis.
export const MemoryFormSchema = CreateMemoryObject.extend({
  expires_at: ExpiresAtFormSchema,
}).refine(createMemoryRefine, {
  message: CREATE_SESSION_ID_MESSAGE,
  path: ["session_id"],
});

export const UpdateMemorySchema = z
  .object({
    id: AdminIdSchema,
    scope: z.enum(["session", "global"]).optional(),
    session_id: z.string().uuid("Session invalide").optional().nullable(),
    key: z.string().trim().min(1).max(220).optional(),
    value: StringMap.optional(),
    metadata: StringMap.optional(),
    expires_at: ExpiresAtApiSchema,
  })
  .refine(
    (data) => {
      if (data.scope === "global") {
        return data.session_id === undefined || data.session_id === null;
      }
      if (data.session_id !== undefined && data.session_id !== null) {
        return typeof data.session_id === "string" && data.session_id.length > 0;
      }
      return true;
    },
    {
      message: 'session_id interdit pour une mémoire "global"',
      path: ["session_id"],
    },
  );

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
