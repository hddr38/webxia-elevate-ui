/**
 * LOT 38a quater (FIX J) — contact detection for the save_lead trigger.
 *
 * Détecte la présence d'un email OU téléphone dans un message user.
 * Le prénom n'est PAS testé (regex fragile, redondance avec la
 * détection LLM). Hypothèse : si contact fourni, le LLM a déjà
 * le prénom (tour précédent) ou le visiteur le donne en même temps.
 *
 * Anti-DoS : les messages de plus de 2000 caractères sont rejetés sans
 * analyse (la regex sur un payload géant n'est pas un risque réel mais
 * on ne paie pas le coût d'un test sur des entrées hors gabarit).
 */
export function hasContactInfo(message: string): boolean {
  if (!message || message.length > 2000) return false;
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const phoneRe = /\+?\d[\d\s.-]{8,}/;
  return emailRe.test(message) || phoneRe.test(message);
}
