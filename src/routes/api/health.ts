import { createFileRoute } from "@tanstack/react-router";
import { collectHealthSnapshot } from "@/server/functions/health";

type OverallStatus = "healthy" | "degraded" | "unhealthy";
type CheckName = "db" | "llm_provider" | "embeddings";
type CheckStatus = "ok" | "degraded" | "failed";
type RawCheckKey = "database" | "nvidia_provider" | "embedding_provider";
type RawCheckStatus = "pass" | "warn" | "fail" | undefined;

interface HealthCheckBody {
  name: CheckName;
  status: CheckStatus;
}

export interface HealthResponseBody {
  status: OverallStatus;
  checks: HealthCheckBody[];
  duration_ms: number;
  timestamp: string;
  version: string;
}

// Whitelist stricte : seules ces entrées du snapshot (`collectHealthSnapshot`)
// sont exposées, sous un nom normalisé. Toute autre clé (actuelle ou future)
// est ignorée par construction — `metrics` (qui porte des identifiants IP),
// `checks.*.message` (erreurs DB), `uptimeMs` et `timestamp` brut sont jetés.
const CHECKS: ReadonlyArray<{ key: RawCheckKey; name: CheckName }> = [
  { key: "database", name: "db" },
  { key: "nvidia_provider", name: "llm_provider" },
  { key: "embedding_provider", name: "embeddings" },
];

function mapOverallStatus(status: OverallStatus | undefined): OverallStatus {
  if (status === "healthy" || status === "degraded") return status;
  return "unhealthy";
}

function mapCheckStatus(status: RawCheckStatus): CheckStatus {
  if (status === "pass") return "ok";
  if (status === "warn") return "degraded";
  return "failed";
}

function sanitize(raw: Awaited<ReturnType<typeof collectHealthSnapshot>>): HealthResponseBody {
  const checks: HealthCheckBody[] = CHECKS.map(({ key, name }) => ({
    name,
    status: mapCheckStatus(raw.checks[key].status),
  }));

  return {
    status: mapOverallStatus(raw.status),
    checks,
    duration_ms: raw.durationMs,
    timestamp: new Date().toISOString(),
    // LOT 33 — SHA inline au build (define Vite) : COMMIT_REF n'est pas
    // disponible au runtime de la fonction Netlify.
    version: __COMMIT_SHA__,
  };
}

function jsonResponse(body: HealthResponseBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleHealthRequest(request: Request): Promise<Response> {
  try {
    const raw = await collectHealthSnapshot(request);
    const body = sanitize(raw);
    return jsonResponse(body, body.status === "unhealthy" ? 503 : 200);
  } catch (error) {
    // Log serveur uniquement : jamais retourné au client (pas de leak).
    console.error("[health] unexpected error", error);
    return jsonResponse(
      {
        status: "unhealthy",
        checks: [],
        duration_ms: 0,
        timestamp: new Date().toISOString(),
        version: __COMMIT_SHA__,
      },
      503,
    );
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => handleHealthRequest(request),
    },
  },
});
