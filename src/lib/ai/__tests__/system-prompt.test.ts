import { describe, it, expect } from "vitest";
import { WEBi_SYSTEM_PROMPT, WEBi_SYSTEM_PROMPT_VERSION } from "../agent/system-prompt";

describe("system prompt", () => {
  it("is version 1.3.2", () => {
    expect(WEBi_SYSTEM_PROMPT_VERSION).toBe("1.3.2");
  });

  it("contains the LOT 38a bis lead-capture trigger (implicit consent)", () => {
    expect(WEBi_SYSTEM_PROMPT).toContain("## Capture de Lead (LOT 38a bis)");
    expect(WEBi_SYSTEM_PROMPT).toContain("RÈGLE ABSOLUE");
    expect(WEBi_SYSTEM_PROMPT).toContain("save_lead");
    expect(WEBi_SYSTEM_PROMPT).toContain("accord implicite");
    expect(WEBi_SYSTEM_PROMPT).toContain("IMMÉDIATEMENT");
    expect(WEBi_SYSTEM_PROMPT).toContain("Exemple A");
    expect(WEBi_SYSTEM_PROMPT).toContain("Exemple B");
  });

  it("contains the one-shot save_lead guard (v1.3.2, FIX A')", () => {
    expect(WEBi_SYSTEM_PROMPT).toContain("IMPORTANT — UNE SEULE FOIS");
    expect(WEBi_SYSTEM_PROMPT).toContain("N'APPELLE PLUS");
  });

  it("no longer contains the explicit-oral-consent trigger (v1.3.0)", () => {
    expect(WEBi_SYSTEM_PROMPT).not.toContain("accord oral simple");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("(LOT 38a)");
    expect(WEBi_SYSTEM_PROMPT).not.toContain("Puis-je noter vos coordonnées");
  });
});
