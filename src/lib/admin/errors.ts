// Helpers serveur purs : mapping d'erreurs PostgREST -> HTTP, sans fuite SQL.
// Usage : throw mapDatabaseError(error, "Article") dans les Server Functions admin.

interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

const NOT_FOUND_CODES = new Set(["PGRST116"]);
const NOT_FOUND_HINTS = ["no rows", "not found", "0 rows"];

export function isUniqueViolation(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return msg.includes("duplicate key") || msg.includes("already exists");
}

export function isNotFoundError(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code && NOT_FOUND_CODES.has(error.code)) return true;
  const msg = (error.message ?? "").toLowerCase();
  return NOT_FOUND_HINTS.some((hint) => msg.includes(hint));
}

export function mapDatabaseError(error: DbErrorLike, resource = "Ressource"): never {
  if (isUniqueViolation(error)) {
    throw new Response(`${resource} : slug déjà utilisé`, { status: 409 });
  }
  if (isNotFoundError(error)) {
    throw new Response(`${resource} introuvable`, { status: 404 });
  }
  // Ne jamais renvoyer le message SQL brut au client.
  throw new Response("Erreur de base de données", { status: 500 });
}

export function throwNotFound(resource = "Ressource"): never {
  throw new Response(`${resource} introuvable`, { status: 404 });
}
