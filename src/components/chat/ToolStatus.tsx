"use client";

import { motion } from "framer-motion";
import { Bot, Search, Loader2, Database, Globe, FileText, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

interface ToolStatusProps {
  toolName: string;
  className?: string;
}

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  search_knowledge: Search,
  summarize: FileText,
  default: Bot,
};

const toolLabels: Record<string, string> = {
  search_knowledge: "chat.tool.search_knowledge",
  summarize: "chat.tool.summarize",
};

export function ToolStatus({ toolName, className }: ToolStatusProps) {
  const { t } = useLocale();
  const Icon = toolIcons[toolName] || toolIcons.default;
  const labelKey = toolLabels[toolName] || "chat.tool.executing";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={cn("mx-4 mb-2", className)}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand/10 border border-brand/20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="relative inline-flex size-8 items-center justify-center rounded-full bg-brand/20"
        >
          <Icon className="size-4 text-brand" />
        </motion.div>
        <span className="text-sm font-medium text-brand">{t(labelKey)}</span>
        <motion.span
          className="ml-auto text-xs text-brand/70 font-mono"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ...
        </motion.span>
      </div>
    </motion.div>
  );
}
