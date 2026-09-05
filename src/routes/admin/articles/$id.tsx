import { createFileRoute } from "@tanstack/react-router";
import { getArticle } from "@/server/functions/articles";
import { ArticleForm } from "@/features/articles/components/ArticleForm";

export const Route = createFileRoute("/admin/articles/$id")({
  loader: async ({ params }) => {
    const article = await getArticle({ data: { id: params.id } });
    return { article };
  },
  component: EditArticlePage,
});

function EditArticlePage() {
  const { article } = Route.useLoaderData();
  return (
    <div>
      <ArticleForm mode="edit" article={article} />
    </div>
  );
}
