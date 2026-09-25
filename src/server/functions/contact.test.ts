import { describe, expect, it } from "vitest";
import {
  ListContactMessagesSchema,
  SubmitContactMessageSchema,
  UpdateContactMessageStatusSchema,
} from "@/lib/admin/schemas";

const validPayload = {
  name: "Marie Dupont",
  email: "marie@entreprise.fr",
  company: "Entreprise",
  budget: "5k-10k",
  message: "Décrivez votre projet, vos délais et votre budget, en détail.",
  locale: "fr",
  website: "",
} as const;

describe("SubmitContactMessageSchema", () => {
  it("accepte un brief valide (honeypot vide)", () => {
    const parsed = SubmitContactMessageSchema.parse({ ...validPayload });
    expect(parsed.email).toBe("marie@entreprise.fr");
    expect(parsed.locale).toBe("fr");
  });

  it("applique les défauts (locale fr, honeypot vide)", () => {
    const { locale, website, ...rest } = validPayload;
    void locale;
    void website;
    const parsed = SubmitContactMessageSchema.parse(rest);
    expect(parsed.locale).toBe("fr");
    expect(parsed.website).toBe("");
  });

  it("laisse passer un honeypot rempli (rejet silencieux côté handler)", () => {
    const parsed = SubmitContactMessageSchema.parse({
      ...validPayload,
      website: "http://spam.example",
    });
    expect(parsed.website).toBe("http://spam.example");
  });

  it("rejette un nom trop court, un email invalide et un message trop court", () => {
    expect(() => SubmitContactMessageSchema.parse({ ...validPayload, name: "A" })).toThrow();
    expect(() =>
      SubmitContactMessageSchema.parse({ ...validPayload, email: "pas-un-email" }),
    ).toThrow();
    expect(() => SubmitContactMessageSchema.parse({ ...validPayload, message: "trop" })).toThrow();
  });

  it("rejette un message gigantesque (anti-abus)", () => {
    expect(() =>
      SubmitContactMessageSchema.parse({ ...validPayload, message: "x".repeat(5001) }),
    ).toThrow();
  });
});

describe("ListContactMessagesSchema", () => {
  it("laisse les défauts au handler (absent = undefined, comme ListArticlesSchema)", () => {
    const parsed = ListContactMessagesSchema.parse({});
    expect(parsed.status).toBeUndefined();
    expect(parsed.page).toBeUndefined();
  });

  it("accepte un filtre statut + page explicites", () => {
    const parsed = ListContactMessagesSchema.parse({ status: "new", page: 2 });
    expect(parsed.status).toBe("new");
    expect(parsed.page).toBe(2);
  });

  it("rejette un statut inconnu", () => {
    expect(() => ListContactMessagesSchema.parse({ status: "archived" })).toThrow();
  });
});

describe("UpdateContactMessageStatusSchema", () => {
  it("accepte new/read avec un uuid valide", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(UpdateContactMessageStatusSchema.parse({ id, status: "read" }).status).toBe("read");
  });

  it("rejette un id non-uuid", () => {
    expect(() => UpdateContactMessageStatusSchema.parse({ id: "abc", status: "read" })).toThrow();
  });
});
