import { describe, it, expect } from "vitest";
import { chunkText, chunkTextIntoPieces, DEFAULT_CHUNKER_OPTIONS } from "../chunker";

describe("chunker", () => {
  it("returns [] for empty or blank documents", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  \n")).toEqual([]);
  });

  it("produces a single chunk for short documents", () => {
    const pieces = chunkTextIntoPieces("Hello WebXIA. Short doc.");
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ index: 0, content: "Hello WebXIA. Short doc." });
    expect(pieces[0]?.charStart).toBe(0);
  });

  it("splits long documents on paragraph boundaries with ordered indexes", () => {
    const paragraph = "Sentence one. Sentence two. Sentence three. ";
    const text = Array.from(
      { length: 12 },
      (_, i) => `Paragraph ${i}.\n\n${paragraph.repeat(8)}`,
    ).join("\n\n");
    const pieces = chunkTextIntoPieces(text, { maxChars: 500, overlapChars: 50 });

    expect(pieces.length).toBeGreaterThan(1);
    pieces.forEach((piece, index) => {
      expect(piece.index).toBe(index);
      expect(piece.content.length).toBeLessThanOrEqual(500);
      expect(piece.tokenEstimate).toBeGreaterThan(0);
      expect(piece.charEnd).toBeGreaterThan(piece.charStart);
    });
    // Order preserved: paragraph markers appear in ascending order.
    const joined = pieces.map((piece) => piece.content).join("\n");
    let lastPos = -1;
    for (let i = 0; i < 12; i += 1) {
      const pos = joined.indexOf(`Paragraph ${i}.`);
      expect(pos).toBeGreaterThan(lastPos);
      lastPos = pos;
    }
  });

  it("never exceeds maxChars even for very long sentences", () => {
    const text = `Intro.\n\n${"word ".repeat(3000)}`;
    const pieces = chunkTextIntoPieces(text, { maxChars: 1000, overlapChars: 0 });
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.content.length).toBeLessThanOrEqual(1000);
    }
  });

  it("does not split words except under absolute constraint", () => {
    const text = `Start.\n\n${"alpha ".repeat(400)}end.`;
    const pieces = chunkTextIntoPieces(text, { maxChars: 300, overlapChars: 0 });
    for (const piece of pieces) {
      // No chunk starts or ends mid-word (space-separated vocabulary).
      expect(piece.content.startsWith(" ")).toBe(false);
    }
    const rejoined = pieces.map((piece) => piece.content).join(" ");
    expect(rejoined).toContain("alpha alpha");
    expect(rejoined).toContain("end.");
  });

  it("applies overlap between consecutive chunks", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Line ${i} with content padding.`).join(
      "\n\n",
    );
    const withOverlap = chunkTextIntoPieces(text, { maxChars: 200, overlapChars: 60 });
    const withoutOverlap = chunkTextIntoPieces(text, { maxChars: 200, overlapChars: 0 });

    expect(withOverlap.length).toBeGreaterThan(1);
    // Overlap reseeds content: total characters exceed the no-overlap variant.
    const totalWith = withOverlap.reduce((sum, piece) => sum + piece.content.length, 0);
    const totalWithout = withoutOverlap.reduce((sum, piece) => sum + piece.content.length, 0);
    expect(totalWith).toBeGreaterThan(totalWithout);
    // Consecutive chunks share vocabulary (the overlap tail is reseeded).
    const wordsOf = (text: string): string[] => text.split(/\s+/).filter((w) => w.length > 4);
    const sharesOverlap = withOverlap.slice(1).some((piece, i) => {
      const previous = new Set(wordsOf(withOverlap[i]?.content ?? ""));
      return wordsOf(piece.content).some((word) => previous.has(word));
    });
    expect(sharesOverlap).toBe(true);
  });

  it("exposes default options (2000 / 200)", () => {
    expect(DEFAULT_CHUNKER_OPTIONS.maxChars).toBe(2000);
    expect(DEFAULT_CHUNKER_OPTIONS.overlapChars).toBe(200);
  });

  it("chunkText returns contents only", () => {
    expect(chunkText("a b c")).toEqual(["a b c"]);
  });
});
