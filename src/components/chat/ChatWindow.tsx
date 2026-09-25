"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bot,
  Plus,
  MessageCircle,
  AlertCircle,
  Square,
  RotateCcw,
  ArrowDown,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { useChat } from "@/hooks/use-chat";
import { useStickyScroll } from "@/hooks/use-sticky-scroll";
import { MOBILE_BREAKPOINT_PX } from "@/components/chat/constants";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { ToolStatus } from "./ToolStatus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@tanstack/react-router";

export function ChatWindow() {
  const { t } = useLocale();
  const {
    isOpen,
    draft,
    isStreaming,
    currentTool,
    temporaryError,
    errorCode,
    canRetry,
    messages,
    conversationId,
    messageCount,
    maxMessages,
    isNearLimit,
    close,
    setDraft,
    sendMessage,
    stopStreaming,
    retryLastMessage,
    resetConversation,
  } = useChat();

  const {
    containerRef: messagesRef,
    isSticky,
    forceScrollToBottom,
    notifyMessageComplete,
    notifyStreamingTick,
  } = useStickyScroll();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const wasStreamingRef = React.useRef<boolean>(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Sticky-bottom : suit chaque delta pendant le streaming (throttlé 1/frame
  // dans le hook), recale en rAF après un message complet.
  React.useEffect(() => {
    if (isStreaming) {
      notifyStreamingTick();
    } else {
      notifyMessageComplete();
    }
  }, [messages, isStreaming, notifyMessageComplete, notifyStreamingTick]);

  // Fin du streaming : un dernier recalage conditionnel (ne force jamais
  // si l'utilisateur lit l'historique). LOT 24 — le focus volé pendant le
  // stream n'existe plus : si l'utilisateur n'a rien focusé d'autre entre
  // deux (bouton, autre onglet), le focus retourne sur l'input.
  React.useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      notifyMessageComplete();
      const active = typeof document === "undefined" ? null : document.activeElement;
      if (!active || active === document.body || active === document.documentElement) {
        inputRef.current?.focus();
      }
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, notifyMessageComplete]);

  // Plein écran mobile : aucun scroll de page derrière le widget.
  // Verrou appliqué uniquement sous le breakpoint mobile (< 768px,
  // cohérent avec `max-md:`) pour ne pas impacter le desktop.
  React.useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const apply = (): void => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      document.body.style.overflow = "";
      mq.removeEventListener("change", apply);
    };
  }, []);

  const focusInput = (): void => {
    inputRef.current?.focus();
  };

  // LOT 24 — a11y : le dialogue déclare `aria-modal="true"`, donc le Tab doit
  // rester à l'intérieur (sinon le clavier atteint la page derrière l'overlay).
  // Trap volontairement minimal : cycle Tab/Shift+Tab, focus initial sur
  // l'input, restitution au launcher à la fermeture (gérée par ChatWidget).
  React.useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const root = dialogRef.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );

    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !root?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Restitution au launcher (requeryé : l'ancien élément est déjà détaché
      // quand AnimatePresence a démonté le dialogue), fallback = dernier focus.
      const launcher = document.querySelector<HTMLElement>("[data-webi-launcher]");
      (launcher ?? previouslyFocused)?.focus?.();
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming || !draft.trim()) return;
    sendMessage(draft);
    // a) Envoi utilisateur : scroll FORCÉ même en lisant l'historique.
    forceScrollToBottom();
    // Accessibilité : le focus retourne sur l'input après envoi.
    focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !isStreaming) {
        sendMessage(draft);
        forceScrollToBottom();
        focusInput();
      }
    }
  };

  const remainingMessages = maxMessages - messageCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // Desktop inchangé : taille actuelle préservée telle quelle.
        "fixed bottom-6 right-6 z-50 w-full max-w-md h-[600px] max-h-[80vh]",
        "flex flex-col rounded-2xl bg-background border border-border",
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]",
        "overflow-hidden",
        // Plein écran mobile (viewport < 768px, cohérent avec md: Tailwind) :
        // 100% largeur, 100dvh (jamais 100vh — barre d'adresse mobile),
        // z-[60] au-dessus du max site (z-50 : header, dialogs, sidebar admin).
        // Classes purement CSS (aucun état JS) : pas de layout shift brutal.
        "max-md:inset-0 max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-0",
        "max-md:w-full max-md:max-w-none max-md:rounded-none max-md:z-[60]",
        // 100dvh avec fallback 100vh ([height:100dvh] invalide = ignoré).
        "max-md:[height:100vh] max-md:[height:100dvh]",
        "max-md:[max-height:100vh] max-md:[max-height:100dvh]",
      )}
      role="dialog"
      ref={dialogRef}
      aria-label="Chat Webi"
      aria-modal="true"
      aria-busy={isStreaming}
    >
      {/* Message limit indicator */}
      {messageCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={cn(
            "px-4 py-2 text-center text-xs font-medium border-b border-border",
            remainingMessages <= 2
              ? "text-destructive"
              : remainingMessages <= 3
                ? "text-orange-500"
                : "text-muted-foreground",
          )}
        >
          {messageCount >= maxMessages
            ? t("chat.limit.reached")
            : `${maxMessages - messageCount} ${t("chat.limit.remaining")}`}
        </motion.div>
      )}

      {/* Header : reste visible en plein écran, respecte l'encoche iOS */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 max-md:pt-[calc(0.75rem+env(safe-area-inset-top))] max-md:pl-[calc(1rem+env(safe-area-inset-left))] max-md:pr-[calc(1rem+env(safe-area-inset-right))]">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Bot className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">{t("chat.widget.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("chat.widget.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetConversation}
            className="size-11 text-muted-foreground hover:text-foreground"
            aria-label={t("chat.reset")}
            disabled={isStreaming}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            className="size-11 text-muted-foreground hover:text-foreground"
            aria-label={t("chat.close")}
            disabled={isStreaming}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area : prend tout l'espace restant (flex-1 + min-h-0).
          role="log" + aria-live : les lecteurs d'écran annoncent chaque
          ajout sans voler le focus (le focus reste sur l'input). */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={messagesRef}
          className="h-full overflow-y-auto overscroll-contain"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={t("chat.widget.title")}
        >
          <div className="p-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground"
                >
                  <Bot className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm max-w-xs">{t("chat.empty")}</p>
                </motion.div>
              ) : (
                messages.map((msg, index) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLast={index === messages.length - 1}
                    isStreaming={isStreaming}
                  />
                ))
              )}
            </AnimatePresence>

            {/* Typing indicator */}
            {isStreaming && messages.length > 0 && <TypingIndicator />}
          </div>
        </div>
      </div>

      {/* LOT 24 — pastille « revenir en bas » : visible uniquement quand
          l'utilisateur a remonté pendant que le transcript continue. */}
      <AnimatePresence mode="popLayout">
        {!isSticky && messages.length > 0 && (
          <motion.div
            key="chat-jump-bottom"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none relative z-10 -mt-10 flex justify-center"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={forceScrollToBottom}
              className="pointer-events-auto h-8 rounded-full gap-1 border-border bg-background/95 text-xs shadow-md backdrop-blur"
              aria-label={t("chat.scroll.bottom")}
            >
              <ArrowDown className="size-3" />
              {t("chat.scroll.bottom")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOT 24 — région de statut pour lecteurs d'écran : annonce l'état
          du flux (écriture / outil) sans jamais voler le focus. */}
      <div role="status" aria-live="polite" className="sr-only">
        {isStreaming ? t("chat.status.writing") : currentTool ? t("chat.tool.result") : ""}
      </div>

      {/* Tool Status */}
      <AnimatePresence mode="popLayout">
        {currentTool && <ToolStatus key={`tool-${currentTool}`} toolName={currentTool} />}
      </AnimatePresence>

      {/* Temporary Error */}
      <AnimatePresence mode="popLayout">
        {temporaryError && (
          <motion.div
            key="chat-temporary-error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-4"
          >
            <Alert variant="destructive" className="border-destructive/50">
              <AlertCircle className="size-4" />
              <AlertTitle className="text-sm">
                {errorCode === "GENERATION_FAILED"
                  ? t("chat.error.generation.title")
                  : errorCode === "GLOBAL_TIMEOUT"
                    ? t("chat.error.timeout.title")
                    : t("chat.error.generic")}
              </AlertTitle>
              <AlertDescription className="text-xs">{temporaryError}</AlertDescription>
              {canRetry && !isStreaming && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void retryLastMessage()}
                  className="mt-2 h-8 text-xs"
                >
                  <RotateCcw className="size-3" />
                  {t("chat.retry")}
                </Button>
              )}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Limit Reached - Contact Card */}
      <AnimatePresence mode="popLayout">
        {messageCount >= maxMessages && (
          <motion.div
            key="chat-limit-reached"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-4"
          >
            <Alert variant="default" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="size-4 text-destructive" />
              <AlertTitle className="text-sm text-destructive">
                {t("chat.limit.reached")}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {t("chat.limit.description")}
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/contact"
                    className="text-sm font-medium text-brand hover:underline"
                    onClick={close}
                  >
                    {t("chat.contact.cta")}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={resetConversation} className="text-xs">
                    {t("chat.reset")}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Near Limit Warning */}
      <AnimatePresence mode="popLayout">
        {isNearLimit && messageCount < maxMessages && messageCount > 0 && (
          <motion.div
            key="chat-near-limit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-4"
          >
            <Alert variant="default" className="border-orange-500/50 bg-orange-500/10">
              <AlertCircle className="size-4 text-orange-500" />
              <AlertDescription className="text-sm text-orange-600 dark:text-orange-400">
                {remainingMessages} {t("chat.limit.remaining")}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form : fixé en bas, respecte la barre home iOS */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:pl-[calc(1rem+env(safe-area-inset-left))] max-md:pr-[calc(1rem+env(safe-area-inset-right))]"
      >
        <div className="flex items-end gap-2">
          {/* LOT 24 — jamais `disabled` pendant le stream : l'utilisateur
              compose déjà son message suivant pendant que Webi écrit, et le
              focus n'est jamais volé ni perdu. L'envoi reste gardé
              (handleSubmit + Enter) tant que `isStreaming`. */}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.input.placeholder")}
            rows={1}
            className={cn(
              "flex-1 min-h-[44px] max-h-[150px] px-4 py-3",
              "bg-muted border border-input rounded-xl",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "resize-none",
            )}
            aria-label={t("chat.input.placeholder")}
            aria-busy={isStreaming}
          />
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              onClick={stopStreaming}
              className={cn(
                "size-10 rounded-xl bg-brand text-brand-foreground",
                "hover:bg-brand/90 transition-colors",
              )}
              aria-label={t("chat.stop")}
            >
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className={cn(
                "size-10 rounded-xl bg-brand text-brand-foreground",
                "hover:bg-brand/90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
              disabled={!draft.trim()}
              aria-label={t("chat.input.send")}
            >
              <MessageCircle className="size-4" />
            </Button>
          )}
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
    </motion.div>
  );
}
