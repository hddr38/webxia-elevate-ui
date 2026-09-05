import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createRealisation, updateRealisation } from "@/server/functions/realisations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Save, Plus, X, Image, Trash2 } from "lucide-react";
import { slugify } from "@/lib/utils";
import type { Realisation, RealisationStatus } from "@/types/database";

interface RealisationFormProps {
  realisation?: Realisation;
  mode: "create" | "edit";
}

export function RealisationForm({ realisation, mode }: RealisationFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(realisation?.title ?? "");
  const [slug, setSlug] = useState(realisation?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(realisation?.short_description ?? "");
  const [descriptionMd, setDescriptionMd] = useState(realisation?.description_md ?? "");
  const [clientName, setClientName] = useState(realisation?.client_name ?? "");
  const [projectUrl, setProjectUrl] = useState(realisation?.project_url ?? "");
  const [githubUrl, setGithubUrl] = useState(realisation?.github_url ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(realisation?.cover_image_url ?? "");
  const [status, setStatus] = useState<RealisationStatus>(realisation?.status ?? "draft");
  const [featured, setFeatured] = useState(realisation?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(realisation?.sort_order ?? 0);
  const [technologies, setTechnologies] = useState(realisation?.technologies?.join(", ") ?? "");
  const [metaTitle, setMetaTitle] = useState(realisation?.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(realisation?.meta_description ?? "");
  const [category, setCategory] = useState(realisation?.category?.join(", ") ?? "");
  const [galleryImages, setGalleryImages] = useState<string[]>(realisation?.gallery_images ?? []);
  const [newGalleryImage, setNewGalleryImage] = useState("");

  const addGalleryImage = () => {
    if (newGalleryImage.trim()) {
      setGalleryImages([...galleryImages, newGalleryImage.trim()]);
      setNewGalleryImage("");
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

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
      const technologiesArray = technologies
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
        short_description: shortDescription || undefined,
        description_md: descriptionMd,
        client_name: clientName || undefined,
        project_url: projectUrl || undefined,
        github_url: githubUrl || undefined,
        cover_image_url: coverImageUrl || undefined,
        gallery_images: galleryImages,
        status,
        featured,
        sort_order: sortOrder,
        technologies: technologiesArray,
        category: categoryArray,
        meta_title: metaTitle || undefined,
        meta_description: metaDescription || undefined,
      };

      if (mode === "create") {
        await createRealisation({ data: payload });
      } else if (realisation) {
        await updateRealisation({ data: { id: realisation.id, ...payload } });
      }

      navigate({ to: "/admin/realisations", replace: true });
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
            onClick={() => navigate({ to: "/admin/realisations" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Nouvelle réalisation" : "Modifier la réalisation"}
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
                  placeholder="Nom du projet"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="slug-du-projet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Description courte</Label>
                <Textarea
                  id="shortDescription"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Courte description pour les cartes"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Markdown) *</Label>
                <Textarea
                  id="description"
                  value={descriptionMd}
                  onChange={(e) => setDescriptionMd(e.target.value)}
                  placeholder="Description complète du projet en Markdown..."
                  rows={15}
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
                <Select value={status} onValueChange={(v) => setStatus(v as RealisationStatus)}>
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

              <div className="flex items-center justify-between">
                <Label htmlFor="featured">À la une</Label>
                <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Ordre d'affichage</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégories (séparées par virgules)</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="web, app, ai, brand"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="technologies">Technologies (séparées par virgules)</Label>
                <Input
                  id="technologies"
                  value={technologies}
                  onChange={(e) => setTechnologies(e.target.value)}
                  placeholder="React, TypeScript, Tailwind"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom du client"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectUrl">URL du projet</Label>
                <Input
                  id="projectUrl"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubUrl">GitHub</Label>
                <Input
                  id="githubUrl"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
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

              <div className="space-y-2">
                <Label htmlFor="gallery">Galerie d'images</Label>
                <div className="flex gap-2">
                  <Input
                    id="gallery"
                    value={newGalleryImage}
                    onChange={(e) => setNewGalleryImage(e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addGalleryImage}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {galleryImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {galleryImages.map((img, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1 rounded">
                        <Image className="h-4 w-4" />
                        <span className="text-sm truncate max-w-[200px]">{img}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGalleryImage(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
