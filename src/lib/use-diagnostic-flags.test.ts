// @vitest-environment happy-dom
/**
 * DIAG temporaire — branche `diagnostic/mobile-home` UNIQUEMENT.
 * Verifie que chaque `?diag=` active exactement son flag (indépendance),
 * et que l'absence / valeur inconnue rend un état tout-`false`
 * (pixel-perfect vs main).
 */
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { parseDiagnosticFlags, useDiagnosticFlags } from "@/lib/use-diagnostic-flags";

function Probe() {
  const flags = useDiagnosticFlags();
  return React.createElement("span", { "data-testid": "probe" }, JSON.stringify(flags));
}

function renderProbeAt(url: string) {
  window.history.pushState({}, "", url);
  return render(React.createElement(Probe));
}

describe("parseDiagnosticFlags (diag mobile)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("sans param : tout false, diag null (identique à main)", () => {
    expect(parseDiagnosticFlags("")).toEqual({
      diag: null,
      noCanvas: false,
      noBlobs: false,
      noHeaderBlur: false,
      noCardBlur: false,
      noAnimations: false,
      noMarquee: false,
      minimal: false,
      allOff: false,
    });
  });

  it("baseline : tout false", () => {
    const flags = parseDiagnosticFlags("?diag=baseline");
    expect(flags.diag).toBe("baseline");
    expect(Object.values(flags).every((v) => v === false || typeof v === "string")).toBe(true);
    expect(flags.noCanvas).toBe(false);
    expect(flags.allOff).toBe(false);
  });

  it("chaque flag simple n'active que son booléen (indépendance)", () => {
    const cases = [
      ["no-canvas", "noCanvas"],
      ["no-blobs", "noBlobs"],
      ["no-header-blur", "noHeaderBlur"],
      ["no-card-blur", "noCardBlur"],
      ["no-animations", "noAnimations"],
      ["no-marquee", "noMarquee"],
    ] as const;
    for (const [param, key] of cases) {
      const flags = parseDiagnosticFlags(`?diag=${param}`);
      expect(flags[key]).toBe(true);
      for (const [, other] of cases) {
        if (other !== key) expect(flags[other]).toBe(false);
      }
      expect(flags.minimal).toBe(false);
      expect(flags.allOff).toBe(false);
    }
  });

  it("minimal : hero minimal + header sobre, sans card-blur", () => {
    const flags = parseDiagnosticFlags("?diag=minimal");
    expect(flags.minimal).toBe(true);
    expect(flags.noCanvas).toBe(true);
    expect(flags.noBlobs).toBe(true);
    expect(flags.noHeaderBlur).toBe(true);
    expect(flags.noAnimations).toBe(true);
    expect(flags.noMarquee).toBe(true);
    expect(flags.noCardBlur).toBe(false);
    expect(flags.allOff).toBe(false);
  });

  it("all-off : tous les sous-flags actifs", () => {
    const flags = parseDiagnosticFlags("?diag=all-off");
    expect(flags.allOff).toBe(true);
    expect(flags.noCanvas).toBe(true);
    expect(flags.noBlobs).toBe(true);
    expect(flags.noHeaderBlur).toBe(true);
    expect(flags.noCardBlur).toBe(true);
    expect(flags.noAnimations).toBe(true);
    expect(flags.noMarquee).toBe(true);
  });

  it("valeur inconnue : tout false (retour au normal)", () => {
    const flags = parseDiagnosticFlags("?diag=nimporte-quoi");
    expect(flags.diag).toBe("nimporte-quoi");
    expect(flags.noCanvas).toBe(false);
    expect(flags.noMarquee).toBe(false);
    expect(flags.allOff).toBe(false);
  });

  it("ignore les autres query params", () => {
    const flags = parseDiagnosticFlags("?foo=1&diag=no-blobs&bar=2");
    expect(flags.noBlobs).toBe(true);
    expect(flags.noCanvas).toBe(false);
  });

  it("hook : lit l'URL courante", () => {
    const { getByTestId, unmount } = renderProbeAt("/?diag=no-header-blur");
    const flags = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(flags.noHeaderBlur).toBe(true);
    expect(flags.noCanvas).toBe(false);
    unmount();
  });

  it("hook : sans diag, tout false", () => {
    const { getByTestId, unmount } = renderProbeAt("/");
    const flags = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(flags.diag).toBeNull();
    expect(flags.noAnimations).toBe(false);
    unmount();
  });
});
