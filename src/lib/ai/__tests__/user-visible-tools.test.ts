import { describe, it, expect } from "vitest";
import { USER_VISIBLE_TOOLS, shouldDisplayTool } from "../user-visible-tools";

/**
 * LOT 38a ter — whitelist UI des outils du chat.
 *
 * Fail-safe : la whitelist est VIDE en V1 — aucun tool n'est affiché dans
 * le widget (bulle role="tool", ToolStatus, sr-only) tant qu'il n'est pas
 * ajouté explicitement à USER_VISIBLE_TOOLS. Les frames backend continuent
 * d'être émises ; seul le rendu est filtré côté client.
 */
describe("user-visible-tools (LOT 38a ter)", () => {
  it("exposes an empty whitelist in V1", () => {
    expect(USER_VISIBLE_TOOLS.size).toBe(0);
  });

  it("hides save_lead (internal lead capture)", () => {
    expect(shouldDisplayTool("save_lead")).toBe(false);
  });

  it("hides summarize (internal summarization)", () => {
    expect(shouldDisplayTool("summarize")).toBe(false);
  });

  it("hides search_knowledge in V1 (never emitted in chat anyway)", () => {
    expect(shouldDisplayTool("search_knowledge")).toBe(false);
  });

  it("hides unknown tools (fail-safe default)", () => {
    expect(shouldDisplayTool("unknown_tool")).toBe(false);
    expect(shouldDisplayTool("")).toBe(false);
  });
});
