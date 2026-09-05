import { createFileRoute } from "@tanstack/react-router";
import { RealisationForm } from "@/features/realisations/components/RealisationForm";

export const Route = createFileRoute("/admin/realisations/new")({
  component: NewRealisationPage,
});

function NewRealisationPage() {
  return (
    <div>
      <RealisationForm mode="create" />
    </div>
  );
}
