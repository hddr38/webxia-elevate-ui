/**
 * LOT 38a quinquies — Extraction déterministe des coordonnées
 * côté serveur (contourne la non-déterminisme LLM).
 */

export interface ExtractedLead {
  firstName?: string;
  email?: string;
  phone?: string;
}

export function extractLeadFromMessage(message: string): ExtractedLead | null {
  if (!message) return null;

  const emailMatch = message.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = message.match(/\+?\d[\d\s.-]{8,}/);

  if (!emailMatch && !phoneMatch) return null;

  // Prénom : patterns courants FR/EN + fallback générique après "je m'appelle"
  let firstName: string | undefined;
  const namePatterns = [
    // Patterns standards FR/EN
    /(?:je m'appelle|mon prénom est|je suis|i am|my name is)\s+([A-ZÀ-Ý][a-zà-ÿ-]+)/i,
    /(?:prénom|first\s*name)\s*:?\s*([A-ZÀ-Ý][a-zà-ÿ-]+)/i,
    // Fallback : capture ce qui suit "je m'appelle" jusqu'à ponctuation
    /(?:je m'appelle)\s+([^.,\n]+)/i,
  ];
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match) {
      firstName = match[1].trim();
      break;
    }
  }

  // Dernier recours : partie avant @ de l'email
  if (!firstName && emailMatch) {
    firstName = emailMatch[0].split("@")[0];
  }

  return {
    firstName: firstName ?? "Visiteur",
    email: emailMatch?.[0],
    phone: phoneMatch?.[0]?.trim(),
  };
}
