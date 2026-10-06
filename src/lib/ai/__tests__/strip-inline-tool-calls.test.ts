import { describe, it, expect } from "vitest";
import { stripInlineToolCalls } from "../agent/strip-inline-tool-calls";

describe("stripInlineToolCalls", () => {
  it("removes a single function block inline", () => {
    const markup =
      "Bonjour <func" + "tion=save_lead>x" + "</param" + "eter>" + "</func" + "tion> " + "apres";
    expect(stripInlineToolCalls(markup)).toBe("Bonjour apres");
  });

  it("leaves clean text unchanged", () => {
    expect(stripInlineToolCalls("Texte propre")).toBe("Texte propre");
  });

  it("handles empty string", () => {
    expect(stripInlineToolCalls("")).toBe("");
  });

  it("removes multiple function blocks", () => {
    const m1 =
      "Un <func" +
      "tion=f1>x" +
      "</func" +
      "tion> deux <func" +
      "tion=f2>y" +
      "</func" +
      "tion> trois";
    expect(stripInlineToolCalls(m1)).toBe("Un deux trois");
  });

  it("handles malformed markup without closing tag", () => {
    expect(stripInlineToolCalls("Debut <func" + "tion=x pas de fin")).toBe(
      "Debut <func" + "tion=x pas de fin",
    );
  });

  it("handles multiline markup", () => {
    const ml = "Avant\n<func" + "tion=x>\nligne2\n" + "</func" + "tion>\nApres";
    // Properly formed with > on opening tag
    expect(stripInlineToolCalls(ml)).toBe("Avant\n\nApres");
  });

  it("removes tool_call style block", () => {
    expect(stripInlineToolCalls("Debut [TOOL_CALL]milieu[/TOOL_CALL] fin")).toBe("Debut fin");
  });

  it("removes parameter tags", () => {
    const p = "x <param" + "eter=name>val" + "</param" + "eter> y";
    expect(stripInlineToolCalls(p)).toBe("x y");
  });

  it("trims whitespace by default", () => {
    expect(stripInlineToolCalls("  spaced  ")).toBe("spaced");
  });

  it("preserves trailing spaces when trim:false", () => {
    expect(stripInlineToolCalls("  spaced  ", { trim: false })).toBe("  spaced  ");
  });
});
