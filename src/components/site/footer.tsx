import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { MapPin, Mail, Phone, Globe, Palette, TrendingUp, Bot, Wrench, Shield } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const navLinks = [
  { key: "home", titleKey: "footer.nav.home" as const, href: "/" },
  { key: "services", titleKey: "footer.nav.services" as const, href: "/services" },
  { key: "studio", titleKey: "footer.nav.studio" as const, href: "/about" },
  { key: "work", titleKey: "footer.nav.work" as const, href: "/work" },
  { key: "contact", titleKey: "footer.nav.contact" as const, href: "/contact" },
] as const;

const anchorLinks = [
  { key: "method", titleKey: "footer.nav.method" as const, href: "/about#realisations" },
] as const;

const solutionLinks = [
  { key: "web", titleKey: "footer.solutions.web" as const, icon: Globe },
  { key: "branding", titleKey: "footer.solutions.branding" as const, icon: Palette },
  { key: "seo", titleKey: "footer.solutions.seo" as const, icon: TrendingUp },
  { key: "ai", titleKey: "footer.solutions.ai" as const, icon: Bot },
  { key: "dev", titleKey: "footer.solutions.dev" as const, icon: Wrench },
  { key: "maintenance", titleKey: "footer.solutions.maintenance" as const, icon: Shield },
] as const;

const socialLinks = [
  {
    key: "x",
    icon: XIcon,
    href: "https://x.com/Web_Xia",
    label: "X",
  },
] as const;

const legalLinks = [
  { key: "mentions", titleKey: "footer.legal.mentions" as const, href: "/mentions-legales" },
  { key: "privacy", titleKey: "footer.legal.privacy" as const, href: "/politique-confidentialite" },
  { key: "terms", titleKey: "footer.legal.terms" as const, href: "/cgu" },
] as const;

export function Footer() {
  const { t } = useLocale();

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative border-t border-border bg-muted/30"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-10 md:gap-12 lg:grid-cols-4"
        >
          {/* Column 1 — Brand */}
          <div>
            <div className="space-y-4">
              <Link to="/" className="group inline-flex items-end gap-2">
                <img src="/logo.svg" alt="WebXIA" width={58} height={48} className="h-12 w-auto" />
                <span className="font-display text-xl font-semibold tracking-tight text-foreground leading-none pb-px">
                  WebXIA<span className="text-brand">.</span>
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {t("footer.brand.description")}
              </p>
              <div
                className="flex items-center gap-3 pt-2"
                role="list"
                aria-label={t("footer.social.label")}
              >
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    whileHover={{ y: -2 }}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground/70 transition-all duration-300 hover:border-brand/50 hover:text-brand hover:bg-brand/5"
                  >
                    <social.icon className="size-4" aria-hidden="true" />
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2 — Navigation */}
          <nav aria-label={t("footer.nav.title")}>
            <h3 className="font-medium text-foreground mb-4">{t("footer.nav.title")}</h3>
            <ul className="space-y-3" role="list">
              {navLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground/80 transition-colors hover:text-brand hover:underline underline-offset-2 focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                  >
                    {t(link.titleKey)}
                  </Link>
                </li>
              ))}
              {anchorLinks.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground/80 transition-colors hover:text-brand hover:underline underline-offset-2 focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                  >
                    {t(link.titleKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 3 — Solutions */}
          <nav aria-label={t("footer.solutions.title")}>
            <h3 className="font-medium text-foreground mb-4">{t("footer.solutions.title")}</h3>
            <ul className="space-y-3" role="list">
              {solutionLinks.map((sol) => (
                <li key={sol.key}>
                  <Link
                    to="/services"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground/80 transition-colors hover:text-brand focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                  >
                    <sol.icon className="size-4" aria-hidden="true" />
                    <span>{t(sol.titleKey)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 4 — Contact */}
          <div>
            <h3 className="font-medium text-foreground mb-4">{t("footer.contact.title")}</h3>
            <address className="not-italic">
              <ul className="space-y-3 text-sm text-muted-foreground/80" role="list">
                <li className="flex items-start gap-2">
                  <MapPin className="size-4 mt-0.5 shrink-0 text-brand/70" aria-hidden="true" />
                  <span>{t("footer.contact.address")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="size-4 mt-0.5 shrink-0 text-brand/70" aria-hidden="true" />
                  <a
                    href={`mailto:${t("footer.contact.email")}`}
                    className="transition-colors hover:text-brand hover:underline underline-offset-2 focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                  >
                    {t("footer.contact.email")}
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="size-4 mt-0.5 shrink-0 text-brand/70" aria-hidden="true" />
                  <a
                    href={`tel:${t("footer.contact.phone").replace(/\s/g, "")}`}
                    className="transition-colors hover:text-brand hover:underline underline-offset-2 focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                  >
                    {t("footer.contact.phone")}
                  </a>
                </li>
              </ul>
            </address>
          </div>
        </motion.div>

        {/* Footer Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 md:mt-16 border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} WebXIA. {t("footer.rights")}
          </p>

          <nav
            aria-label={t("footer.legal.title")}
            className="flex flex-wrap items-center justify-center md:justify-end gap-4 md:gap-6"
          >
            {legalLinks.map((legal) => (
              <Link
                key={legal.key}
                to={legal.href}
                className="text-sm text-muted-foreground/80 transition-colors hover:text-brand hover:underline underline-offset-2 focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
              >
                {t(legal.titleKey)}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted-foreground/80 md:hidden order-last mt-4 w-full text-center">
            {t("footer.madeby")}
          </p>
        </motion.div>

        {/* Made by — Desktop only */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="hidden md:block mt-8 text-center text-xs text-muted-foreground/80"
        >
          {t("footer.madeby")}
        </motion.p>
      </div>
    </motion.footer>
  );
}
