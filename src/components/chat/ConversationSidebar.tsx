"use client";

import React from "react";
import { AlertCircle, History, Loader2, Plus, Trash2, X } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatConversationDate, useConversations } from "@/hooks/use-conversations";

export interface ConversationListEntry {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationListProps {
  conversations: ConversationListEntry[];
  selectedId: string | null;
  isLoading: boolean;
  isError: boolean;
  isCreating: boolean;
  removingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onRetry: () => void;
  /** Rendered only on mobile (the desktop toggle lives in the widget header). */
  onClose?: () => void;
}

/**
 * Pure presentational history list: no data fetching, no store access —
 * every interaction arrives as a prop. This is the piece covered by the
 * render-to-static-markup unit test.
 */
export function ConversationList({
  conversations,
  selectedId,
  isLoading,
  isError,
  isCreating,
  removingId,
  onSelect,
  onDelete,
  onCreate,
  onRetry,
  onClose,
}: ConversationListProps) {
  const { t, locale } = useLocale();

  return (
    <nav
      role="navigation"
      aria-label={t("chat.history.nav")}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <History className="size-3.5" aria-hidden="true" />
          {t("chat.history.nav")}
        </span>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 md:hidden"
            aria-label={t("chat.history.close")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="shrink-0 border-b border-border px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreate}
          disabled={isCreating}
          className="w-full justify-start gap-2"
          aria-label={t("chat.history.new")}
        >
          {isCreating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {t("chat.history.new")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading && (
          <p role="status" className="px-3 py-3 text-sm text-muted-foreground">
            {t("chat.history.loading")}
          </p>
        )}

        {isError && !isLoading && (
          <div className="space-y-2 px-3 py-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("chat.history.error")}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
              {t("chat.retry")}
            </Button>
          </div>
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <div className="space-y-3 px-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("chat.history.empty")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreate}
              disabled={isCreating}
            >
              {t("chat.history.new")}
            </Button>
          </div>
        )}

        {!isLoading && !isError && conversations.length > 0 && (
          <ul className="space-y-1 p-2">
            {conversations.map((conversation) => {
              const label = conversation.title?.trim() || t("chat.history.untitled");
              const isSelected = conversation.id === selectedId;
              const isRemoving = removingId === conversation.id;
              return (
                <li key={conversation.id}>
                  <div className="group flex items-center gap-1 rounded-lg hover:bg-muted/60">
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "min-w-0 flex-1 rounded-md px-2 py-2 text-left",
                        isSelected && "bg-muted",
                      )}
                    >
                      <span className="block truncate text-sm text-foreground">{label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatConversationDate(conversation.updated_at, locale)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(conversation.id)}
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`${t("chat.history.delete")} : ${label}`}
                      aria-busy={isRemoving}
                      disabled={isRemoving}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}

export interface ConversationSidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called when the deleted conversation was the active one. */
  onClearSelected: () => void;
  onClose: () => void;
}

/**
 * History sidebar of the Webi widget. Inline inside the dialog (no portal):
 * the ChatWindow focus trap must keep capturing Tab presses (LOT 22).
 * Mounted ONLY while the panel is open — no `_serverFn` call otherwise,
 * which is what keeps the existing chat E2E specs green.
 */
export function ConversationSidebar({
  selectedId,
  onSelect,
  onClearSelected,
  onClose,
}: ConversationSidebarProps) {
  const { conversations, isLoading, isError, isCreating, removingId, create, remove, refetch } =
    useConversations({ onSelect, onClearSelected });

  return (
    <aside
      className={cn(
        // Desktop: in-flow column to the left of the transcript.
        "relative w-72 shrink-0 border-r border-border bg-background",
        // Mobile: full-screen overlay above the transcript (dialog is relative).
        "max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full max-md:border-r-0",
      )}
    >
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        isLoading={isLoading}
        isError={isError}
        isCreating={isCreating}
        removingId={removingId}
        onSelect={onSelect}
        onDelete={remove}
        onCreate={create}
        onRetry={refetch}
        onClose={onClose}
      />
    </aside>
  );
}
