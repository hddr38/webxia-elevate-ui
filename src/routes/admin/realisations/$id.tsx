import { createFileRoute, notFound } from "@tanstack/react-router";
import { getRealisation } from "@/server/functions/realisations";
import { RealisationForm } from "@/features/realisations/components/RealisationForm";
import { useLocale } from "@/lib/locale-context";

function RealisationNotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">{t("admin.realisations.notFound")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("admin.realisations.notFoundDesc")}</p>
    </div>
  );
}

export const Route = createFileRoute("/admin/realisations/$id")({
  loader: async ({ params }) => {
    try {
      const realisation = await getRealisation({ data: { id: params.id } });
      return { realisation };
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: RealisationNotFound,
  component: EditRealisationPage,
});

function EditRealisationPage() {
  const { realisation } = Route.useLoaderData();
  return <RealisationForm mode="edit" realisation={realisation} />;
}
