import {
  Skill,
  SkillContext,
  SkillResult,
  SkillError,
  SkillErrorCode,
  SkillExecutionResult,
  ToolCall,
  ToolResult,
  ToolPermission,
} from "./types";
import { skillRegistry } from "./registry";
import { SkillValidator, SkillValidationError } from "./validator";
import { eventBus } from "../events";
import type { WebiEventMap, WebiEventType } from "../events";
import { auditLogger } from "../security/audit-log";

export class SkillExecutor {
  async execute(
    skillName: string,
    context: SkillContext,
    rawArguments: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const requestId = context.requestId;
    const startTime = Date.now();

    await this.emitEvent("agent.tool.started", requestId, {
      toolName: skillName,
    });

    let skillResult: SkillResult;
    let toolResult: ToolResult;

    try {
      const skill = skillRegistry.get(skillName);
      if (!skill) {
        throw new SkillExecutionError(
          `Skill "${skillName}" not found`,
          this.createError("NOT_FOUND", `Skill "${skillName}" not found`, false),
        );
      }

      const validatedArgs = SkillValidator.validate(skill, rawArguments);

      this.checkPermissions(skill, context);

      const result = await skill.execute(context, validatedArgs);

      skillResult = result;

      if (result.success) {
        toolResult = this.createToolResult(skillName, requestId, result);
        await this.emitEvent("agent.tool.completed", requestId, {
          toolName: skillName,
          success: true,
          durationMs: Date.now() - startTime,
        });
      } else {
        toolResult = this.createToolError(skillName, requestId, result.error!);
        await this.emitEvent("agent.tool.completed", requestId, {
          toolName: skillName,
          success: false,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof SkillValidationError) {
        skillResult = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
            details: error.details,
          },
        };
        toolResult = this.createToolError(skillName, requestId, skillResult.error!);
      } else if (error instanceof SkillExecutionError) {
        skillResult = {
          success: false,
          error: error.errorInfo,
        };
        toolResult = this.createToolError(skillName, requestId, error.errorInfo);
      } else {
        const errorInfo = this.createError(
          "INTERNAL_ERROR",
          error instanceof Error ? error.message : "Unknown execution error",
          true,
        );
        skillResult = { success: false, error: errorInfo };
        toolResult = this.createToolError(skillName, requestId, errorInfo);
      }

      await this.emitEvent("agent.tool.completed", requestId, {
        toolName: skillName,
        success: false,
        durationMs,
      });
    }

    return { result: toolResult, skillResult };
  }

  private checkPermissions(skill: Skill, context: SkillContext): void {
    // Read auth context from metadata (set by orchestrator)
    const meta = (context.metadata ?? {}) as Record<string, unknown>;
    const isAuthenticated = meta.isAuthenticated === true;
    const isAdmin = meta.isAdmin === true;

    if (skill.permissions.includes("internal")) {
      auditLogger.logSecurityEvent("unauthorized_tool_access", {
        severity: "high",
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
        eventData: { skill: skill.name, reason: "Tool is internal-only and not exposed" },
        errorMessage: "Tool is internal-only",
      });
      throw new SkillExecutionError("Tool is internal-only", {
        code: "UNAUTHORIZED",
        message: "Tool is internal-only",
        recoverable: false,
      });
    }

    if (skill.permissions.includes("admin") && !isAdmin) {
      auditLogger.logSecurityEvent("unauthorized_tool_access", {
        severity: "high",
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
        eventData: { skill: skill.name, reason: "Tool requires admin permission" },
        errorMessage: "Tool requires admin permission",
      });
      throw new SkillExecutionError("Tool requires admin permission", {
        code: "UNAUTHORIZED",
        message: "Tool requires admin permission",
        recoverable: false,
      });
    }

    if (skill.permissions.includes("authenticated") && !isAuthenticated) {
      auditLogger.logSecurityEvent("unauthorized_tool_access", {
        severity: "high",
        userId: context.userId ?? "anonymous",
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        requestId: context.requestId,
        eventData: { skill: skill.name, reason: "Tool requires authentication" },
        errorMessage: "Tool requires authentication",
      });
      throw new SkillExecutionError("Tool requires authentication", {
        code: "UNAUTHORIZED",
        message: "Tool requires authentication",
        recoverable: false,
      });
    }

    if (skill.permissions.includes("public")) {
      return;
    }

    throw new SkillExecutionError(`Skill "${skill.name}" has no valid permission`, {
      code: "UNAUTHORIZED",
      message: `Skill "${skill.name}" has no valid permission`,
      recoverable: false,
    });
  }

  private createToolResult(
    skillName: string,
    requestId: string,
    skillResult: SkillResult,
  ): ToolResult {
    return {
      toolCallId: `call-${requestId}`,
      toolName: skillName,
      content: JSON.stringify(skillResult.data ?? {}),
      success: true,
      metadata: {
        citations: skillResult.citations,
        followUp: skillResult.followUp,
      },
    };
  }

  private createToolError(skillName: string, requestId: string, error: SkillError): ToolResult {
    return {
      toolCallId: `call-${requestId}`,
      toolName: skillName,
      content: JSON.stringify({ error: error.message }),
      success: false,
      error: error.message,
      metadata: {
        errorCode: error.code,
        recoverable: error.recoverable,
        details: error.details,
      },
    };
  }

  private createError(
    code: SkillErrorCode,
    message: string,
    recoverable: boolean,
    details?: Record<string, unknown>,
  ): SkillError {
    return {
      code,
      message,
      recoverable,
      details,
    };
  }

  private async emitEvent<K extends WebiEventType>(
    type: K,
    requestId: string,
    payload: WebiEventMap[K],
  ): Promise<void> {
    // eventBus.emit is synchronous and non-throwing by contract; the await
    // keeps call sites uniform without changing execution semantics.
    eventBus.emit(type, requestId, payload);
  }
}

export class SkillExecutionError extends Error {
  public readonly errorInfo: SkillError;

  constructor(message: string, errorInfo: SkillError) {
    super(message);
    this.name = "SkillExecutionError";
    this.errorInfo = errorInfo;
  }
}

export const skillExecutor = new SkillExecutor();
