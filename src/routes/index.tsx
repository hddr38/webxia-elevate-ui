import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { Services } from "@/components/site/services";
import { Contact } from "@/components/site/contact";
import { FloatingCTA } from "@/components/site/floating-cta";
import { Footer } from "@/components/site/footer";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WebXIA — Premium web & AI studio" },
      {
        name: "description",
        content:
          "WebXIA is a senior product team designing and shipping high-performance websites, applications and AI tooling for ambitious brands.",
      },
      { property: "og:title", content: "WebXIA — Premium web & AI studio" },
      {
        property: "og:description",
        content: "Engineered web experiences for ambitious brands.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
          <Header />
          <main>
            <Hero />
            <Services />
            <Contact />
          </main>
          <Footer />
          <FloatingCTA />
        </div>
      </LocaleProvider>
    </ThemeProvider>
  );
}
