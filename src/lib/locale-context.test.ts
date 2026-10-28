/**
 * LOT 5.2-pre-b — garde-fou de non-régression i18n.
 *
 * Lecture directe des dictionnaires existants (`translations`) : aucun appel
 * réseau, aucun appel LLM, aucun snapshot, aucune modification de la
 * configuration Vitest.
 *
 * Clés corrigées dans ce lot :
 *   - about.process.subtitle : présente en FR, absente du bloc EN.
 *   - admin.common.prev      : absente des deux blocs.
 *   - admin.common.next      : absente des deux blocs.
 *
 * LIMITES CONNUES — ne pas surinterpréter ce test :
 * 1. Un test de parité seul NE détecte pas une clé absente des DEUX langues :
 *    elle est alors symétriquement absente et les deux ensembles restent
 *    égaux. Les assertions de présence des trois clés ci-dessous compensent
 *    ce angle mort pour ces clés uniquement, pas pour le reste du
 *    dictionnaire.
 * 2. Ce test ne prétend PAS couvrir les appels dynamiques :
 *    `t(\`…${var}\`)`, `tDynamic(prefix, value)` et `t(<identifiant>)` restent
 *    hors de son périmètre.
 * 3. Aucun snapshot : la totalité des traductions n'est pas figée ici, afin
 *    qu'une modification de contenu reste un choix explicite et non une
 *    mise à jour aveugle de golden file.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { translations } from "@/lib/locale-context";

const LOCALES = ["fr", "en"] as const;

const REQUIRED_KEYS = [
  "about.process.subtitle",
  "admin.common.prev",
  "admin.common.next",
  // FIX-MEMORY-DATE : le bouton d'annulation du formulaire mémoire affichait
  // la clé brute `admin.common.cancel` (clé absente des deux blocs).
  "admin.common.cancel",
] as const;

type Locale = (typeof LOCALES)[number];

function read(locale: Locale, key: string): string {
  const value: unknown = translations[locale][key];
  if (typeof value !== "string") {
    throw new Error(`Missing translation: ${locale}["${key}"]`);
  }
  return value;
}

function has(locale: Locale, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(translations[locale], key);
}

const cases = REQUIRED_KEYS.flatMap((key) => LOCALES.map((locale) => ({ key, locale })));

describe("i18n parity", () => {
  it("declares the exact same set of keys in fr and en", () => {
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();

    expect(frKeys.length).toBeGreaterThan(0);
    expect(frKeys).toEqual(enKeys);
  });
});

describe("corrected keys are present in both locales", () => {
  it.each(REQUIRED_KEYS)("%s exists in fr", (key) => {
    expect(has("fr", key)).toBe(true);
  });

  it.each(REQUIRED_KEYS)("%s exists in en", (key) => {
    expect(has("en", key)).toBe(true);
  });
});

describe("corrected keys carry a usable value", () => {
  it.each(cases)("$key has a non-empty value in $locale", ({ key, locale }) => {
    expect(read(locale, key).trim()).not.toBe("");
  });

  it.each(cases)("$key value is not the key itself in $locale", ({ key, locale }) => {
    expect(read(locale, key)).not.toBe(key);
  });
});

/**
 * FIX-MEMORY-DATE — le bouton d'annulation du formulaire mémoire doit passer
 * par `t("admin.common.cancel")`, pas par un littéral.
 *
 * Approche source (comme `-__root.test.tsx` / `hero-blur-guard.test.ts`) :
 * aucun rendu de la route (ni QueryClient, ni router) — on vérifie le lien
 * clé <-> composant. L'assertion de valeur FR/EN est portée par les blocs
 * ci-dessus ; ici on ne prétend pas couvrir le rendu.
 */
describe("admin.ai-memory form cancel button uses the translated key", () => {
  const source = readFileSync(
    new URL("../routes/admin/ai-memory/index.tsx", import.meta.url),
    "utf8",
  );

  it('uses t("admin.common.cancel") as cancel label', () => {
    expect(source).toContain('t("admin.common.cancel")');
  });

  it("keeps the key as the only cancel label source (no hardcoded FR/EN literal)", () => {
    const hasHardcodedCancel = />\s*(Annuler|Cancel)\s*</.test(source);
    expect(hasHardcodedCancel).toBe(false);
  });

  it("admin.common.cancel resolves to the expected FR / EN labels", () => {
    expect(translations.fr["admin.common.cancel"]).toBe("Annuler");
    expect(translations.en["admin.common.cancel"]).toBe("Cancel");
  });
});
