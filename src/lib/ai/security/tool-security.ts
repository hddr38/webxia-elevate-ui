import {
  Skill,
  SkillContext,
  SkillResult,
  SkillInput,
  SkillOutput,
  ToolPermission,
} from "../skills/types";
import { auditLogger } from "./audit-log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface ToolSecurityConfig {
  requireAuth: boolean;
  requiredPermissions: ToolPermission[];
  allowedRoles: string[];
}

const DEFAULT_TOOL_CONFIG: ToolSecurityConfig = {
  requireAuth: false,
  requiredPermissions: ["public"],
  allowedRoles: ["user", "admin"],
};

export function createSecureToolExecutor<TInput extends SkillInput, TOutput extends SkillOutput>(
  skill: Skill<TInput, TOutput>,
  config: Partial<ToolSecurityConfig> = {},
) {
  const finalConfig = { ...DEFAULT_TOOL_CONFIG, ...config };

  return async (context: SkillContext, input: TInput): Promise<SkillResult<TOutput>> => {
    const startTime = Date.now();

    if (finalConfig.requireAuth && !context.userId) {
      await auditLogger.logSecurityEvent("unauthorized_tool_access", {
        severity: "high",
        userId: context.userId,
        eventData: { skill: skill.name, reason: "Authentication required" },
        errorMessage: "Authentication required",
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
      });

      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required to use this tool",
          recoverable: false,
        },
      };
    }

    const meta = (context.metadata ?? {}) as Record<string, unknown>;
    const isAdminContext = meta.isAdmin === true || meta.role === "admin";

    if (skill.permissions.includes("internal")) {
      await auditLogger.logUnauthorizedToolAccess(
        skill.name,
        context.userId ?? "anonymous",
        "Tool is internal-only and not exposed",
        {
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        },
      );
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Tool is internal-only",
          recoverable: false,
        },
      };
    }

    if (skill.permissions.includes("admin") && !isAdminContext) {
      await auditLogger.logUnauthorizedToolAccess(
        skill.name,
        context.userId ?? "anonymous",
        "Tool requires admin permission",
        {
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        },
      );
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Tool requires admin permission",
          recoverable: false,
        },
      };
    }

    if (skill.permissions.includes("authenticated") && !context.userId) {
      await auditLogger.logUnauthorizedToolAccess(
        skill.name,
        "anonymous",
        "Tool requires authentication",
        {
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        },
      );
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Tool requires authentication",
          recoverable: false,
        },
      };
    }

    const hasPermission = finalConfig.requiredPermissions.some((perm) =>
      skill.permissions.includes(perm),
    );

    if (!hasPermission) {
      await auditLogger.logUnauthorizedToolAccess(
        skill.name,
        context.userId ?? "anonymous",
        `Tool requires one of: ${finalConfig.requiredPermissions.join(", ")}`,
        {
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        },
      );

      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: `Tool requires permissions: ${finalConfig.requiredPermissions.join(", ")}`,
          recoverable: false,
        },
      };
    }

    try {
      const result = await skill.execute(context, input);

      if (!result.success && result.error) {
        await auditLogger.logToolExecutionFailure(skill.name, result.error.message, {
          userId: context.userId,
          sessionId: context.sessionId,
          conversationId: context.conversationId,
          requestId: context.requestId,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await auditLogger.logToolExecutionFailure(skill.name, errorMessage, {
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
      });

      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: errorMessage,
          recoverable: true,
        },
      };
    }
  };
}

export interface DataAccessContext {
  userId: string;
  sessionId: string;
  conversationId?: string;
  requestId?: string;
}

export async function assertMemoryAccess(
  context: DataAccessContext,
  targetSessionId: string,
): Promise<void> {
  if (context.sessionId !== targetSessionId) {
    await auditLogger.logMemoryAccessViolation(context.userId, targetSessionId, {
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      requestId: context.requestId,
    });

    throw new Error("Memory access denied: session mismatch");
  }
}

export interface RagAdminContext {
  /** Authenticated Supabase user id (admin_users.user_id). Absent = anonymous. */
  userId?: string;
  sessionId: string;
  conversationId?: string;
  requestId?: string;
}

/**
 * Admin-only guard for knowledge WRITES (ingestion / update / delete /
 * reindex). Authority follows the project convention: the `admin_users`
 * table (role === "admin"), same as getSessionUser() — never
 * user_metadata.role.
 *
 * MUST NEVER be placed on the anonymous per-turn retrieval path: anonymous
 * chat users carry no userId, so this guard would reject 100% of retrieval
 * traffic. Retrieval stays server-side (service-role) + bounded
 * (topK/threshold) with a middleware-validated sessionId that is never
 * treated as an identity.
 */
export async function assertRagAccess(context: RagAdminContext): Promise<void> {
  if (!context.userId) {
    await auditLogger.logRagAccessViolation("anonymous", "Authentication required for write", {
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      requestId: context.requestId,
    });
    throw new Error("RAG write denied: authentication required");
  }

  const admin = getSupabaseAdmin();
  const { data: adminUser, error } = await admin
    .from("admin_users")
    .select("id, role")
    .eq("user_id", context.userId)
    .single();

  if (error || !adminUser || adminUser.role !== "admin") {
    await auditLogger.logRagAccessViolation(context.userId, "Admin permission required", {
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      requestId: context.requestId,
    });
    throw new Error("RAG write denied: admin permission required");
  }
}

export function sanitizeToolOutput(output: unknown, maxSize: number = 50000): string {
  const str = typeof output === "string" ? output : JSON.stringify(output);
  if (str.length > maxSize) {
    return str.slice(0, maxSize) + "\n[TRUNCATED]";
  }
  return str;
}

export function validateToolInputSize(input: unknown, maxSize: number = 10000): void {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  if (str.length > maxSize) {
    throw new Error(`Tool input exceeds maximum size of ${maxSize} characters`);
  }
}
