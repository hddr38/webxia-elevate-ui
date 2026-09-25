"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface ChatInputProps {
  draft: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
}

export function ChatInput({ draft, onChange, onSubmit, onKeyDown, disabled }: ChatInputProps) {
  const { t } = useLocale();

  return (
    <form
      onSubmit={onSubmit}
      className="p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("chat.input.placeholder")}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 min-h-[44px] max-h-[150px] px-4 py-3",
            "bg-muted border border-input rounded-xl",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "resize-none",
          )}
          aria-label={t("chat.input.placeholder")}
          aria-disabled={disabled}
        />
        <Button
          type="submit"
          size="icon"
          className={cn(
            "size-10 rounded-xl bg-brand text-brand-foreground",
            "hover:bg-brand/90",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
          disabled={disabled || !draft.trim()}
          aria-label={t("chat.input.send")}
        >
          <MessageCircle className="size-4" />
        </Button>
      </div>
      <p
        className={cn(
          "mt-1 text-right text-xs",
          draft.length > 9000 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {draft.length}/{10000}
      </p>
    </form>
  );
}
