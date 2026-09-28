import { expect, test } from "@playwright/test";

interface HealthBody {
  status: string;
  checks: Array<{ name: string; status: string }>;
  duration_ms: number;
  timestamp: string;
  version: string;
}

const FORBIDDEN_KEY = /password|secret|token|url|connection|host|port|stack|error/i;

function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, acc));
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      acc.push(key);
      collectKeys(nested, acc);
    }
  }
  return acc;
}

// Vrai GET HTTP contre le serveur preview (build de production) — aucun mock,
// aucun appel direct à handleHealthRequest(). Le check DB réel dépend de
// l'env : 200 en local, 503 attendu en CI (VITE_SUPABASE_URL factice).
test("GET /api/health répond un JSON minimal avec Cache-Control no-store", async ({ request }) => {
  const res = await request.get("/api/health");
  const status = res.status();
  expect([200, 503]).toContain(status);

  const body = (await res.json()) as HealthBody;

  // Cohérence status ↔ code HTTP : unhealthy ⇔ 503, sinon 200.
  expect(body.status === "unhealthy").toBe(status === 503);
  expect(status === 503 || status === 200).toBe(true);

  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(res.headers()["content-type"]).toContain("application/json");

  expect(Object.keys(body).sort()).toEqual([
    "checks",
    "duration_ms",
    "status",
    "timestamp",
    "version",
  ]);
  expect(typeof body.duration_ms).toBe("number");
  expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(typeof body.version).toBe("string");
  expect(body.checks.map((c) => c.name)).toEqual(["db", "llm_provider", "embeddings"]);
  for (const check of body.checks) {
    expect(Object.keys(check).sort()).toEqual(["name", "status"]);
    expect(["ok", "degraded", "failed"]).toContain(check.status);
  }

  expect(JSON.stringify(collectKeys(body))).not.toMatch(FORBIDDEN_KEY);
});
