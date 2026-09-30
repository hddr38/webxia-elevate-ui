import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectHealthSnapshot } from "@/server/functions/health";
import { handleHealthRequest, type HealthResponseBody } from "./health";

vi.mock("@/server/functions/health", () => ({
  collectHealthSnapshot: vi.fn(),
}));

const snapshotMock = vi.mocked(collectHealthSnapshot);
const FORBIDDEN_KEY = /password|secret|token|url|connection|host|port|stack|error/i;
const IP_FIXTURE = "203.0.113.7";
const REQUEST = new Request("http://localhost/api/health");

type RawHealth = Awaited<ReturnType<typeof collectHealthSnapshot>>;

function rawHealth(
  status: "healthy" | "degraded" | "unhealthy",
  checkStatus: "pass" | "warn" | "fail",
): RawHealth {
  return {
    status,
    checks: {
      database: { status: checkStatus, message: "Database connection successful" },
      nvidia_provider: { status: checkStatus, message: "NVIDIA NIM provider available" },
      embedding_provider: { status: checkStatus, message: "Embedding provider available" },
    },
    durationMs: 12,
    metrics: {
      [`webi_rate_limit_exceeded_total{type="ip", identifier="${IP_FIXTURE}"}`]: 4,
    },
    uptimeMs: 1000,
  };
}

function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, acc));
  else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      acc.push(key);
      collectKeys(nested, acc);
    }
  }
  return acc;
}

async function readBody(res: Response): Promise<HealthResponseBody> {
  return (await res.json()) as HealthResponseBody;
}

/** Cohérence imposée : unhealthy ⇔ 503, healthy|degraded ⇔ 200. */
function expectConsistency(body: HealthResponseBody, status: number): void {
  expect(body.status === "unhealthy").toBe(status === 503);
  expect(status === 503 ? 503 : 200).toBe(status);
}

describe("GET /api/health", () => {
  beforeEach(() => {
    snapshotMock.mockReset();
  });

  it("healthy → 200, JSON minimal, Cache-Control no-store, aucune donnée sensible", async () => {
    snapshotMock.mockResolvedValue(rawHealth("healthy", "pass"));

    const res = await handleHealthRequest(REQUEST);
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expectConsistency(body, res.status);

    expect(Object.keys(body).sort()).toEqual([
      "checks",
      "duration_ms",
      "status",
      "timestamp",
      "version",
    ]);
    expect(body.status).toBe("healthy");
    expect(body.duration_ms).toBe(12);
    expect(body.checks).toEqual([
      { name: "db", status: "ok" },
      { name: "llm_provider", status: "ok" },
      { name: "embeddings", status: "ok" },
    ]);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.version).toBe("string");

    expect(JSON.stringify(collectKeys(body))).not.toMatch(FORBIDDEN_KEY);
    expect(JSON.stringify(body)).not.toContain(IP_FIXTURE);
    expect(JSON.stringify(body)).not.toContain("Database connection successful");
  });

  it("unhealthy → 503 et status unhealthy", async () => {
    snapshotMock.mockResolvedValue(rawHealth("unhealthy", "fail"));

    const res = await handleHealthRequest(REQUEST);
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("unhealthy");
    expectConsistency(body, res.status);
    expect(body.checks).toEqual([
      { name: "db", status: "failed" },
      { name: "llm_provider", status: "failed" },
      { name: "embeddings", status: "failed" },
    ]);
  });

  it("degraded → 200 et status degraded", async () => {
    snapshotMock.mockResolvedValue(rawHealth("degraded", "warn"));

    const res = await handleHealthRequest(REQUEST);
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("degraded");
    expectConsistency(body, res.status);
    expect(body.checks).toEqual([
      { name: "db", status: "degraded" },
      { name: "llm_provider", status: "degraded" },
      { name: "embeddings", status: "degraded" },
    ]);
  });

  it("collectHealthSnapshot throw → 503 avec body générique (sans message d'erreur)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    snapshotMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));

    const res = await handleHealthRequest(REQUEST);
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "unhealthy",
      checks: [],
      duration_ms: 0,
      timestamp: expect.any(String),
      // LOT 33 — version = SHA inline au build (define Vite, "dev" en local).
      version: __COMMIT_SHA__,
    });
    expectConsistency(body, res.status);
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");

    consoleError.mockRestore();
  });

  it("whitelist : noms normalisés, statuts mappés, clé inconnue ignorée", async () => {
    const raw = rawHealth("degraded", "warn");
    snapshotMock.mockResolvedValue({
      ...raw,
      checks: {
        ...raw.checks,
        internal_debug: { status: "pass", message: "leak" },
      },
    } as unknown as RawHealth);

    const res = await handleHealthRequest(REQUEST);
    const body = await readBody(res);

    expect(body.checks).toEqual([
      { name: "db", status: "degraded" },
      { name: "llm_provider", status: "degraded" },
      { name: "embeddings", status: "degraded" },
    ]);
    expect(JSON.stringify(body)).not.toContain("internal_debug");
    expect(JSON.stringify(collectKeys(body))).not.toMatch(FORBIDDEN_KEY);
    expectConsistency(body, res.status);
  });
});
