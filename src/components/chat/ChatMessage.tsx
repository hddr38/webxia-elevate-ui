"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  User,
  Quote,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  FileText,
  Wrench,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/chat/copy-text";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "./types";
import { MarkdownContent } from "./MarkdownContent";

interface ChatMessageProps {
  message: ChatMessage;
  /** True only for the final message of the transcript while streaming. */
  isLast: boolean;
  isStreaming: boolean;
}

export function ChatMessage({ message, isLast, isStreaming }: ChatMessageProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";

  // LOT 24 — one copy affordance on the LAST assistant message only: a button
  // per bubble would stack N identical affordances in a long transcript.
  const handleCopyResponse = (): void => {
    if (!message.content) return;
    void copyTextToClipboard(message.content).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (isTool) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3 justify-start"
      >
        <div className="flex items-start gap-2 max-w-[85%] flex-row">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-brand">
            <Bot className="size-4 text-brand-foreground" />
          </div>
          <div className="flex-1 rounded-2xl px-4 py-2.5 text-sm bg-muted text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-xs uppercase tracking-wider">
                {message.toolName || t("chat.tool.executing")}
              </span>
              <span className="text-xs opacity-70">{t("chat.tool.executing")}</span>
            </div>
            <div className="font-mono text-xs opacity-80 whitespace-pre-wrap break-all">
              {message.content}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const showCursor = isStreaming && isLast && isAssistant;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex items-start gap-2 max-w-[85%]",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "relative flex size-8 shrink-0 items-center justify-center rounded-full",
            isUser ? "bg-primary" : "bg-brand",
          )}
        >
          {isUser ? (
            <User className="size-4 text-primary-foreground" />
          ) : (
            <Bot className="size-4 text-brand-foreground" />
          )}
        </div>
        <div
          className={cn(
            "flex-1 rounded-2xl px-4 py-3 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {isUser && <div className="whitespace-pre-wrap break-words">{message.content}</div>}

          {isAssistant && (
            <>
              <MarkdownContent content={message.content} />
              {/* Streaming caret — never a fake "done" look while tokens arrive. */}
              {showCursor && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-brand align-middle"
                />
              )}
              {isLast && message.content && !isStreaming && (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    aria-label={t("chat.response.copy")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                      "text-muted-foreground/70 hover:bg-background hover:text-foreground",
                    )}
                  >
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span aria-live="polite">{copied ? t("chat.copy.done") : ""}</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <AnimatePresence mode="popLayout">
              <CitationList citations={message.citations} />
            </AnimatePresence>
          )}

          {/* Tool Result */}
          {message.toolResult && (
            <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                <Wrench className="size-4" />
                {t("chat.tool.result")}
              </div>
              <div className="font-mono text-xs opacity-80 whitespace-pre-wrap break-all">
                {typeof message.toolResult.content === "string"
                  ? message.toolResult.content
                  : JSON.stringify(message.toolResult.content, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CitationList({
  citations,
}: {
  citations: Array<{
    source: string;
    excerpt: string;
    relevance: number;
    documentId?: string;
    chunkId?: string;
  }>;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
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
      <AnimatePresence mode="popLayout">
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2"
          >
            {citations.map((citation, index) => (
              <motion.div
                key={citation.documentId || citation.chunkId || index}
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
    </div>
  );
}
