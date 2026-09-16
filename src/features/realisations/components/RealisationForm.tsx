import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useSaveRealisation } from "@/features/admin/queries";
import { CreateRealisationSchema, UpdateRealisationSchema } from "@/lib/admin/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Save, Plus, Trash2, Star } from "lucide-react";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { UnsavedChangesDialog } from "@/components/admin/unsaved-changes-dialog";
import { CoverHero } from "@/components/admin/cover-hero";
import { FormSection } from "@/components/admin/form-section";
import { useLocale } from "@/lib/locale-context";
import type { Realisation, RealisationStatus } from "@/types/database";

interface RealisationFormProps {
  realisation?: Realisation;
  mode: "create" | "edit";
}

const OptionalUrlInput = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || /^https?:\/\/.+/i.test(v), {
    message: "URL invalide (doit commencer par http:// ou https://)",
  });

const RealisationFormUiSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200, "Titre trop long (200 max)"),
  slug: z
    .string()
    .trim()
    .max(220)
    .refine((v) => !v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(v), {
      message: "Slug invalide (lettres, chiffres et tirets uniquement)",
    }),
  shortDescription: z.string().trim().max(5000).optional().default(""),
  descriptionMd: z
    .string()
    .trim()
    .min(1, "Description requise")
    .max(200_000, "Description trop longue"),
  clientName: z.string().trim().max(200).optional().default(""),
  projectUrl: OptionalUrlInput.optional().default(""),
  githubUrl: OptionalUrlInput.optional().default(""),
  coverImageUrl: OptionalUrlInput.optional().default(""),
  status: z.enum(["draft", "published", "archived"]),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000),
  technologiesText: z.string().max(1000).optional().default(""),
  categoryText: z.string().max(1000).optional().default(""),
  metaTitle: z.string().trim().max(160).optional().default(""),
  metaDescription: z.string().trim().max(320).optional().default(""),
  galleryImages: z.array(z.string().trim().min(1).max(2048)).max(30).default([]),
});

type RealisationFormInput = z.input<typeof RealisationFormUiSchema>;
type RealisationFormValues = z.output<typeof RealisationFormUiSchema>;

const STATUS_OPTIONS: RealisationStatus[] = ["draft", "published", "archived"];

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

export function RealisationForm({ realisation, mode }: RealisationFormProps) {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const [serverError, setServerError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [newGalleryImage, setNewGalleryImage] = useState("");
  const [galleryError, setGalleryError] = useState("");
  const saveMutation = useSaveRealisation(mode);
  const prevTitle = useRef(realisation?.title ?? "");

  const form = useForm<RealisationFormInput, unknown, RealisationFormValues>({
    resolver: zodResolver(RealisationFormUiSchema),
    defaultValues: {
      title: realisation?.title ?? "",
      slug: realisation?.slug ?? "",
      shortDescription: realisation?.short_description ?? "",
      descriptionMd: realisation?.description_md ?? "",
      clientName: realisation?.client_name ?? "",
      projectUrl: realisation?.project_url ?? "",
      githubUrl: realisation?.github_url ?? "",
      coverImageUrl: realisation?.cover_image_url ?? "",
      status: realisation?.status ?? "draft",
      featured: realisation?.featured ?? false,
      sortOrder: realisation?.sort_order ?? 0,
      technologiesText: realisation?.technologies?.join(", ") ?? "",
      categoryText: realisation?.category?.join(", ") ?? "",
      metaTitle: realisation?.meta_title ?? "",
      metaDescription: realisation?.meta_description ?? "",
      galleryImages: realisation?.gallery_images ?? [],
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
  const shortValue = watch("shortDescription") ?? "";
  const descValue = watch("descriptionMd") ?? "";
  const clientValue = watch("clientName") ?? "";
  const metaTitleValue = watch("metaTitle") ?? "";
  const metaDescValue = watch("metaDescription") ?? "";
  const galleryImages = watch("galleryImages") ?? [];
  const featured = watch("featured") ?? false;

  const handleTitleChange = (value: string) => {
    setValue("title", value, { shouldDirty: true, shouldValidate: true });
    if (mode === "create" || slugValue === slugify(prevTitle.current)) {
      setValue("slug", slugify(value), { shouldDirty: true, shouldValidate: true });
    }
    prevTitle.current = value;
  };

  const addGalleryImage = () => {
    const url = newGalleryImage.trim();
    setGalleryError("");
    if (!url) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      setGalleryError("URL invalide (doit commencer par http:// ou https://)");
      return;
    }
    if (galleryImages.includes(url)) {
      setGalleryError("Cette image est déjà dans la galerie");
      return;
    }
    if (galleryImages.length >= 30) {
      setGalleryError("Galerie limitée à 30 images");
      return;
    }
    setValue("galleryImages", [...galleryImages, url], { shouldDirty: true, shouldValidate: true });
    setNewGalleryImage("");
  };

  const removeGalleryImage = (index: number) => {
    setValue(
      "galleryImages",
      galleryImages.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const onSubmit = (values: RealisationFormValues) => {
    setServerError("");
    const payload = {
      title: values.title,
      slug: values.slug || undefined,
      short_description: values.shortDescription || undefined,
      description_md: values.descriptionMd,
      client_name: values.clientName || undefined,
      project_url: values.projectUrl || undefined,
      github_url: values.githubUrl || undefined,
      cover_image_url: values.coverImageUrl || undefined,
      gallery_images: values.galleryImages,
      status: values.status as RealisationStatus,
      featured: values.featured,
      sort_order: values.sortOrder,
      technologies: splitList(values.technologiesText),
      category: splitList(values.categoryText),
      meta_title: values.metaTitle || undefined,
      meta_description: values.metaDescription || undefined,
    };

    try {
      const parsed =
        mode === "create"
          ? CreateRealisationSchema.parse(payload)
          : UpdateRealisationSchema.parse(
              realisation ? { id: realisation.id, ...payload } : payload,
            );
      saveMutation.mutate(parsed as never, {
        onSuccess: () => {
          setSubmitted(true);
          toast.success(t("admin.common.saved"));
          navigate({
            to: "/admin/realisations",
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

  const heroDate = formatHeroDate(realisation?.updated_at ?? realisation?.created_at, locale);
  const heroMeta = [clientValue || realisation?.client_name, heroDate].filter(Boolean).join(" · ");
  const statusLabelKey: Record<RealisationStatus, string> = {
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

      {/* Barre supérieure : retour + titre live + sauvegarde */}
      <div className="sticky top-24 z-20 -mx-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("admin.common.back")}
            onClick={() =>
              navigate({ to: "/admin/realisations", search: { status: "all", q: "", page: 1 } })
            }
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              {t("admin.nav.realisations")}
              {featured && <Star className="size-3 fill-current" aria-hidden="true" />}
            </p>
            <h1 className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
              {titleValue ||
                (mode === "create"
                  ? t("admin.form.newRealisation")
                  : t("admin.form.editRealisation"))}
            </h1>
          </div>
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
        eyebrow={
          mode === "create" ? t("admin.form.newRealisation") : t("admin.form.editRealisation")
        }
        title={titleValue}
        coverUrl={coverValue}
        status={statusValue}
        slug={slugValue || realisation?.slug}
        meta={heroMeta || null}
        fallbackSeed={realisation?.id ?? titleValue ?? "new"}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection
            index="01"
            title={t("admin.form.content")}
            description={t("admin.realisations.description")}
          >
            <div className="space-y-2">
              <Label htmlFor="title">{t("admin.form.title")}</Label>
              <Input
                id="title"
                value={titleValue}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Nom du projet"
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
                placeholder="slug-du-projet"
                className="rounded-xl font-mono text-sm"
              />
              <FieldError message={errors.slug?.message} />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="shortDescription">{t("admin.form.shortDescription")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {shortValue.length}/5000
                </span>
              </div>
              <Textarea
                id="shortDescription"
                placeholder="Courte description pour les cartes"
                rows={2}
                className="rounded-xl"
                {...register("shortDescription")}
              />
              <FieldError message={errors.shortDescription?.message} />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="description">{t("admin.form.descriptionMd")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {descValue.length} / 200 000
                </span>
              </div>
              <Textarea
                id="description"
                placeholder="Description complète du projet en Markdown..."
                rows={15}
                className="rounded-xl font-mono text-sm leading-relaxed"
                {...register("descriptionMd")}
              />
              <FieldError message={errors.descriptionMd?.message} />
            </div>
          </FormSection>

          <FormSection index="02" title={t("admin.form.links")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">{t("admin.form.client")}</Label>
                <Input
                  id="client"
                  placeholder="Nom du client"
                  className="rounded-xl"
                  {...register("clientName")}
                />
                <FieldError message={errors.clientName?.message} />
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
              <div className="space-y-2">
                <Label htmlFor="projectUrl">{t("admin.form.projectUrl")}</Label>
                <Input
                  id="projectUrl"
                  placeholder="https://..."
                  className="rounded-xl font-mono text-xs"
                  {...register("projectUrl")}
                />
                <FieldError message={errors.projectUrl?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubUrl">GitHub</Label>
                <Input
                  id="githubUrl"
                  placeholder="https://github.com/..."
                  className="rounded-xl font-mono text-xs"
                  {...register("githubUrl")}
                />
                <FieldError message={errors.githubUrl?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="gallery">{t("admin.form.gallery")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {galleryImages.length}/30
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  id="gallery"
                  value={newGalleryImage}
                  onChange={(e) => setNewGalleryImage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryImage();
                    }
                  }}
                  placeholder="https://..."
                  className="flex-1 rounded-xl font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addGalleryImage}
                  aria-label={t("admin.form.gallery")}
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-full"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <FieldError message={galleryError || errors.galleryImages?.message} />
              {galleryImages.length > 0 && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {galleryImages.map((img, i) => (
                    <li
                      key={img}
                      className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                    >
                      <img
                        src={img}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <span className="block truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        {img}
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeGalleryImage(i)}
                        className="absolute right-1.5 top-1.5 min-h-[44px] min-w-[44px] rounded-full shadow sm:min-h-0 sm:min-w-0 sm:size-8"
                        aria-label={`Retirer ${img}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-32">
          <FormSection index="03" title={t("admin.form.settings")}>
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

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5">
              <Label htmlFor="featured">{t("admin.form.featured")}</Label>
              <Switch
                id="featured"
                checked={featured}
                onCheckedChange={(v) => setValue("featured", v, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t("admin.form.sortOrder")}</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                className="rounded-xl tabular-nums"
                {...register("sortOrder")}
              />
              <FieldError message={errors.sortOrder?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t("admin.form.categories")}</Label>
              <Input
                id="category"
                placeholder="web, app, ai, brand"
                className="rounded-xl"
                {...register("categoryText")}
              />
              <FieldError message={errors.categoryText?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="technologies">{t("admin.form.technologies")}</Label>
              <Input
                id="technologies"
                placeholder="React, TypeScript, Tailwind"
                className="rounded-xl"
                {...register("technologiesText")}
              />
              <FieldError message={errors.technologiesText?.message} />
            </div>
          </FormSection>

          <FormSection index="04" title={t("admin.form.seo")}>
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
        <Button type="submit" variant="brand" disabled={isSaving} className="min-h-[44px] w-full">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {mode === "create" ? t("admin.form.create") : t("admin.form.save")}
        </Button>
      </div>
    </form>
  );
}
