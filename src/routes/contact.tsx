import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "@/components/site/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — WebXIA" },
      {
        name: "description",
        content:
          "Tell us about your project. We reply within one business day, or book a 30-min intro call.",
      },
      { property: "og:title", content: "Contact — WebXIA" },
      { property: "og:description", content: "Tell us about your project." },
      { property: "og:url", content: "https://webxia-elevate-ui.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://webxia-elevate-ui.lovable.app/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="pt-24">
      <Contact />
    </div>
  );
}
