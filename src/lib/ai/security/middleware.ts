import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIdentifier, createRateLimiter } from "./rate-limiter";
import {
  validateAndSanitize,
  ChatMessageSchema,
  isValidationError,
  sanitizeInput,
} from "./validation";
import { detectPromptInjection } from "./prompt-injection";
import { auditLogger } from "./audit-log";

const chatRateLimiter = createRateLimiter("token-bucket", {
  windowMs: 60000,
  maxRequests: 30,
  keyPrefix: "webi:chat",
  burstAllowance: 5,
});

const MAX_PAYLOAD_SIZE = 50000;

export function createSecurityMiddleware(
  options: { maxPayloadSize?: number; enablePromptInjectionCheck?: boolean } = {},
) {
  const maxPayloadSize = options.maxPayloadSize ?? MAX_PAYLOAD_SIZE;
  const enablePromptInjectionCheck = options.enablePromptInjectionCheck ?? true;

  return createMiddleware({ type: "request" }).server(async ({ request, next }) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const user = await getSessionUser(request);
      const clientId = getClientIdentifier(request, user?.id);
      const rateLimitResult = await chatRateLimiter.checkLimit(clientId);

      if (!rateLimitResult.allowed) {
        await auditLogger.logRateLimitExceeded(clientId, {
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          userAgent: request.headers.get("user-agent") ?? undefined,
          requestId,
        });

        const retryAfter = Math.max(1, Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
        return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAfter }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetTime / 1000)),
          },
        });
      }

      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > maxPayloadSize) {
        await auditLogger.logSecurityEvent("oversized_payload", {
          severity: "high",
          eventData: {
            contentLength: parseInt(contentLength, 10),
            maxAllowed: maxPayloadSize,
          },
          errorMessage: `Payload size ${contentLength} exceeds maximum ${maxPayloadSize}`,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        });
        return new Response(JSON.stringify({ error: "Payload too large" }), {
          status: 413,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await request
        .clone()
        .json()
        .catch(() => ({}) as Record<string, unknown>);

      if (typeof (body as Record<string, unknown>).message === "string") {
        const rawMessage = (body as Record<string, unknown>).message as string;
        const sanitizedMessage = sanitizeInput(rawMessage, 10000);

        if (enablePromptInjectionCheck) {
          const injectionResult = detectPromptInjection(sanitizedMessage);
          if (injectionResult.detected) {
            await auditLogger.logPromptInjection(rawMessage, injectionResult.patterns, {
              requestId,
            });
            return new Response(
              JSON.stringify({
                error: "Invalid input detected",
                message: "Your message contains patterns that are not allowed",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        (body as Record<string, unknown>).message = sanitizedMessage;
      }

      try {
        validateAndSanitize(ChatMessageSchema, body);
      } catch (error) {
        if (isValidationError(error)) {
          // Visible in the dev terminal: error.message carries field-level
          // Zod details only ("sessionId: Invalid uuid"), never user content.
          console.warn(`[Webi] chat validation failed: ${error.message} (request ${requestId})`);
          await auditLogger.logValidationFailure("body", body, error.message, {
            ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
          });
          return new Response(
            JSON.stringify({ error: "Invalid request", details: error.message }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        throw error;
      }

      const response = await next({
        context: {
          user,
          request,
          requestId,
          rateLimitRemaining: rateLimitResult.remaining,
          rateLimitReset: rateLimitResult.resetTime,
          sanitizedBody: body,
          startTime,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10000) {
        await auditLogger.logSecurityEvent("suspicious_activity", {
          severity: "medium",
          eventData: { duration, path: new URL(request.url).pathname },
          errorMessage: `Slow request: ${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      console.error("[SecurityMiddleware] Unexpected error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createAuthenticatedMiddleware() {
  return createMiddleware({ type: "request" }).server(async ({ request, next }) => {
    const user = await getSessionUser(request);
    if (!user) {
      await auditLogger.logAuthFailure("unknown", "No valid session", {
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return next({ context: { user } });
  });
}

export function createAdminMiddleware() {
  return createMiddleware({ type: "request" }).server(async ({ request, next }) => {
    const user = await getSessionUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const admin = await getSupabaseAdmin()
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!admin.data || (admin.data as { role: string }).role !== "admin") {
      await auditLogger.logSecurityEvent("permission_denied", {
        severity: "high",
        userId: user.id,
        eventData: { reason: "Admin access required" },
        errorMessage: "Admin access required",
      });
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return next({ context: { user, isAdmin: true } });
  });
}
