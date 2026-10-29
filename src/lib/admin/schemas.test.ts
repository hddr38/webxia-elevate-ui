/**
 * FIX-MEMORY-DATE — validation et normalisation de `expires_at`.
 *
 * Couvre la logique (pas le rendu) :
 *   1. champ vide / undefined / null -> null envoyé à l'API ;
 *   2. saisie datetime-local valide   -> ISO UTC envoyé à l'API ;
 *   3. formats locaux ambigus rejetés (message clair) ;
 *   4. `null` ne casse aucune validation ;
 *   5. non-régression create / update / delete mémoire.
 *
 * Deux schémas coexistent volontairement :
 *   - MemoryFormSchema : ce que saisit l'admin (`<input type="datetime-local">`) ;
 *   - CreateMemorySchema / UpdateMemorySchema : ce que la Server Function reçoit.
 * La conversion datetime-local -> ISO UTC est faite par `toExpiresAtIso`,
 * au moment de la soumission uniquement.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AdminIdSchema,
  CreateMemorySchema,
  ExpiresAtApiSchema,
  ExpiresAtFormSchema,
  MemoryFormSchema,
  UpdateMemorySchema,
  toDateTimeLocalValue,
  toExpiresAtIso,
} from "@/lib/admin/schemas";

const SESSION_ID = "3f0a2c9e-1d5b-4f7a-9c2e-8b1d4e6f7a8b";

const baseFormValues = {
  scope: "session",
  session_id: SESSION_ID,
  memory_type: "conversation",
  key: "test-key",
  value: { content: "contenu de test" },
  metadata: {},
};

const ISO_EXAMPLE = "2030-06-28T10:04:00.000Z";
const LOCAL_EXAMPLE = "2030-06-28T10:04";

describe("expires_at — champ vide ou absent", () => {
  it("une chaîne vide est transformée en null par le formulaire", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: "" });
    expect(values.expires_at).toBeNull();
  });

  it("undefined est transformé en null par le formulaire", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: undefined });
    expect(values.expires_at).toBeNull();
  });

  it("champ vide -> null dans le payload envoyé à l'API (create)", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: "" });
    const payload = { ...baseFormValues, expires_at: toExpiresAtIso(values.expires_at) };

    expect(payload.expires_at).toBeNull();
    const parsed = CreateMemorySchema.parse(payload);
    expect(parsed.expires_at).toBeNull();
  });

  it("undefined -> null côté payload", () => {
    expect(toExpiresAtIso(undefined)).toBeNull();
    expect(ExpiresAtFormSchema.parse(undefined)).toBeNull();
    expect(ExpiresAtApiSchema.parse(undefined)).toBeNull();
  });
});

describe("expires_at — saisie datetime-local valide", () => {
  it("le formulaire accepte YYYY-MM-DDTHH:mm tel quel", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: LOCAL_EXAMPLE });
    expect(values.expires_at).toBe(LOCAL_EXAMPLE);
  });

  it("la conversion produit un ISO UTC envoyé à l'API", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: LOCAL_EXAMPLE });
    const iso = toExpiresAtIso(values.expires_at);

    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(iso).toBe(new Date(LOCAL_EXAMPLE).toISOString());

    const created = CreateMemorySchema.parse({ ...baseFormValues, expires_at: iso });
    expect(created.expires_at).toBe(iso);

    const updated = UpdateMemorySchema.parse({ id: SESSION_ID, expires_at: iso });
    expect(updated.expires_at).toBe(iso);
  });

  it("l'ISO UTC existant est ré-affiché en datetime-local (pré-remplissage édition)", () => {
    const local = toDateTimeLocalValue(ISO_EXAMPLE);

    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Indépendant du fuseau : la valeur affichée désigne le même instant.
    expect(new Date(local).getTime()).toBe(new Date(ISO_EXAMPLE).getTime());
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(undefined)).toBe("");
    expect(toDateTimeLocalValue("pas-une-date")).toBe("");
  });

  it("aller-retour datetime-local -> ISO UTC -> datetime-local est stable", () => {
    expect(toDateTimeLocalValue(toExpiresAtIso(LOCAL_EXAMPLE))).toBe(LOCAL_EXAMPLE);
  });

  it("une date invalide convertie en null (garde-fou, jamais atteinte après validation)", () => {
    expect(toExpiresAtIso("pas-une-date")).toBeNull();
  });
});

describe("expires_at — formats rejetés", () => {
  const localFormats = [
    "28/06/2030",
    "28/06/2030 10:04",
    "06/28/2030",
    "2030-06-28 10:04",
    "2030-06-28T10:04:00",
    "2030-06-28",
  ];

  it.each(localFormats)("le formulaire rejette %s avec un message clair", (value) => {
    const result = ExpiresAtFormSchema.safeParse(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("AAAA-MM-JJTHH:MM");
    }
  });

  it("le formulaire n'accepte pas un ISO UTC pendant la saisie", () => {
    expect(ExpiresAtFormSchema.safeParse(ISO_EXAMPLE).success).toBe(false);
  });

  it.each(["28/06/2030", "28/06/2030 10:04", "06/28/2030"])(
    "le payload API rejette %s avec un message clair",
    (value) => {
      const result = ExpiresAtApiSchema.safeParse(value);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("ISO 8601");
      }
    },
  );

  it("le payload create complet rejette un format local ambigu", () => {
    const result = CreateMemorySchema.safeParse({
      ...baseFormValues,
      expires_at: "28/06/2030 10:04",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("expires_at"))).toBe(true);
    }
  });
});

describe("expires_at — null sans effet de bord", () => {
  it("null est accepté par le formulaire", () => {
    const values = MemoryFormSchema.parse({ ...baseFormValues, expires_at: null });
    expect(values.expires_at).toBeNull();
  });

  it("null est accepté par create et update (efface l'expiration)", () => {
    expect(CreateMemorySchema.parse({ ...baseFormValues, expires_at: null }).expires_at).toBeNull();
    expect(UpdateMemorySchema.parse({ id: SESSION_ID, expires_at: null }).expires_at).toBeNull();
    expect(toExpiresAtIso(null)).toBeNull();
  });

  it("un payload create sans clé expires_at reste valide", () => {
    const parsed = CreateMemorySchema.parse({ ...baseFormValues });
    expect(parsed.expires_at).toBeNull();
  });
});

describe("non-régression create / update / delete mémoire", () => {
  it("create d'une mémoire de session reste valide", () => {
    const parsed = CreateMemorySchema.parse({
      ...baseFormValues,
      expires_at: toExpiresAtIso(LOCAL_EXAMPLE),
    });

    expect(parsed.scope).toBe("session");
    expect(parsed.session_id).toBe(SESSION_ID);
    expect(parsed.expires_at).toBe(toExpiresAtIso(LOCAL_EXAMPLE));
  });

  it("create d'une mémoire globale (session_id interdit) reste valide", () => {
    const parsed = CreateMemorySchema.parse({
      ...baseFormValues,
      scope: "global",
      session_id: undefined,
      expires_at: null,
    });

    expect(parsed.scope).toBe("global");
  });

  it("create globale avec session_id fourni reste rejetée", () => {
    const result = CreateMemorySchema.safeParse({
      ...baseFormValues,
      scope: "global",
      session_id: SESSION_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["session_id"]);
    }
  });

  it("update partiel (clé + valeur) reste valide", () => {
    const parsed = UpdateMemorySchema.parse({
      id: SESSION_ID,
      key: "nouvelle-cle",
      value: { content: "nouveau contenu" },
      expires_at: null,
    });

    expect(parsed.id).toBe(SESSION_ID);
    expect(parsed.key).toBe("nouvelle-cle");
    expect(parsed.expires_at).toBeNull();
  });

  it("le validateur de suppression accepte un UUID valide et rejette le reste", () => {
    expect(AdminIdSchema.parse(SESSION_ID)).toBe(SESSION_ID);
    expect(AdminIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(AdminIdSchema.safeParse("").success).toBe(false);
  });
});

/**
 * FIX-MEMORY-SCHEMA — contrat `session_id` selon le scope.
 *
 * Bug corrigé : `session_id: z.string().uuid().optional()` rejetait `null`
 * (payload formulaire d'une mémoire globale) AVANT le refine scope/session —
 * erreur Zod "expected string, received null" sur ["session_id"].
 *
 * Contrat verrouillé ici :
 *   - scope "global"  -> null ou undefined ; UUID rejeté ;
 *   - scope "session" -> UUID valide obligatoire ; null / undefined /
 *                        non-UUID rejetés ;
 *   - update : même matrice (scope non fourni = update partiel, non contraint).
 *
 * Tests 100 % unitaires : aucun appel Supabase / NVIDIA, aucun réseau.
 */
describe("FIX-MEMORY-SCHEMA — contrat session_id selon le scope", () => {
  const globalPayload = {
    scope: "global",
    session_id: null,
    memory_type: "knowledge",
    key: "fix-mem-schema",
    value: { content: "contenu de test" },
    metadata: {},
    expires_at: null,
  };

  const sessionPayload = {
    ...globalPayload,
    scope: "session",
    session_id: SESSION_ID,
  };

  const findSessionIdIssue = (result: { error: z.ZodError }) =>
    result.error.issues.find((issue) => issue.path.includes("session_id"));

  describe("CreateMemorySchema — matrice scope x session_id", () => {
    it("create : scope global + session_id null -> valide (bug corrigé)", () => {
      const parsed = CreateMemorySchema.parse(globalPayload);

      expect(parsed.scope).toBe("global");
      expect(parsed.session_id).toBeNull();
    });

    it("create : scope global + session_id undefined -> valide", () => {
      const parsed = CreateMemorySchema.parse({ ...globalPayload, session_id: undefined });

      expect(parsed.session_id).toBeUndefined();
    });

    it("create : scope global + session_id UUID -> rejeté avec message clair", () => {
      const result = CreateMemorySchema.safeParse({
        ...globalPayload,
        session_id: SESSION_ID,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toContain('interdit pour une mémoire "global"');
      }
    });

    it("create : scope session + session_id UUID -> valide", () => {
      const parsed = CreateMemorySchema.parse(sessionPayload);

      expect(parsed.scope).toBe("session");
      expect(parsed.session_id).toBe(SESSION_ID);
    });

    it("create : scope session + session_id null -> rejeté avec message clair", () => {
      const result = CreateMemorySchema.safeParse({ ...sessionPayload, session_id: null });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toContain('requis pour une mémoire "session"');
      }
    });

    it("create : scope session + session_id undefined -> rejeté", () => {
      const result = CreateMemorySchema.safeParse({ ...sessionPayload, session_id: undefined });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.path).toEqual(["session_id"]);
      }
    });

    it("create : scope session + session_id non UUID -> rejeté par le parser", () => {
      const result = CreateMemorySchema.safeParse({ ...sessionPayload, session_id: "abc-123" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toBe("Session invalide");
      }
    });

    it("create : payload global complet -> valide", () => {
      const parsed = CreateMemorySchema.parse(globalPayload);

      expect(parsed).toMatchObject({
        scope: "global",
        session_id: null,
        memory_type: "knowledge",
        key: "fix-mem-schema",
      });
      expect(parsed.expires_at).toBeNull();
    });

    it("create : payload session complet -> valide", () => {
      const parsed = CreateMemorySchema.parse(sessionPayload);

      expect(parsed).toMatchObject({
        scope: "session",
        session_id: SESSION_ID,
        memory_type: "knowledge",
      });
    });
  });

  describe("UpdateMemorySchema — même matrice", () => {
    it("update : scope global + session_id null -> valide", () => {
      const parsed = UpdateMemorySchema.parse({
        id: SESSION_ID,
        scope: "global",
        session_id: null,
        expires_at: null,
      });

      expect(parsed.session_id).toBeNull();
    });

    it("update : scope global + session_id undefined -> valide", () => {
      const parsed = UpdateMemorySchema.parse({
        id: SESSION_ID,
        scope: "global",
        session_id: undefined,
      });

      expect(parsed.session_id).toBeUndefined();
    });

    it("update : scope global + session_id UUID -> rejeté", () => {
      const result = UpdateMemorySchema.safeParse({
        id: SESSION_ID,
        scope: "global",
        session_id: SESSION_ID,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toContain('interdit pour une mémoire "global"');
      }
    });

    it("update : scope session + session_id UUID -> valide", () => {
      const parsed = UpdateMemorySchema.parse({
        id: SESSION_ID,
        scope: "session",
        session_id: SESSION_ID,
        key: "nouvelle-cle",
      });

      expect(parsed.session_id).toBe(SESSION_ID);
    });

    it("update : scope session + session_id null -> rejeté", () => {
      const result = UpdateMemorySchema.safeParse({
        id: SESSION_ID,
        scope: "session",
        session_id: null,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toContain('requis pour une mémoire "session"');
      }
    });

    it("update : scope session + session_id undefined -> rejeté", () => {
      const result = UpdateMemorySchema.safeParse({
        id: SESSION_ID,
        scope: "session",
        session_id: undefined,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.path).toEqual(["session_id"]);
      }
    });

    it("update : scope session + session_id non UUID -> rejeté par le parser", () => {
      const result = UpdateMemorySchema.safeParse({
        id: SESSION_ID,
        scope: "session",
        session_id: "abc-123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.message).toBe("Session invalide");
      }
    });

    it("update : sans scope, session_id non fourni reste un update partiel valide", () => {
      const parsed = UpdateMemorySchema.parse({
        id: SESSION_ID,
        value: { content: "maj" },
        expires_at: null,
      });

      expect(parsed.session_id).toBeUndefined();
    });
  });

  describe("cohérence formulaire -> payload API", () => {
    it("MemoryFormSchema accepte le payload global réel du formulaire (session_id undefined)", () => {
      // Le formulaire ne rend pas le champ session_id en mode "global" et le
      // remet à undefined lors de la bascule de scope (setValue L766).
      const values = MemoryFormSchema.parse({
        ...globalPayload,
        session_id: undefined,
        expires_at: "",
      });

      expect(values.session_id).toBeUndefined();
      // La conversion null->ISO n'a pas lieu : expires_at vide reste null.
      expect(values.expires_at).toBeNull();
      // Le payload de soumission (session_id: null) passe ensuite CreateMemorySchema.
      expect(
        CreateMemorySchema.parse({ ...values, session_id: toExpiresAtIso(values.expires_at) })
          .session_id,
      ).toBeNull();
    });

    it("MemoryFormSchema rejette le payload session sans UUID (champ requis)", () => {
      const result = MemoryFormSchema.safeParse({
        ...sessionPayload,
        session_id: undefined,
        expires_at: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(findSessionIdIssue(result)?.path).toEqual(["session_id"]);
      }
    });
  });

  describe("non-régression expires_at et scopes existants", () => {
    it("expires_at null / ISO UTC / datetime-local gardent leur comportement", () => {
      // 1. null -> null
      expect(
        CreateMemorySchema.parse({ ...sessionPayload, expires_at: null }).expires_at,
      ).toBeNull();
      // 2. ISO UTC (produit par toExpiresAtIso) -> accepté tel quel
      const iso = toExpiresAtIso(LOCAL_EXAMPLE);
      expect(CreateMemorySchema.parse({ ...sessionPayload, expires_at: iso }).expires_at).toBe(iso);
      // 3. format local pendant la saisie -> rejeté côté API
      expect(
        CreateMemorySchema.safeParse({ ...sessionPayload, expires_at: LOCAL_EXAMPLE }).success,
      ).toBe(false);
    });

    it("création de mémoire de session avec expiration reste valide", () => {
      const parsed = CreateMemorySchema.parse({
        ...sessionPayload,
        expires_at: toExpiresAtIso(LOCAL_EXAMPLE),
      });

      expect(parsed.session_id).toBe(SESSION_ID);
      expect(parsed.expires_at).toMatch(/\.000Z$/);
    });

    it("création globale sans clé session_id reste valide (rétrocompatibilité)", () => {
      const { session_id, ...withoutSessionId } = globalPayload;

      // Le payload historique (aucune clé session_id) reste accepté.
      expect(session_id).toBeNull();
      const parsed = CreateMemorySchema.parse(withoutSessionId);
      expect(parsed.scope).toBe("global");
    });
  });
});
