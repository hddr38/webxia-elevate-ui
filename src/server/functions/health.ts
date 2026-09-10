import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestMiddleware } from "./conversations";
import { healthChecker, metrics } from "@/lib/observability";
import { NvidiaProvider } from "@/lib/ai/providers/nvidia";

type HealthCheck = { status: "pass" | "warn" | "fail"; message: string };

async function runHealthChecks(request: Request): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  checks: { database: HealthCheck; nvidia_provider: HealthCheck; embedding_provider: HealthCheck };
  durationMs: number;
}> {
  const startTime = Date.now();

  // Database health check
  const dbCheck = async (): Promise<HealthCheck> => {
    try {
      const supabase = createSupabaseServerClient(request);
      const { error } = await supabase.from("conversations").select("id").limit(1);
      if (error) throw error;
      return { status: "pass", message: "Database connection successful" };
    } catch (error) {
      return {
        status: "fail",
        message: error instanceof Error ? error.message : "Database unavailable",
      };
    }
  };

  // Provider health check
  const providerCheck = async (): Promise<HealthCheck> => {
    try {
      const provider = new NvidiaProvider();
      await provider.initialize({
        apiKey: process.env.NVIDIA_NIM_API_KEY!,
        baseUrl: process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
        timeout: 5000,
        maxRetries: 1,
      });
      const available = provider.isAvailable();
      return {
        status: available ? "pass" : "warn",
        message: available ? "NVIDIA NIM provider available" : "NVIDIA NIM provider not available",
      };
    } catch (error) {
      return {
        status: "fail",
        message: error instanceof Error ? error.message : "Provider check failed",
      };
    }
  };

  // Embedding provider health check
  const embeddingCheck = async (): Promise<HealthCheck> => {
    try {
      const { NvidiaEmbeddingProvider } = await import("@/lib/ai/embeddings/nvidia");
      const provider = new NvidiaEmbeddingProvider();
      await provider.initialize({
        apiKey: process.env.NVIDIA_NIM_API_KEY!,
        baseUrl: process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
        timeout: 5000,
        maxRetries: 1,
      });
      const available = provider.isAvailable();
      return {
        status: available ? "pass" : "warn",
        message: available ? "Embedding provider available" : "Embedding provider not available",
      };
    } catch (error) {
      return {
        status: "fail",
        message: error instanceof Error ? error.message : "Embedding provider check failed",
      };
    }
  };

  // Run all checks
  const [dbResult, providerResult, embeddingResult] = await Promise.allSettled([
    dbCheck(),
    providerCheck(),
    embeddingCheck(),
  ]);

  const checks = {
    database:
      dbResult.status === "fulfilled"
        ? dbResult.value
        : {
            status: "fail" as const,
            message:
              dbResult.reason instanceof Error ? dbResult.reason.message : "Database check failed",
          },
    nvidia_provider:
      providerResult.status === "fulfilled"
        ? providerResult.value
        : {
            status: "fail" as const,
            message:
              providerResult.reason instanceof Error
                ? providerResult.reason.message
                : "Provider check failed",
          },
    embedding_provider:
      embeddingResult.status === "fulfilled"
        ? embeddingResult.value
        : {
            status: "fail" as const,
            message:
              embeddingResult.reason instanceof Error
                ? embeddingResult.reason.message
                : "Embedding check failed",
          },
  };

  const overallStatus = Object.values(checks).every((c) => c.status === "pass")
    ? "healthy"
    : Object.values(checks).some((c) => c.status === "fail")
      ? "unhealthy"
      : "degraded";

  return { status: overallStatus, checks, durationMs: Date.now() - startTime };
}

export const health = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .handler(async ({ context }) => {
    const request = context.request;
    const { status, checks, durationMs } = await runHealthChecks(request);

    // Record health check metrics
    metrics.histogram("webi_health_check_duration_ms", durationMs);

    return {
      status,
      checks,
      timestamp: Date.now(),
      version: process.env.npm_package_version ?? "unknown",
      durationMs,
    };
  });

export const healthDetailed = createServerFn({ method: "GET" })
  .middleware([requestMiddleware])
  .handler(async ({ context }) => {
    const request = context.request;

    // Get metrics
    const { metrics: metricsCollector } = await import("@/lib/observability");
    const allMetrics = metricsCollector.getAllMetrics();

    // Get health checks
    const healthResult = await runHealthChecks(request);
    metrics.histogram("webi_health_check_duration_ms", healthResult.durationMs);
    const startedAt =
      (globalThis as { __webi_start_time?: number }).__webi_start_time ?? Date.now();

    return {
      ...healthResult,
      metrics: allMetrics,
      uptimeMs: Date.now() - startedAt,
    };
  });
