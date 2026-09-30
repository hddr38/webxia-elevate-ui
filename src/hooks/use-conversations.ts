import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/server/functions/conversations";
import { useChatStore } from "@/stores/chat-store";

/** Pure relative-date label for the history sidebar (unit-tested as-is). */
export function formatConversationDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: locale === "fr" ? fr : enUS });
}

/** Sidebar shows one page of history — 50 keeps the list complete for real sessions. */
const SIDEBAR_PAGE_LIMIT = 50;

export const conversationKeys = {
  list: ["webi-conversations", "list"] as const,
};

/**
 * The anonymous Webi session id is created lazily by the chat store and is
 * the ONLY scoping key sent to the server (ADR-006, no cookie, no JWT claim).
 */
function currentSessionId(): string {
  return useChatStore.getState().ensureSessionId();
}

export function conversationsListOptions() {
  return queryOptions({
    queryKey: conversationKeys.list,
    queryFn: () =>
      listConversations({
        data: { session_id: currentSessionId(), page: 1, limit: SIDEBAR_PAGE_LIMIT },
      }),
    // `staleTime: 0` on purpose: the derived title (first user message) only
    // changes server-side, so every re-open of the panel must refetch instead
    // of showing a title cached before the first message was sent.
    staleTime: 0,
  });
}

export interface UseConversationsOptions {
  /** Switch the widget transcript to a conversation (ChatWindow-owned state). */
  onSelect: (id: string) => void;
  /** Called when the deleted conversation was the one currently displayed. */
  onClearSelected: () => void;
}

export function useConversations(options: UseConversationsOptions) {
  const queryClient = useQueryClient();
  const selectedId = useChatStore((state) => state.conversationId);

  const query = useQuery(conversationsListOptions());

  const createMutation = useMutation({
    mutationFn: () => createConversation({ data: { session_id: currentSessionId() } }),
    onSuccess: (conversation) => {
      options.onSelect(conversation.id);
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      deleteConversation({ data: { id, session_id: currentSessionId() } }),
    onSuccess: (_result, id) => {
      // The transcript can only stay on a conversation that still exists.
      if (id === selectedId) options.onClearSelected();
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });

  return {
    conversations: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    create: () => createMutation.mutate(),
    isCreating: createMutation.isPending,
    remove: (id: string) => deleteMutation.mutate(id),
    removingId: deleteMutation.isPending ? (deleteMutation.variables ?? null) : null,
  };
}
