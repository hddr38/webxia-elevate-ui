import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createArticle, updateArticle } from "@/server/functions/articles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { slugify } from "@/lib/utils";
import type { Article, ArticleStatus } from "@/types/database";

interface ArticleFormProps {
  article?: Article;
  mode: "create" | "edit";
}

export function ArticleForm({ article, mode }: ArticleFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [contentMd, setContentMd] = useState(article?.content_md ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(article?.cover_image_url ?? "");
  const [status, setStatus] = useState<ArticleStatus>(article?.status ?? "draft");
  const [tags, setTags] = useState(article?.tags?.join(", ") ?? "");
  const [metaTitle, setMetaTitle] = useState(article?.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(article?.meta_description ?? "");
  const [category, setCategory] = useState(article?.category?.join(", ") ?? "");
  const [readingMinutes, setReadingMinutes] = useState(article?.reading_minutes ?? 5);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (mode === "create" || slug === slugify(title)) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const categoryArray = category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const payload = {
        title,
        slug,
        excerpt: excerpt || undefined,
        content_md: contentMd,
        cover_image_url: coverImageUrl || undefined,
        status,
        tags: tagsArray,
        category: categoryArray,
        reading_minutes: readingMinutes,
        meta_title: metaTitle || undefined,
        meta_description: metaDescription || undefined,
      };

      if (mode === "create") {
        await createArticle({ data: payload });
      } else if (article) {
        await updateArticle({ data: { id: article.id, ...payload } });
      }

      navigate({ to: "/admin/articles", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/admin/articles" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Nouvel article" : "Modifier l'article"}
          </h1>
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {mode === "create" ? "Créer" : "Enregistrer"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contenu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Titre de l'article"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="slug-de-l-article"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Extrait</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Courte description (optionnel)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Contenu (Markdown) *</Label>
                <Textarea
                  id="content"
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  placeholder="Rédigez votre article en Markdown..."
                  rows={20}
                  className="font-mono text-sm"
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ArticleStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (séparés par virgules)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="react, web, tutoriel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégories (séparées par virgules)</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="article, case-study, news"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="readingMinutes">Temps de lecture (minutes)</Label>
                <Input
                  id="readingMinutes"
                  type="number"
                  value={readingMinutes}
                  onChange={(e) => setReadingMinutes(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cover">Image de couverture (URL)</Label>
                <Input
                  id="cover"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta titre</Label>
                <Input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Titre pour les moteurs de recherche"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDesc">Meta description</Label>
                <Textarea
                  id="metaDesc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Description pour les moteurs de recherche"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
