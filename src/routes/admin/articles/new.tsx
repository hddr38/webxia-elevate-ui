import { createFileRoute } from "@tanstack/react-router";
import { ArticleForm } from "@/features/articles/components/ArticleForm";

export const Route = createFileRoute("/admin/articles/new")({
  component: NewArticlePage,
});

function NewArticlePage() {
  return (
    <div>
      <ArticleForm mode="create" />
    </div>
  );
}
