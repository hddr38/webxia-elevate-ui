import { describe, it, expect } from "vitest";
import { WEBi_SYSTEM_PROMPT, WEBi_SYSTEM_PROMPT_VERSION } from "../agent/system-prompt";

describe("system prompt", () => {
  it("is version 1.3.4", () => {
    expect(WEBi_SYSTEM_PROMPT_VERSION).toBe("1.3.4");
  });

  it("contains the simplified lead-registration block (v1.3.3, LOT 38a quater)", () => {
    expect(WEBi_SYSTEM_PROMPT).toContain("## Enregistrement de lead");
    expect(WEBi_SYSTEM_PROMPT).toContain("save_lead");
    expect(WEBi_SYSTEM_PROMPT).toContain("IMMÉDIATEMENT");
    expect(WEBi_SYSTEM_PROMPT).toContain(
      "Ne dis JAMAIS \"c'est noté\" si tu n'as pas vu la réponse de save_lead.",
    );
  });

  it("forbids visitor-facing jargon (v1.3.4, LOT 38a quinquies)", () => {
    expect(WEBi_SYSTEM_PROMPT).toContain('N\'utilise JAMAIS les mots "lead"');
    expect(WEBi_SYSTEM_PROMPT).toContain("Je note vos coordonnées");
    expect(WEBi_SYSTEM_PROMPT).toContain("Je vais vous recontacter");
  });

  it("drops the v1.3.2 meta-instructions (FIX F owns the guard in code)", () => {
    expect(WEBi_SYSTEM_PROMPT).not.toContain("## Capture de Lead (LOT 38a bis)");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("IMPORTANT — UNE SEULE FOIS");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("accord implicite");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("Exemple A");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("Exemple B");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("RÈGLE ABSOLUE");
  });

  it("no longer contains the explicit-oral-consent trigger (v1.3.0)", () => {
    expect(WEBi_SYSTEM_PROMPT).not.toContain("accord oral simple");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("(LOT 38a)");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("Puis-je noter vos coordonnées");
  });
});
