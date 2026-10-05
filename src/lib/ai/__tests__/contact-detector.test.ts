import { describe, it, expect } from "vitest";
import { hasContactInfo } from "../agent/contact-detector";

/**
 * LOT 38a quater (FIX J) — contact detection drives the forced save_lead
 * tool_choice. False positives cost a forced (but harmless) tool turn;
 * false negatives fall back to the previous LLM-driven behavior.
 */
describe("hasContactInfo (LOT 38a quater)", () => {
  it("detects a simple email", () => {
    expect(hasContactInfo("jean@exemple.fr")).toBe(true);
  });

  it("detects an email with a + tag", () => {
    expect(hasContactInfo("jean+test@exemple.fr")).toBe(true);
  });

  it("detects a French mobile phone", () => {
    expect(hasContactInfo("mon numéro est 06 12 34 56 78")).toBe(true);
  });

  it("detects an international phone number", () => {
    expect(hasContactInfo("rappelez-moi au +33 6 12 34 56 78")).toBe(true);
  });

  it("returns false when no contact is present", () => {
    expect(hasContactInfo("Bonjour, je veux un site")).toBe(false);
  });

  it("returns false for an empty message", () => {
    expect(hasContactInfo("")).toBe(false);
  });

  it("returns false for messages over 2000 chars (anti-DoS)", () => {
    expect(hasContactInfo(`jean@exemple.fr ${"a".repeat(2000)}`)).toBe(false);
  });

  // Documented false positive: a bare 10-digit run matches the phone regex.
  // Accepted in V1 (a forced save_lead without valid args just fails safely
  // server-side) — revisiting the regex is backlog material, not a blocker.
  it("matches a long digit sequence (documented false positive)", () => {
    expect(hasContactInfo("commande 1234567890")).toBe(true);
  });

  it("returns false for an incomplete email", () => {
    expect(hasContactInfo("jean@")).toBe(false);
  });

  it("returns false for a too-short phone number", () => {
    expect(hasContactInfo("je suis au 061234")).toBe(false);
  });
});
