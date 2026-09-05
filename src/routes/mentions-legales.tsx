import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions Légales — WebXIA" },
      {
        name: "description",
        content:
          "Mentions légales du site webxia.fr — identité de l'éditeur, hébergeur et propriété intellectuelle.",
      },
      { property: "og:title", content: "Mentions Légales — WebXIA" },
    ],
    links: [{ rel: "canonical", href: "https://webxia.fr/mentions-legales" }],
  }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 transition-colors hover:text-brand mb-8"
          >
            <ArrowLeft className="size-4" />
            Retour à l'accueil
          </Link>

          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Mentions Légales
          </h1>

          <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
            <p>
              Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance
              dans l'économie numérique (LCEN), il est précisé aux utilisateurs du site webxia.fr
              l'identité des différents intervenants dans le cadre de sa réalisation et de son
              suivi.
            </p>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Éditeur du site
              </h2>
              <p>Le site webxia.fr est édité par :</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <strong className="text-foreground">WebXIA</strong> — Micro-entreprise
                </li>
                <li>Représentée par : Mehdi E.</li>
                <li>Adresse : 30 allée Robert Boulin, 33500 Libourne, France</li>
                <li>
                  Email :{" "}
                  <a href="mailto:contact@webxia.fr" className="text-brand hover:underline">
                    contact@webxia.fr
                  </a>
                </li>
                <li>Numéro SIRET : 87179907200018</li>
                <li>Code APE / NAF : 6201Z — Programmation informatique</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Hébergeur du site
              </h2>
              <p>Le site webxia.fr est hébergé par :</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <strong className="text-foreground">Netlify, Inc.</strong>
                </li>
                <li>Adresse : 2325 3rd Street, Suite 296, San Francisco, California 94107, USA</li>
                <li>
                  Site web :{" "}
                  <a
                    href="https://www.netlify.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    www.netlify.com
                  </a>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Propriété intellectuelle
              </h2>
              <p>
                L'ensemble du contenu du site webxia.fr (incluant de manière non limitative les
                textes, graphismes, images, photos, sons, vidéos, logos, icônes, et code source) est
                la propriété exclusive de WebXIA, sauf mention contraire. Toute reproduction,
                représentation, modification, publication, adaptation totale ou partielle de tout ou
                partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est
                interdite sans l'autorisation écrite préalable de WebXIA. Toute exploitation non
                autorisée du site ou de l'un quelconque des éléments qu'il contient sera considérée
                comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions des
                articles L.335-2 et suivants du Code de la Propriété Intellectuelle.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Liens hypertextes
              </h2>
              <p>
                Le site webxia.fr peut contenir des liens hypertextes vers d'autres sites. WebXIA
                n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur
                contenu.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
