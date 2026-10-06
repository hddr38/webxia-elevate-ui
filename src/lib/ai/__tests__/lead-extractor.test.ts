import { describe, it, expect } from "vitest";
import { extractLeadFromMessage } from "../agent/lead-extractor";

describe("extractLeadFromMessage", () => {
  it("extracts firstName and email from French phrase", () => {
    expect(extractLeadFromMessage("Je m'appelle Jean, mon email est jean@ex.fr")).toEqual({
      firstName: "Jean",
      email: "jean@ex.fr",
      phone: undefined,
    });
  });

  it("extracts firstName and phone from French phrase", () => {
    expect(extractLeadFromMessage("Mon prénom est Marie, tél 06 12 34 56 78")).toEqual({
      firstName: "Marie",
      email: undefined,
      phone: "06 12 34 56 78",
    });
  });

  it("returns null when no contact info", () => {
    expect(extractLeadFromMessage("Bonjour, je veux un site")).toBeNull();
    expect(extractLeadFromMessage("")).toBeNull();
    expect(extractLeadFromMessage("   ")).toBeNull();
  });

  it("extracts email only with fallback firstName from email", () => {
    expect(extractLeadFromMessage("Contactez-moi à test@ex.fr")).toEqual({
      firstName: "test",
      email: "test@ex.fr",
      phone: undefined,
    });
  });

  it("extracts firstName with lowercase input", () => {
    expect(extractLeadFromMessage("je m'appelle jean, email jean@ex.fr")).toEqual({
      firstName: "jean",
      email: "jean@ex.fr",
      phone: undefined,
    });
  });

  it("handles English patterns", () => {
    expect(extractLeadFromMessage("My name is John, email john@test.com")).toEqual({
      firstName: "John",
      email: "john@test.com",
      phone: undefined,
    });
  });

  it("handles phone with +33 prefix", () => {
    expect(extractLeadFromMessage("Appelez-moi au +33 6 12 34 56 78")).toEqual({
      firstName: "Visiteur",
      email: undefined,
      phone: "+33 6 12 34 56 78",
    });
  });

  it("prefers first match for multiple patterns", () => {
    const result = extractLeadFromMessage(
      "Je m'appelle Alice, mon email est alice@test.com, appelez 06 12 34 56 78",
    );
    expect(result).not.toBeNull();
    expect(result!.firstName).toBe("Alice");
    expect(result!.email).toBe("alice@test.com");
    expect(result!.phone).toBe("06 12 34 56 78");
  });
});
