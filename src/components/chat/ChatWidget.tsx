import { motion, AnimatePresence } from "framer-motion";
import { Bot } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { useChat } from "@/hooks/use-chat";
import { ChatWindow } from "./ChatWindow";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const { t } = useLocale();
  const { isOpen, toggle } = useChat();

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ delay: 1.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={toggle}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-3 pr-5",
            "text-sm font-medium text-background",
            "shadow-[0_20px_50px_-12px_color-mix(in_oklab,var(--foreground)_60%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          aria-label={t("chat.widget.title")}
          aria-expanded={false}
        >
          <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />
            <Bot className="size-4 relative" />
          </span>
          {t("chat.widget.title")}
        </motion.button>
      )}

      <AnimatePresence>{isOpen && <ChatWindow />}</AnimatePresence>
    </AnimatePresence>
  );
}
