import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation — WebXIA" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation du site webxia.fr — accès au site, propriété intellectuelle, prestations et responsabilités.",
      },
      { property: "og:title", content: "CGU — WebXIA" },
    ],
    links: [{ rel: "canonical", href: "https://webxia.fr/cgu" }],
  }),
  component: CguPage,
});

function CguPage() {
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
            Conditions Générales d'Utilisation (CGU)
          </h1>

          <div className="mt-10 space-y-8 text-base leading-relaxed text-muted-foreground">
            <p>
              Les présentes Conditions Générales d'Utilisation (ci-après "CGU") régissent l'accès et
              l'utilisation du site webxia.fr. En accédant au site, l'utilisateur accepte sans
              réserve les présentes CGU.
            </p>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 1 : Accès au site
              </h2>
              <p>
                Le site webxia.fr est accessible gratuitement à tout utilisateur disposant d'un
                accès à Internet. Les frais d'accès et d'utilisation du matériel (ordinateur,
                connexion Internet) sont à la charge de l'utilisateur.
              </p>
              <p className="mt-2">
                WebXIA s'efforce de permettre l'accès au site 24h/24, 7j/7, mais ne saurait être
                tenu responsable des interruptions liées à des opérations de maintenance, de mise à
                jour, ou de problèmes techniques indépendants de sa volonté.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 2 : Utilisation du site
              </h2>
              <p>
                L'utilisateur s'engage à utiliser le site de manière conforme aux lois en vigueur et
                à ne pas porter atteinte aux droits de WebXIA ou de tiers. Sont notamment interdits
                :
              </p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>
                  L'accès frauduleux ou la tentative d'accès à des zones non publiques du site.
                </li>
                <li>L'introduction de virus, chevaux de Troie ou tout autre code malveillant.</li>
                <li>L'extraction automatisée de données (scraping) sans autorisation préalable.</li>
                <li>
                  L'utilisation du site à des fins de prospection commerciale sans accord de WebXIA.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 3 : Propriété intellectuelle
              </h2>
              <p>
                Tous les éléments présents sur le site (textes, logos, graphismes, code source) sont
                la propriété exclusive de WebXIA ou de ses partenaires. Toute reproduction, même
                partielle, sans autorisation écrite préalable est interdite et constitue une
                contrefaçon.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 4 : Prestations et Paiements
              </h2>
              <p>
                Le site webxia.fr a pour objet la présentation des services de WebXIA. Les
                informations fournies sont à titre indicatif.
              </p>
              <p className="mt-2">
                Le paiement des prestations peut s'effectuer de deux manières :
              </p>
              <ul className="mt-2 space-y-2 list-disc pl-6">
                <li>
                  <strong className="text-foreground">En ligne :</strong> Via un système de paiement
                  sécurisé. Les transactions sont traitées par un prestataire de paiement tiers.
                  WebXIA n'a à aucun moment accès aux coordonnées bancaires de l'utilisateur.
                </li>
                <li>
                  <strong className="text-foreground">Par facture classique :</strong> Par virement
                  bancaire selon les modalités définies sur le devis ou la facture émise par WebXIA.
                </li>
              </ul>
              <p className="mt-2">
                Les conditions financières et techniques de chaque prestation sont définies dans un
                contrat ou un devis spécifique accepté par les deux parties.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 5 : Liens hypertextes
              </h2>
              <p>
                Le site peut contenir des liens vers des sites tiers. WebXIA n'exerce aucun contrôle
                sur ces sites et décline toute responsabilité quant à leur contenu ou leurs
                pratiques en matière de protection des données.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 6 : Responsabilité
              </h2>
              <p>
                WebXIA ne saurait être tenu responsable des dommages directs ou indirects résultant
                de l'accès ou de l'utilisation du site, notamment des pertes de données, de virus,
                ou de pannes matérielles. Le site est fourni "tel quel" sans garantie d'aucune
                sorte.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 7 : Modification des CGU
              </h2>
              <p>
                WebXIA se réserve le droit de modifier les présentes CGU à tout moment. Les
                utilisateurs sont invités à les consulter régulièrement. La version applicable est
                celle en ligne à la date d'utilisation du site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3">
                Article 8 : Droit applicable et juridiction compétente
              </h2>
              <p>
                Les présentes CGU sont régies par le droit français. En cas de litige, et après
                recherche d'une solution amiable, les tribunaux français seront seuls compétents.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
