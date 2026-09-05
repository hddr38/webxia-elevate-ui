import { createFileRoute } from "@tanstack/react-router";
import { getRealisation } from "@/server/functions/realisations";
import { RealisationForm } from "@/features/realisations/components/RealisationForm";

export const Route = createFileRoute("/admin/realisations/$id")({
  loader: async ({ params }) => {
    const realisation = await getRealisation({ data: { id: params.id } });
    return { realisation };
  },
  component: EditRealisationPage,
});

function EditRealisationPage() {
  const { realisation } = Route.useLoaderData();
  return (
    <div>
      <RealisationForm mode="edit" realisation={realisation} />
    </div>
  );
}
