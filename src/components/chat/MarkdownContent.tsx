"use client";

import React, { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/chat/copy-text";
import { extractCodeChild } from "@/lib/chat/markdown-extract";

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

/**
 * Fenced code block: language badge, copy button, horizontal scroll.
 * Owns its own <pre><code> — the inline `code` override below never wraps
 * content in a block (the previous all-in-<pre> bug).
 */
function CodeBlock({ children }: { children?: React.ReactNode }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const extracted = extractCodeChild(children);
  const language = extracted?.className?.replace(/^language-/, "").trim() ?? "";
  const source = extracted?.text ?? "";

  const handleCopy = (): void => {
    void copyTextToClipboard(source).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!extracted) {
    return (
      <pre className="my-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/50 p-3">
        {children}
      </pre>
    );
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border/60 bg-muted/50">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/70 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {language || t("chat.code.plain")}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("chat.code.copy")}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-xs leading-relaxed">{source}</code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  // Inline code: never a <pre> (the block path is CodeBlock above).
  code: ({ children, className }) => (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-words",
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: CodeBlock,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-brand/50 pl-4 italic text-muted-foreground/80">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand underline hover:text-brand/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc list-inside space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal list-inside space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  // Bubble-scale headings: never a page-level jump in size.
  h1: ({ children }) => <h1 className="mt-3 mb-1 text-base font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => <h5 className="mt-2 mb-1 text-sm font-medium first:mt-0">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mt-2 mb-1 text-xs font-medium uppercase tracking-wide first:mt-0">{children}</h6>
  ),
  // Wide tables scroll inside the bubble instead of breaking the layout.
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border/60 bg-muted/50 px-2 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/40 px-2 py-1.5 align-top last:border-b-0">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border/60" />,
};

/**
 * Single owner of assistant markdown rendering (sanitized, GFM-aware).
 * Extracted from ChatMessage so it is testable in isolation.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={markdownComponents}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, { allowedTags, allowedAttributes }]]}
    >
      {content}
    </ReactMarkdown>
  );
}
