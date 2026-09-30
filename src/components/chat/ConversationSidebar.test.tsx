import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import {
  ConversationList,
  type ConversationListProps,
} from "@/components/chat/ConversationSidebar";
import { formatConversationDate } from "@/hooks/use-conversations";

const CONV_A = "33333333-3333-3333-3333-333333333333";
const CONV_B = "55555555-5555-5555-5555-555555555555";

const baseProps: ConversationListProps = {
  conversations: [],
  selectedId: null,
  isLoading: false,
  isError: false,
  isCreating: false,
  removingId: null,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onCreate: vi.fn(),
  onRetry: vi.fn(),
};

function renderList(overrides: Partial<ConversationListProps> = {}): string {
  const props = { ...baseProps, ...overrides };
  return renderToStaticMarkup(
    <LocaleProvider>
      <ConversationList {...props} />
    </LocaleProvider>,
  );
}

describe("ConversationList", () => {
  it("exposes a navigation landmark labelled for screen readers", () => {
    const html = renderList();
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-label="Historique des conversations"');
    expect(html).toContain("Historique des conversations");
  });

  it("renders the empty state with a create CTA", () => {
    const html = renderList();
    expect(html).toContain("Aucune conversation");
    expect(html).toContain("Nouvelle conversation");
    expect(html).not.toContain('aria-current="true"');
  });

  it("announces the loading state through a live region", () => {
    const html = renderList({ isLoading: true });
    expect(html).toContain('role="status"');
    expect(html).toContain("Chargement");
  });

  it("shows a retryable error state instead of a broken list", () => {
    const html = renderList({ isError: true });
    expect(html).toContain("Impossible de charger les conversations.");
    expect(html).toContain("Réessayer");
  });

  it("renders titles, relative dates and marks the selected conversation", () => {
    const html = renderList({
      conversations: [
        {
          id: CONV_A,
          title: "Bonjour Webi",
          status: "active",
          created_at: "",
          updated_at: new Date().toISOString(),
        },
        {
          id: CONV_B,
          title: null,
          status: "active",
          created_at: "",
          updated_at: new Date().toISOString(),
        },
      ],
      selectedId: CONV_A,
    });

    expect(html).toContain("Bonjour Webi");
    // Conversation without user message → translated fallback label.
    expect(html.match(/Nouvelle conversation/g)?.length).toBeGreaterThanOrEqual(1);
    // aria-current must sit on the SELECTED row only (one button carries it).
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    // Relative date rendered by formatConversationDate (fr locale).
    expect(html).toContain("il y a");
    expect(html).toContain("Supprimer la conversation");
    expect(html).toContain(`aria-label="Supprimer la conversation : Bonjour Webi"`);
  });

  it("disables the create CTA while a creation is in flight", () => {
    const html = renderList({ isCreating: true });
    expect(html).toContain("disabled");
  });
});

describe("formatConversationDate", () => {
  it("formats an ISO timestamp as a relative label per locale", () => {
    const iso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatConversationDate(iso, "fr")).toMatch(/il y a/);
    expect(formatConversationDate(iso, "en")).toMatch(/ago/);
  });

  it("returns an empty string for an unusable timestamp (never 'Invalid Date')", () => {
    expect(formatConversationDate("not-a-date", "fr")).toBe("");
    expect(formatConversationDate("", "en")).toBe("");
  });
});
