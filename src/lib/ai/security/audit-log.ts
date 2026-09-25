import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEventType =
  | "auth_failure"
  | "rate_limit_exceeded"
  | "unauthorized_tool_access"
  | "prompt_injection_detected"
  | "validation_failure"
  | "provider_error"
  | "tool_execution_failure"
  | "memory_access_violation"
  | "rag_access_violation"
  | "permission_denied"
  | "oversized_payload"
  | "context_too_large"
  | "max_steps_exceeded"
  | "suspicious_activity";

export type AuditSeverity = "low" | "medium" | "high" | "critical";

export interface AuditLogEntry {
  event_type: AuditEventType;
  severity: AuditSeverity;
  user_id?: string;
  session_id?: string;
  conversation_id?: string;
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
  event_data?: Record<string, unknown>;
  error_message?: string;
  created_at?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly bufferSize = 50;
  private readonly flushIntervalMs = 5000;

  private constructor() {
    this.startFlushTimer();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushIntervalMs);
  }

  log(entry: AuditLogEntry): void {
    this.buffer.push({
      ...entry,
      created_at: new Date().toISOString(),
    });

    if (this.buffer.length >= this.bufferSize) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);

    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("ai_audit_log").insert(
        entries.map((e) => ({
          event_type: e.event_type,
          severity: e.severity,
          user_id: e.user_id ?? null,
          session_id: e.session_id ?? null,
          conversation_id: e.conversation_id ?? null,
          request_id: e.request_id ?? null,
          ip_address: e.ip_address ?? null,
          user_agent: e.user_agent ?? null,
          // DB column is jsonb: free-form audit payload serialized as JSON.
          event_data: (e.event_data ?? {}) as Json,
          error_message: e.error_message ?? null,
        })),
      );

      if (error) {
        console.error("[AuditLogger] Failed to flush audit logs:", error);
        this.buffer.unshift(...entries);
      }
    } catch (error) {
      console.error("[AuditLogger] Unexpected error flushing audit logs:", error);
      this.buffer.unshift(...entries);
    }
  }

  async logSecurityEvent(
    eventType: AuditEventType,
    options: {
      severity?: AuditSeverity;
      userId?: string;
      sessionId?: string;
      conversationId?: string;
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
      eventData?: Record<string, unknown>;
      errorMessage?: string;
    } = {},
  ): Promise<void> {
    this.log({
      event_type: eventType,
      severity: options.severity ?? "medium",
      user_id: options.userId,
      session_id: options.sessionId,
      conversation_id: options.conversationId,
      request_id: options.requestId,
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
      event_data: options.eventData,
      error_message: options.errorMessage,
    });
  }

  async logAuthFailure(
    identifier: string,
    reason: string,
    options: { ipAddress?: string; userAgent?: string; requestId?: string } = {},
  ): Promise<void> {
    await this.logSecurityEvent("auth_failure", {
      severity: "high",
      eventData: { identifier, reason },
      errorMessage: reason,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      requestId: options.requestId,
    });
  }

  async logRateLimitExceeded(
    identifier: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
      limit?: number;
      windowMs?: number;
    } = {},
  ): Promise<void> {
    await this.logSecurityEvent("rate_limit_exceeded", {
      severity: "medium",
      eventData: { identifier, limit: options.limit, windowMs: options.windowMs },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      requestId: options.requestId,
    });
  }

  async logUnauthorizedToolAccess(
    toolName: string,
    userId: string,
    reason: string,
    options: {
      sessionId?: string;
      conversationId?: string;
      requestId?: string;
      ipAddress?: string;
    } = {},
  ): Promise<void> {
    await this.logSecurityEvent("unauthorized_tool_access", {
      severity: "high",
      userId,
      eventData: { toolName, reason },
      errorMessage: reason,
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });
  }

  async logPromptInjection(
    input: string,
    detectedPatterns: string[],
    options: {
      sessionId?: string;
      conversationId?: string;
      requestId?: string;
      ipAddress?: string;
      userId?: string;
    } = {},
  ): Promise<void> {
    await this.logSecurityEvent("prompt_injection_detected", {
      severity: "high",
      userId: options.userId,
      eventData: { input: input.slice(0, 500), patterns: detectedPatterns },
      errorMessage: "Prompt injection attempt detected",
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });
  }

  async logValidationFailure(
    field: string,
    value: unknown,
    reason: string,
    options: { requestId?: string; ipAddress?: string } = {},
  ): Promise<void> {
    await this.logSecurityEvent("validation_failure", {
      severity: "medium",
      eventData: { field, value: String(value).slice(0, 200), reason },
      errorMessage: reason,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });
  }

  async logToolExecutionFailure(
    toolName: string,
    error: string,
    options: {
      userId?: string;
      sessionId?: string;
      conversationId?: string;
      requestId?: string;
    } = {},
  ): Promise<void> {
    await this.logSecurityEvent("tool_execution_failure", {
      severity: "medium",
      userId: options.userId,
      eventData: { toolName, error: error.slice(0, 500) },
      errorMessage: error,
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId,
    });
  }

  async logMemoryAccessViolation(
    userId: string,
    targetSessionId: string,
    options: { sessionId?: string; conversationId?: string; requestId?: string } = {},
  ): Promise<void> {
    await this.logSecurityEvent("memory_access_violation", {
      severity: "high",
      userId,
      eventData: { targetSessionId },
      errorMessage: "Attempted to access memory from another session",
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId,
    });
  }

  async logRagAccessViolation(
    userId: string,
    reason: string,
    options: { sessionId?: string; conversationId?: string; requestId?: string } = {},
  ): Promise<void> {
    await this.logSecurityEvent("rag_access_violation", {
      severity: "high",
      userId,
      eventData: { reason },
      errorMessage: reason,
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      requestId: options.requestId,
    });
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush().catch(console.error);
  }
}

export const auditLogger = AuditLogger.getInstance();
