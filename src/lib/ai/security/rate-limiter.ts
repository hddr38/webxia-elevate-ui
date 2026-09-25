export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  burstAllowance?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

export interface RateLimiter {
  checkLimit(key: string): Promise<RateLimitResult>;
  resetLimit(key: string): Promise<void>;
}

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  requestCount: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, TokenBucketState>();
  private config: Required<RateLimitConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix,
      burstAllowance: config.burstAllowance ?? Math.floor(config.maxRequests * 0.1),
    };

    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, state] of this.buckets.entries()) {
        if (now - state.lastRefill > this.config.windowMs * 2) {
          this.buckets.delete(key);
        }
      }
    }, this.config.windowMs);
  }

  async checkLimit(key: string): Promise<RateLimitResult> {
    const prefixedKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const state = this.buckets.get(prefixedKey) ?? {
      tokens: this.config.maxRequests + this.config.burstAllowance,
      lastRefill: now,
      requestCount: 0,
    };

    const timePassed = now - state.lastRefill;
    const refillRate =
      (this.config.maxRequests + this.config.burstAllowance) / this.config.windowMs;
    const tokensToAdd = Math.floor(timePassed * refillRate);

    if (tokensToAdd > 0) {
      state.tokens = Math.min(
        this.config.maxRequests + this.config.burstAllowance,
        state.tokens + tokensToAdd,
      );
      state.lastRefill = now;
    }

    const allowed = state.tokens >= 1;
    if (allowed) {
      state.tokens -= 1;
      state.requestCount += 1;
    }

    this.buckets.set(prefixedKey, state);

    const resetTime = state.lastRefill + this.config.windowMs;
    const remaining = Math.max(0, Math.floor(state.tokens));

    return {
      allowed,
      remaining,
      resetTime,
      totalRequests: state.requestCount,
    };
  }

  async resetLimit(key: string): Promise<void> {
    const prefixedKey = `${this.config.keyPrefix}:${key}`;
    this.buckets.delete(prefixedKey);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }
}

export interface SlidingWindowConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface SlidingWindowEntry {
  timestamp: number;
  count: number;
}

export class SlidingWindowRateLimiter implements RateLimiter {
  private windows = new Map<string, SlidingWindowEntry[]>();
  private config: SlidingWindowConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: SlidingWindowConfig) {
    this.config = config;
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.windowMs;
      for (const [key, entries] of this.windows.entries()) {
        const validEntries = entries.filter((e) => e.timestamp > cutoff);
        if (validEntries.length === 0) {
          this.windows.delete(key);
        } else {
          this.windows.set(key, validEntries);
        }
      }
    }, this.config.windowMs);
  }

  async checkLimit(key: string): Promise<RateLimitResult> {
    const prefixedKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    let entries = this.windows.get(prefixedKey) ?? [];
    entries = entries.filter((e) => e.timestamp > cutoff);

    const totalRequests = entries.reduce((sum, e) => sum + e.count, 0);
    const allowed = totalRequests < this.config.maxRequests;

    if (allowed) {
      const currentSecond = Math.floor(now / 1000);
      const existingEntry = entries.find((e) => Math.floor(e.timestamp / 1000) === currentSecond);
      if (existingEntry) {
        existingEntry.count += 1;
      } else {
        entries.push({ timestamp: now, count: 1 });
      }
      this.windows.set(prefixedKey, entries);
    }

    const resetTime = now + this.config.windowMs;
    const remaining = Math.max(0, this.config.maxRequests - totalRequests - (allowed ? 1 : 0));

    return {
      allowed,
      remaining,
      resetTime,
      totalRequests: totalRequests + (allowed ? 1 : 0),
    };
  }

  async resetLimit(key: string): Promise<void> {
    const prefixedKey = `${this.config.keyPrefix}:${key}`;
    this.windows.delete(prefixedKey);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
  }
}

export function createRateLimiter(
  type: "token-bucket" | "sliding-window",
  config: RateLimitConfig | SlidingWindowConfig,
): RateLimiter {
  if (type === "token-bucket") {
    return new InMemoryRateLimiter(config as RateLimitConfig);
  }
  return new SlidingWindowRateLimiter(config as SlidingWindowConfig);
}

export function getClientIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
}

export function createRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(result.totalRequests + result.remaining),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  };

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    headers["Retry-After"] = String(Math.max(1, retryAfter));
  }

  return headers;
}
