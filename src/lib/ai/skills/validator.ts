import { z, ZodSchema, ZodError } from "zod";
import { Skill, SkillInput, SkillError, SkillErrorCode } from "./types";

export class SkillValidator {
  static validate<T extends SkillInput>(skill: Skill, input: unknown): T {
    try {
      return skill.validate(input) as T;
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw this.createError("VALIDATION_ERROR", `Invalid arguments: ${messages}`, false, {
          zodErrors: error.errors,
        });
      }
      if (error instanceof SkillValidationError) {
        throw error;
      }
      throw this.createError(
        "VALIDATION_ERROR",
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        false,
      );
    }
  }

  static createZodValidator<T extends SkillInput>(schema: ZodSchema<T>) {
    return (input: unknown): T => {
      const result = schema.safeParse(input);
      if (!result.success) {
        const messages = result.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        throw new SkillValidationError(messages, result.error.errors);
      }
      return result.data;
    };
  }

  private static createError(
    code: SkillErrorCode,
    message: string,
    recoverable: boolean,
    details?: Record<string, unknown>,
  ): SkillValidationError {
    return new SkillValidationError(message, undefined, {
      code,
      recoverable,
      details,
    });
  }
}

export class SkillValidationError extends Error {
  public readonly code: SkillErrorCode;
  public readonly recoverable: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly zodErrors?: ZodError["errors"];

  constructor(
    message: string,
    zodErrors?: ZodError["errors"],
    errorInfo?: { code: SkillErrorCode; recoverable: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "SkillValidationError";
    this.code = errorInfo?.code ?? "VALIDATION_ERROR";
    this.recoverable = errorInfo?.recoverable ?? false;
    this.details = errorInfo?.details;
    this.zodErrors = zodErrors;
  }
}

export function createSkillSchema<T extends SkillInput>(schema: ZodSchema<T>) {
  return SkillValidator.createZodValidator(schema);
}
