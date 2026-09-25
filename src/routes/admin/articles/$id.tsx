import { createFileRoute, notFound } from "@tanstack/react-router";
import { getArticle } from "@/server/functions/articles";
import { ArticleForm } from "@/features/articles/components/ArticleForm";
import { useLocale } from "@/lib/locale-context";

function ArticleNotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">{t("admin.articles.notFound")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("admin.articles.notFoundDesc")}</p>
    </div>
  );
}

export const Route = createFileRoute("/admin/articles/$id")({
  loader: async ({ params }) => {
    try {
      const article = await getArticle({ data: { id: params.id } });
      return { article };
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: ArticleNotFound,
  component: EditArticlePage,
});

function EditArticlePage() {
  const { article } = Route.useLoaderData();
  return <ArticleForm mode="edit" article={article} />;
}
