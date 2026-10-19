import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Fragment } from "react";
import { Container } from "@/components/ui/container";
import { mentionsContentEn } from "@/content/legal-en";
import { mentionsContent, type LegalInline } from "@/content/legal-fr";
import { useLocale } from "@/lib/locale-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/mentions-legales")({
  head: () => {
    const locale = (typeof window !== "undefined" && localStorage.getItem("webxia-locale")) || "fr";
    const s = locale === "en" ? seo.en.mentionsLegales : seo.fr.mentionsLegales;
    return {
      meta: [
        { title: s.title },
        { name: "description", content: s.description },
        { property: "og:title", content: s.title },
        { property: "og:description", content: s.ogDescription },
      ],
      links: [{ rel: "canonical", href: "https://webxia.fr/mentions-legales" }],
    };
  },
  component: MentionsLegalesPage,
});

function renderInline(node: LegalInline, index: number) {
  if (typeof node === "string") return <Fragment key={index}>{node}</Fragment>;
  if ("href" in node) {
    return node.external ? (
      <Fragment key={index}>
        <a
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {node.label}
        </a>
      </Fragment>
    ) : (
      <Fragment key={index}>
        <a href={node.href} className="text-brand hover:underline">
          {node.label}
        </a>
      </Fragment>
    );
  }
  return node.strong ? (
    <Fragment key={index}>
      <strong className="text-foreground">{node.text}</strong>
    </Fragment>
  ) : (
    <Fragment key={index}>{node.text}</Fragment>
  );
}

function MentionsLegalesPage() {
  const { locale } = useLocale();
  const page = locale === "en" ? mentionsContentEn : mentionsContent;

  return (
    <div className="min-h-screen bg-background">
      <Container size="narrow" className="px-4 sm:px-6 lg:px-8 pt-14 pb-20 md:pt-20 md:pb-28">
        <motion.div
          // LOT 5.2 — page visible des le SSR (pattern hero LOT 33/34).
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 transition-colors hover:text-brand mb-8"
          >
            <ArrowLeft className="size-4" />
            {page.backLink}
          </Link>

          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            {page.title}
          </h1>

          <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
            <p>{page.intro.map(renderInline)}</p>

            {page.sections.map((section, sectionIndex) => (
              <section key={sectionIndex}>
                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                  {section.heading}
                </h2>
                {section.blocks.map((block, blockIndex) =>
                  block.kind === "p" ? (
                    <p
                      key={blockIndex}
                      className={
                        block.gap === "md"
                          ? "mt-4"
                          : blockIndex === 0 && block.gap !== "sm"
                            ? undefined
                            : "mt-2"
                      }
                    >
                      {block.content.map(renderInline)}
                    </p>
                  ) : (
                    <ul
                      key={blockIndex}
                      className={
                        block.style === "disc" ? "mt-2 space-y-2 list-disc pl-6" : "mt-2 space-y-1"
                      }
                    >
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex}>{item.map(renderInline)}</li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
