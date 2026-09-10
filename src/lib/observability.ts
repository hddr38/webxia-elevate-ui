import { EventEmitter } from "events";

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { status: "pass" | "fail" | "warn"; message?: string }>;
  timestamp: number;
}

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  requestId?: string;
  conversationId?: string;
  provider?: string;
  durationMs?: number;
  event?: string;
  errorType?: string;
  metadata?: Record<string, unknown>;
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

class StructuredLogger extends EventEmitter {
  private logLevel: "debug" | "info" | "warn" | "error" = "info";

  setLevel(level: "debug" | "info" | "warn" | "error"): void {
    this.logLevel = level;
  }

  private shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    entry: Omit<LogEntry, "level" | "timestamp">,
  ): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      ...entry,
      level,
      timestamp: Date.now(),
    };

    this.emit("log", logEntry);

    const sanitized = this.sanitizeEntry(logEntry);
    const logLine = JSON.stringify(sanitized);

    switch (level) {
      case "debug":
        console.debug(logLine);
        break;
      case "info":
        console.log(logLine);
        break;
      case "warn":
        console.warn(logLine);
        break;
      case "error":
        console.error(logLine);
        break;
    }
  }

  private sanitizeEntry(entry: LogEntry): LogEntry {
    const sanitized = { ...entry };
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata);
    }
    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      "apiKey",
      "api_key",
      "token",
      "secret",
      "password",
      "authorization",
      "cookie",
      "session",
      "key",
      "secret",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  debug(message: string, meta?: Omit<LogEntry, "level" | "timestamp" | "message">): void {
    this.log("debug", { message, ...meta });
  }

  info(message: string, meta?: Omit<LogEntry, "level" | "timestamp" | "message">): void {
    this.log("info", { message, ...meta });
  }

  warn(message: string, meta?: Omit<LogEntry, "level" | "timestamp" | "message">): void {
    this.log("warn", { message, ...meta });
  }

  error(message: string, meta?: Omit<LogEntry, "level" | "timestamp" | "message">): void {
    this.log("error", { message, ...meta });
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
export const logger = new StructuredLogger();
export const healthChecker = new HealthChecker();

// Pre-defined metric helpers
export function recordRequest(provider?: string): void {
  metrics.increment("webi_requests_total", { provider: provider || "unknown" });
}

export function recordRequestLatency(durationMs: number, provider?: string): void {
  metrics.histogram("webi_request_duration_ms", durationMs, { provider: provider || "unknown" });
}

export function recordProviderLatency(durationMs: number, provider: string): void {
  metrics.histogram("webi_provider_latency_ms", durationMs, { provider });
}

export function recordLLMError(provider: string, errorType: string): void {
  metrics.increment("webi_llm_errors_total", { provider, error_type: errorType });
}

export function recordToolError(toolName: string, errorType: string): void {
  metrics.increment("webi_tool_errors_total", { tool: toolName, error_type: errorType });
}

export function recordRateLimitEvent(identifier: string, type: "ip" | "user"): void {
  metrics.increment("webi_rate_limit_exceeded_total", { type, identifier });
}

export function recordTokenUsage(
  promptTokens: number,
  completionTokens: number,
  provider: string,
): void {
  metrics.histogram("webi_tokens_prompt", promptTokens, { provider });
  metrics.histogram("webi_tokens_completion", completionTokens, { provider });
  metrics.histogram("webi_tokens_total", promptTokens + completionTokens, { provider });
}

export function recordAgentSteps(steps: number): void {
  metrics.histogram("webi_agent_steps", steps);
}

export function recordActiveConversations(count: number): void {
  metrics.gauge("webi_active_conversations", count);
}

export function recordActiveUsers(count: number): void {
  metrics.gauge("webi_active_users", count);
}

// Default health checks
healthChecker.registerCheck("application", async () => ({
  status: "pass",
  message: "Application is running",
}));
