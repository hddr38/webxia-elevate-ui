"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  User,
  Quote,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Wrench,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "./types";

interface ChatMessageProps {
  message: ChatMessage;
  isLast: boolean;
}

const allowedTags = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const allowedAttributes = {
  a: ["href", "target", "rel"],
  code: ["class"],
  pre: ["class"],
  th: ["scope"],
  td: ["colspan", "rowspan"],
};

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const { t } = useLocale();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";

  if (isTool) {
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
            <Bot
              className={cn("size-4", isUser ? "text-primary-foreground" : "text-brand-foreground")}
            />
          </div>
          <div
            className={cn(
              "flex-1 rounded-2xl px-4 py-2.5 text-sm",
              isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
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
            <ReactMarkdown
              components={{
                code: ({ children, ...props }) => (
                  <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto my-2">
                    <code {...props}>{children}</code>
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-brand/50 pl-4 my-2 italic text-muted-foreground/80">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline hover:text-brand/80"
                    {...props}
                  >
                    {children}
                    <ExternalLink className="inline size-3 ml-1" />
                  </a>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeSanitize, { allowedTags, allowedAttributes }]]}
            >
              {message.content}
            </ReactMarkdown>
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
