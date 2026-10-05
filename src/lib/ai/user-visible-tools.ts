/**
 * LOT 38a ter — whitelist des outils visibles dans le widget chat.
 *
 * Le backend émet TOUJOURS les frames tool_start/tool_result : c'est le
 * front qui décide lesquelles afficher dans l'UI (bulle role="tool",
 * indicateur ToolStatus, région sr-only). Fail-safe : whitelist VIDE en V1 —
 * aucun outil n'est affiché tant qu'il n'est pas ajouté ici explicitement.
 *
 * Pour rendre un tool visible à l'avenir : ajouter son nom exact (le skill
 * name émis par le backend, ex. "search_knowledge") dans le Set ci-dessous.
 * Note : search_knowledge est exclu du chat côté serveur
 * (CHAT_EXCLUDED_TOOLS, context-builder.ts) — ses frames ne sont donc
 * jamais émises en chat, inutile de le whitelister.
 */
export const USER_VISIBLE_TOOLS: ReadonlySet<string> = new Set();

/**
 * Décide si la frame tool d'un toolName doit être rendue dans l'UI.
 * Inconnu / non listé → masqué (fail-safe).
 */
export function shouldDisplayTool(toolName: string): boolean {
  return USER_VISIBLE_TOOLS.has(toolName);
}
