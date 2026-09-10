"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CitationProps {
  citations: Array<{
    source: string;
    excerpt: string;
    relevance: number;
    documentId?: string;
    chunkId?: string;
  }>;
  className?: string;
}

export function Citation({ citations, className }: CitationProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={cn("mt-3", className)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <Quote className="size-3 mr-1" />
        {t("chat.citations.title", { count: citations.length })}
        {expanded ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
      </Button>
      <AnimatePresence mode="wait">
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2"
          >
            {citations.map((citation, index) => (
              <motion.div
                key={citation.documentId || index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg bg-muted/50 border border-border/50 text-xs"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <FileText className="size-3 text-muted-foreground" />
                    <span className="font-medium truncate">{citation.source}</span>
                  </div>
                  <span className="text-muted-foreground/70 text-xs">
                    {Math.round(citation.relevance * 100)}%
                  </span>
                </div>
                <p className="text-muted-foreground/80 line-clamp-3">{citation.excerpt}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
