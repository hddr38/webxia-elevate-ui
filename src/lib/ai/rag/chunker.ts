/**
 * Pure text chunker for RAG ingestion. No Supabase, no NVIDIA, no I/O.
 *
 * Strategy (in order of preference):
 *  1. paragraph boundaries (blank lines),
 *  2. sentence boundaries (. ! ? … followed by whitespace),
 *  3. word boundaries (spaces),
 *  4. hard cut — only under absolute constraint (a single token longer
 *     than maxChars). Words are never split when avoidable.
 *
 * Short documents produce exactly 1 chunk. Chunks are ordered and carry
 * their index plus character offsets for traceability.
 */

export interface ChunkerOptions {
  /** Maximum characters per chunk. Default 2000. */
  maxChars?: number;
  /** Overlap reseeded from the previous chunk. Default 200. */
  overlapChars?: number;
}

export const DEFAULT_CHUNKER_OPTIONS: Required<ChunkerOptions> = {
  maxChars: 2000,
  overlapChars: 200,
};

export interface TextChunk {
  index: number;
  content: string;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
}

function resolveOptions(options: ChunkerOptions = {}): Required<ChunkerOptions> {
  const maxChars = Math.max(200, Math.floor(options.maxChars ?? DEFAULT_CHUNKER_OPTIONS.maxChars));
  const overlapChars = Math.min(
    Math.max(0, Math.floor(options.overlapChars ?? DEFAULT_CHUNKER_OPTIONS.overlapChars)),
    Math.floor(maxChars / 2),
  );
  return { maxChars, overlapChars };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Splits a long paragraph into sentences, keeping delimiters attached. */
function splitSentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?…]+[.!?…]+["”»)\]]*\s*|\S[^.!?…]*$/g);
  if (!parts) return [paragraph];
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Splits an oversized sentence on word boundaries. */
function splitWords(sentence: string, maxChars: number): string[] {
  const words = sentence.split(/\s+/).filter((word) => word.length > 0);
  const pieces: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxChars) {
      if (current.length > 0) {
        pieces.push(current);
        current = "";
      }
      // Absolute constraint: hard-cut the oversized token.
      for (let offset = 0; offset < word.length; offset += maxChars) {
        pieces.push(word.slice(offset, offset + maxChars));
      }
      continue;
    }
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current.length > 0) {
      pieces.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/** Reduces one paragraph to units that each fit in maxChars. */
function fitParagraph(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const units: string[] = [];
  for (const sentence of splitSentences(paragraph)) {
    if (sentence.length <= maxChars) {
      units.push(sentence);
    } else {
      units.push(...splitWords(sentence, maxChars));
    }
  }
  return units;
}

/** Seed for the next chunk: tail of the previous one, word-aligned. */
function overlapSeed(previous: string, overlapChars: number): string {
  if (overlapChars <= 0 || previous.length <= overlapChars) return "";
  const tail = previous.slice(previous.length - overlapChars);
  const firstSpace = tail.search(/\s/);
  return firstSpace > 0 ? tail.slice(firstSpace + 1) : tail;
}

function toChunks(pieces: string[]): TextChunk[] {
  let cursor = 0;
  return pieces.map((content, index) => {
    const charStart = cursor;
    cursor += content.length + 1;
    return {
      index,
      content,
      charStart,
      charEnd: charStart + content.length,
      tokenEstimate: estimateTokens(content),
    };
  });
}

/**
 * Chunks raw text into ordered pieces. Returns [] for empty input,
 * a single chunk for short documents.
 */
export function chunkTextIntoPieces(text: string, options: ChunkerOptions = {}): TextChunk[] {
  const { maxChars, overlapChars } = resolveOptions(options);
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];
  if (normalized.length <= maxChars) {
    return toChunks([normalized]);
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const pieces: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) {
      pieces.push(current);
      const seed = overlapSeed(current, overlapChars);
      current = seed;
    }
  };

  const appendUnit = (unit: string) => {
    const glue = current.length > 0 ? "\n\n" : "";
    const candidate = current.length > 0 ? `${current}${glue}${unit}` : unit;
    if (candidate.length > maxChars && current.length > 0) {
      flush();
      // After flush, `current` holds the overlap seed (maybe "").
      const retry = current.length > 0 ? `${current}\n\n${unit}` : unit;
      current = retry.length > maxChars ? unit : retry;
    } else {
      current = candidate;
    }
  };

  for (const paragraph of paragraphs) {
    for (const unit of fitParagraph(paragraph, maxChars)) {
      appendUnit(unit);
    }
  }
  if (current.length > 0) {
    // Avoid emitting a trailing piece that is pure overlap of the last one.
    const last = pieces[pieces.length - 1] ?? "";
    if (current !== last) pieces.push(current);
  }
  return toChunks(pieces.filter((piece) => piece.length > 0));
}

/** Convenience helper returning chunk contents only. */
export function chunkText(text: string, options: ChunkerOptions = {}): string[] {
  return chunkTextIntoPieces(text, options).map((piece) => piece.content);
}
