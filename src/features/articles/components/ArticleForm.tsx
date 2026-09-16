import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useSaveArticle } from "@/features/admin/queries";
import { CreateArticleSchema, UpdateArticleSchema } from "@/lib/admin/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Save, ExternalLink } from "lucide-react";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { UnsavedChangesDialog } from "@/components/admin/unsaved-changes-dialog";
import { CoverHero } from "@/components/admin/cover-hero";
import { FormSection } from "@/components/admin/form-section";
import { useLocale } from "@/lib/locale-context";
import type { Article, ArticleStatus } from "@/types/database";

interface ArticleFormProps {
  article?: Article;
  mode: "create" | "edit";
}

const OptionalUrlInput = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || /^https?:\/\/.+/i.test(v), {
    message: "URL invalide (doit commencer par http:// ou https://)",
  });

const ArticleFormUiSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200, "Titre trop long (200 max)"),
  slug: z
    .string()
    .trim()
    .max(220)
    .refine((v) => !v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(v), {
      message: "Slug invalide (lettres, chiffres et tirets uniquement)",
    }),
  excerpt: z.string().trim().max(5000).optional().default(""),
  contentMd: z.string().trim().min(1, "Contenu requis").max(200_000, "Contenu trop long"),
  coverImageUrl: OptionalUrlInput.optional().default(""),
  status: z.enum(["draft", "published", "archived"]),
  tagsText: z.string().max(1000).optional().default(""),
  categoryText: z.string().max(1000).optional().default(""),
  readingMinutes: z.coerce.number().int().min(0).max(600),
  metaTitle: z.string().trim().max(160).optional().default(""),
  metaDescription: z.string().trim().max(320).optional().default(""),
});

type ArticleFormInput = z.input<typeof ArticleFormUiSchema>;
type ArticleFormValues = z.output<typeof ArticleFormUiSchema>;

const STATUS_OPTIONS: ArticleStatus[] = ["draft", "published", "archived"];

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function formatHeroDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ArticleForm({ article, mode }: ArticleFormProps) {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const [serverError, setServerError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const saveMutation = useSaveArticle(mode);
  const prevTitle = useRef(article?.title ?? "");

  const form = useForm<ArticleFormInput, unknown, ArticleFormValues>({
    resolver: zodResolver(ArticleFormUiSchema),
    defaultValues: {
      title: article?.title ?? "",
      slug: article?.slug ?? "",
      excerpt: article?.excerpt ?? "",
      contentMd: article?.content_md ?? "",
      coverImageUrl: article?.cover_image_url ?? "",
      status: article?.status ?? "draft",
      tagsText: article?.tags?.join(", ") ?? "",
      categoryText: article?.category?.join(", ") ?? "",
      readingMinutes: article?.reading_minutes ?? 5,
      metaTitle: article?.meta_title ?? "",
      metaDescription: article?.meta_description ?? "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = form;
  const isSaving = saveMutation.isPending;
  const titleValue = watch("title");
  const slugValue = watch("slug");
  const statusValue = watch("status");
  const coverValue = watch("coverImageUrl") ?? "";
  const excerptValue = watch("excerpt") ?? "";
  const contentValue = watch("contentMd") ?? "";
  const metaTitleValue = watch("metaTitle") ?? "";
  const metaDescValue = watch("metaDescription") ?? "";

  const handleTitleChange = (value: string) => {
    setValue("title", value, { shouldDirty: true, shouldValidate: true });
    if (mode === "create" || slugValue === slugify(prevTitle.current)) {
      setValue("slug", slugify(value), { shouldDirty: true, shouldValidate: true });
    }
    prevTitle.current = value;
  };

  const onSubmit = (values: ArticleFormValues) => {
    setServerError("");
    const payload = {
      title: values.title,
      slug: values.slug || undefined,
      excerpt: values.excerpt || undefined,
      content_md: values.contentMd,
      cover_image_url: values.coverImageUrl || undefined,
      status: values.status as ArticleStatus,
      tags: splitList(values.tagsText),
      category: splitList(values.categoryText),
      reading_minutes: values.readingMinutes,
      meta_title: values.metaTitle || undefined,
      meta_description: values.metaDescription || undefined,
    };

    try {
      const parsed =
        mode === "create"
          ? CreateArticleSchema.parse(payload)
          : UpdateArticleSchema.parse(article ? { id: article.id, ...payload } : payload);
      saveMutation.mutate(parsed as never, {
        onSuccess: () => {
          setSubmitted(true);
          toast.success(t("admin.common.saved"));
          navigate({
            to: "/admin/articles",
            search: { status: "all", q: "", page: 1 },
            replace: true,
          });
        },
        onError: (err) => {
          setServerError(err instanceof Error ? err.message : t("admin.common.saveError"));
          toast.error(t("admin.common.saveError"));
        },
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t("admin.common.saveError"));
    }
  };

  const canPreview =
    mode === "edit" &&
    article?.slug &&
    (article.status === "published" || statusValue === "published");
  const heroMeta = formatHeroDate(article?.updated_at ?? article?.created_at, locale);
  const statusLabelKey: Record<ArticleStatus, string> = {
    draft: "admin.form.draft",
    published: "admin.form.published",
    archived: "admin.form.archived",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24 lg:pb-0">
      <UnsavedChangesDialog when={isDirty && !submitted} />
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Barre supérieure : retour + titre live + actions */}
      <div className="sticky top-24 z-20 -mx-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("admin.common.back")}
            onClick={() =>
              navigate({ to: "/admin/articles", search: { status: "all", q: "", page: 1 } })
            }
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              {t("admin.nav.articles")}
            </p>
            <h1 className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
              {titleValue ||
                (mode === "create" ? t("admin.form.newArticle") : t("admin.form.editArticle"))}
            </h1>
          </div>
          {canPreview && (
            <Button variant="outline" size="sm" asChild className="hidden shrink-0 sm:inline-flex">
              <Link
                to="/journal/$slug"
                params={{ slug: article!.slug }}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("admin.common.view")}
              </Link>
            </Button>
          )}
          <Button
            type="submit"
            variant="brand"
            disabled={isSaving}
            className="hidden shrink-0 sm:inline-flex"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {mode === "create" ? t("admin.form.create") : t("admin.form.save")}
          </Button>
        </div>
      </div>

      {/* Aperçu cover live, niveau vitrine */}
      <CoverHero
        eyebrow={mode === "create" ? t("admin.form.newArticle") : t("admin.form.editArticle")}
        title={titleValue}
        coverUrl={coverValue}
        status={statusValue}
        slug={slugValue || article?.slug}
        meta={heroMeta}
        fallbackSeed={article?.id ?? titleValue ?? "new"}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection
            index="01"
            title={t("admin.form.content")}
            description={t("admin.articles.description")}
          >
            <div className="space-y-2">
              <Label htmlFor="title">{t("admin.form.title")}</Label>
              <Input
                id="title"
                value={titleValue}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Titre de l'article"
                className="rounded-xl"
              />
              <FieldError message={errors.title?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("admin.form.slug")}</Label>
              <Input
                id="slug"
                value={slugValue}
                onChange={(e) => setValue("slug", e.target.value, { shouldDirty: true })}
                placeholder="slug-de-l-article"
                className="rounded-xl font-mono text-sm"
              />
              <FieldError message={errors.slug?.message} />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="excerpt">{t("admin.form.excerpt")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {excerptValue.length}/5000
                </span>
              </div>
              <Textarea
                id="excerpt"
                placeholder="Courte description (optionnel)"
                rows={2}
                className="rounded-xl"
                {...register("excerpt")}
              />
              <FieldError message={errors.excerpt?.message} />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="content">{t("admin.form.contentMd")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {contentValue.length} / 200 000
                </span>
              </div>
              <Textarea
                id="content"
                placeholder="Rédigez votre article en Markdown..."
                rows={20}
                className="rounded-xl font-mono text-sm leading-relaxed"
                {...register("contentMd")}
              />
              <FieldError message={errors.contentMd?.message} />
            </div>
          </FormSection>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-32">
          <FormSection index="02" title={t("admin.form.settings")}>
            <div className="space-y-2">
              <span id="status-label" className="text-sm font-medium">
                {t("admin.form.status")}
              </span>
              <div
                role="group"
                aria-labelledby="status-label"
                className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-background/40 p-1"
              >
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={statusValue === option}
                    onClick={() => setValue("status", option, { shouldDirty: true })}
                    className={cn(
                      "min-h-[44px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
                      statusValue === option
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(statusLabelKey[option] as "admin.form.draft")}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">{t("admin.form.tags")}</Label>
              <Input
                id="tags"
                placeholder="react, web, tutoriel"
                className="rounded-xl"
                {...register("tagsText")}
              />
              <FieldError message={errors.tagsText?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t("admin.form.categories")}</Label>
              <Input
                id="category"
                placeholder="article, case-study, news"
                className="rounded-xl"
                {...register("categoryText")}
              />
              <FieldError message={errors.categoryText?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="readingMinutes">{t("admin.form.readingMinutes")}</Label>
                <Input
                  id="readingMinutes"
                  type="number"
                  min={0}
                  max={600}
                  className="rounded-xl tabular-nums"
                  {...register("readingMinutes")}
                />
                <FieldError message={errors.readingMinutes?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">{t("admin.form.cover")}</Label>
                <Input
                  id="cover"
                  placeholder="https://..."
                  className="rounded-xl font-mono text-xs"
                  {...register("coverImageUrl")}
                />
                <FieldError message={errors.coverImageUrl?.message} />
              </div>
            </div>
          </FormSection>

          <FormSection index="03" title={t("admin.form.seo")}>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="metaTitle">{t("admin.form.metaTitle")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {metaTitleValue.length}/160
                </span>
              </div>
              <Input
                id="metaTitle"
                placeholder="Titre pour les moteurs de recherche"
                className="rounded-xl"
                {...register("metaTitle")}
              />
              <FieldError message={errors.metaTitle?.message} />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="metaDesc">{t("admin.form.metaDescription")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {metaDescValue.length}/320
                </span>
              </div>
              <Textarea
                id="metaDesc"
                placeholder="Description pour les moteurs de recherche"
                rows={3}
                className="rounded-xl"
                {...register("metaDescription")}
              />
              <FieldError message={errors.metaDescription?.message} />
            </div>
          </FormSection>
        </aside>
      </div>

      {/* Barre d'enregistrement mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 p-4 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
          {canPreview && (
            <Button variant="outline" asChild className="min-h-[44px] shrink-0">
              <Link
                to="/journal/$slug"
                params={{ slug: article!.slug }}
                target="_blank"
                rel="noreferrer"
                aria-label={t("admin.common.view")}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
          <Button type="submit" variant="brand" disabled={isSaving} className="min-h-[44px] flex-1">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {mode === "create" ? t("admin.form.create") : t("admin.form.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
