import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import { useLocale } from "@/lib/locale-context";

export function FloatingCTA() {
  const { t } = useLocale();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/contact") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      className="fixed bottom-6 right-6 z-40"
    >
      <Link
        to="/contact"
        className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-3 pr-5 text-sm font-medium text-background shadow-[0_20px_50px_-12px_color-mix(in_oklab,var(--foreground)_60%,transparent)]"
      >
        <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />
          <MessageCircle className="size-4 relative" />
        </span>
        {t("floating.cta")}
      </Link>
    </motion.div>
  );
}
