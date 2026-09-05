import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/work")({
  beforeLoad: () => {
    throw redirect({ to: "/about", hash: "realisations" });
  },
  component: () => null,
});
