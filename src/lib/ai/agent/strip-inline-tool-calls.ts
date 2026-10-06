/**
 * LOT 38a quinquies (Option 2) — Nettoyage des tool calls inline leakés
 * dans le canal `content` du LLM (notamment en fallback sur Nemotron Lightning).
 */

export interface StripOptions {
  /**
   * Lorsque `trim` est faux, préserve les espaces de début et de fin
   * (indispensable lors du streaming temps réel pour ne pas fusionner les mots).
   * Par défaut : true.
   */
  trim?: boolean;
}

export function stripInlineToolCalls(text: string, options: StripOptions = {}): string {
  if (!text) return text;
  const shouldTrim = options.trim ?? true;

  let cleaned = text;

  // 1. Enveloppes globales
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  cleaned = cleaned.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, "");

  // 2. Balises function
  cleaned = cleaned.replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, "");
  cleaned = cleaned.replace(/<function\b[^>]*>[\s\S]*?<\/function>/gi, "");

  // 3. Balises paramètres résiduelles
  cleaned = cleaned.replace(/<parameter=[^>]*>[\s\S]*?<\/parameter>/gi, "");
  cleaned = cleaned.replace(/<parameter\b[^>]*>[\s\S]*?<\/parameter>/gi, "");

  // 4. Normalisation des sauts de ligne triples ou plus en double saut
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 5. Si trim activé (défaut), réduire espaces multiples en un seul
  if (shouldTrim) {
    cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  }

  return shouldTrim ? cleaned.trim() : cleaned;
}
