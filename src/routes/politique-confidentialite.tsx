import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/politique-confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de Confidentialité — WebXIA" },
      {
        name: "description",
        content:
          "Politique de confidentialité de WebXIA — comment nous collectons, utilisons et protégeons vos données personnelles conformément au RGPD.",
      },
      { property: "og:title", content: "Politique de Confidentialité — WebXIA" },
    ],
    links: [{ rel: "canonical", href: "https://webxia.fr/politique-confidentialite" }],
  }),
  component: PolitiqueConfidentialitePage,
});

function PolitiqueConfidentialitePage() {
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
            Politique de Confidentialité
          </h1>

          <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
            <p>
              WebXIA s'engage à protéger la vie privée des utilisateurs de son site webxia.fr. Cette
              politique de confidentialité explique comment nous collectons, utilisons et protégeons
              vos données personnelles, conformément au Règlement Général sur la Protection des
              Données (RGPD) et à la loi Informatique et Libertés.
            </p>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                1. Responsable du traitement
              </h2>
              <p>
                Le responsable du traitement des données est WebXIA, représentée par Mehdi E., ayant
                son adresse à 30 allée Robert Boulin, 33500 Libourne, France, joignable à l'adresse
                suivante :{" "}
                <a href="mailto:contact@webxia.fr" className="text-brand hover:underline">
                  contact@webxia.fr
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                2. Données collectées
              </h2>
              <p>Nous collectons les données suivantes :</p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>
                  <strong className="text-foreground">Données de contact :</strong> Nom, prénom,
                  adresse e-mail et contenu de votre message lorsque vous remplissez notre
                  formulaire de contact.
                </li>
                <li>
                  <strong className="text-foreground">Données de paiement :</strong> En cas de
                  paiement en ligne, les transactions sont sécurisées par notre prestataire de
                  paiement. WebXIA ne stocke aucune donnée bancaire (les coordonnées de carte bleue
                  ne transitent jamais par nos serveurs).
                </li>
                <li>
                  <strong className="text-foreground">Données techniques :</strong> Adresse IP, type
                  de navigateur (données strictement nécessaires au fonctionnement du site).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                3. Finalités du traitement
              </h2>
              <p>Les données collectées sont utilisées pour :</p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>Répondre à vos demandes d'information, de devis ou de contact.</li>
                <li>Traiter vos paiements en ligne et vous fournir les prestations commandées.</li>
                <li>Respecter nos obligations légales et comptables.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                4. Base légale
              </h2>
              <p>Le traitement de vos données est fondé sur :</p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>Votre consentement (lorsque vous remplissez le formulaire de contact).</li>
                <li>
                  L'exécution de mesures précontractuelles ou d'un contrat (pour les paiements et
                  prestations).
                </li>
                <li>
                  Notre intérêt légitime à répondre à vos demandes et à assurer la sécurité du site.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                5. Durée de conservation
              </h2>
              <p>
                Vos données personnelles sont conservées pour une durée maximale de 3 ans après
                votre dernière interaction avec nos services, sauf si une durée de conservation plus
                longue est requise par la loi (notamment pour la preuve d'un droit ou d'un contrat,
                ou les obligations comptables qui exigent une conservation de 10 ans).
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                6. Partage des données
              </h2>
              <p>
                Vos données ne sont jamais vendues à des tiers. Elles peuvent uniquement être
                partagées avec nos prestataires techniques (hébergeur du site, prestataire de
                paiement en ligne) agissant en tant que sous-traitants, ou si la loi l'exige.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                7. Cookies et traceurs
              </h2>
              <p>
                Le site webxia.fr n'utilise pas de cookies de tracking publicitaire ni d'outils
                d'analyse de trafic tiers (comme Google Analytics ou Meta Pixel). Seuls des cookies
                strictement nécessaires au bon fonctionnement technique du site peuvent être
                utilisés, ne nécessitant pas de consentement préalable.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                8. Vos droits (RGPD)
              </h2>
              <p>
                Conformément au RGPD, vous disposez des droits suivants concernant vos données
                personnelles :
              </p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>Droit d'accès, de rectification et d'effacement.</li>
                <li>Droit à la limitation et à l'opposition du traitement.</li>
                <li>Droit à la portabilité de vos données.</li>
                <li>Droit de retirer votre consentement à tout moment.</li>
              </ul>
              <p className="mt-4">
                Pour exercer ces droits, vous pouvez nous contacter à :{" "}
                <a href="mailto:contact@webxia.fr" className="text-brand hover:underline">
                  contact@webxia.fr
                </a>
                . Vous avez également le droit d'introduire une réclamation auprès de la{" "}
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  CNIL (www.cnil.fr)
                </a>
                .
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
