import { EventEmitter } from "events";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { status: "pass" | "fail" | "warn"; message?: string }>;
  timestamp: number;
}

class MetricsCollector extends EventEmitter {
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private gauges: Map<string, number> = new Map();

  increment(name: string, labels?: Record<string, string>, value = 1): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.emit("metric", { name, labels, value: current + value, type: "counter" });
  }

  decrement(name: string, labels?: Record<string, string>, value = 1): void {
    this.increment(name, labels, -value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    this.emit("metric", { name, labels, value, type: "gauge" });
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000) values.shift();
    this.histograms.set(key, values);
    this.emit("metric", { name, labels, value, type: "histogram" });
  }

  timing(name: string, durationMs: number, labels?: Record<string, string>): void {
    this.histogram(`${name}_duration_ms`, durationMs, labels);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) || 0;
  }

  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    const key = this.getKey(name, labels);
    return this.gauges.get(key);
  }

  getHistogram(name: string, labels?: Record<string, string>): number[] {
    const key = this.getKey(name, labels);
    return this.histograms.get(key) || [];
  }

  getPercentile(name: string, percentile: number, labels?: Record<string, string>): number {
    const values = this.getHistogram(name, labels).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const index = Math.ceil(values.length * percentile) - 1;
    return values[Math.max(0, index)];
  }

  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.counters) {
      result[`counter_${key}`] = value;
    }
    for (const [key, value] of this.gauges) {
      result[`gauge_${key}`] = value;
    }
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        result[`histogram_${key}_count`] = values.length;
        result[`histogram_${key}_sum`] = values.reduce((a, b) => a + b, 0);
        result[`histogram_${key}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        result[`histogram_${key}_p50`] = this.getPercentile(key.replace("histogram_", ""), 0.5);
        result[`histogram_${key}_p95`] = this.getPercentile(key.replace("histogram_", ""), 0.95);
        result[`histogram_${key}_p99`] = this.getPercentile(key.replace("histogram_", ""), 0.99);
      }
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return `${name}{${labelStr}}`;
  }
}

class HealthChecker {
  private checks: Map<
    string,
    () => Promise<{ status: "pass" | "fail" | "warn"; message?: string }>
  > = new Map();

  registerCheck(
    name: string,
    check: () => Promise<{ status: "pass" | "fail" | "warn"; message?: string }>,
  ): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<HealthCheckResult> {
    const results: Record<string, { status: "pass" | "fail" | "warn"; message?: string }> = {};
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        results[name] = result;
        if (result.status === "fail") overallStatus = "unhealthy";
        else if (result.status === "warn" && overallStatus === "healthy")
          overallStatus = "degraded";
      } catch (error) {
        results[name] = {
          status: "fail",
          message: error instanceof Error ? error.message : "Check failed",
        };
        overallStatus = "unhealthy";
      }
    }

    return {
      status: overallStatus,
      checks: results,
      timestamp: Date.now(),
    };
  }
}

export const metrics = new MetricsCollector();
const healthChecker = new HealthChecker();

// Default health checks
healthChecker.registerCheck("application", async () => ({
  status: "pass",
  message: "Application is running",
}));
