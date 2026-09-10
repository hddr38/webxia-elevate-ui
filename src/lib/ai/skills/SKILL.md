# Skill Template

This document describes the structure and conventions for creating new skills in the Webi agent system.

## Overview

A **Skill** is a server-side capability that the LLM can invoke via structured tool calling. Each skill:

- Has a unique name and description
- Defines a JSON schema for its input parameters
- Implements validation, execution, and error handling
- Declares required permissions (public, authenticated, admin, internal)
- Returns structured results with optional citations

> **Important**: This `SKILL.md` is documentation only. The runtime uses TypeScript definitions in `src/lib/ai/skills/`.

---

## Skill Structure

### 1. Type Definitions

```typescript
// src/lib/ai/skills/types.ts

interface Skill<TOptions extends SkillInput, TResult extends SkillOutput> {
  readonly name: string; // Unique identifier (snake_case)
  readonly description: string; // LLM-facing description
  readonly schema: JSONSchema; // Input parameter schema
  readonly permissions: ToolPermission[]; // Required permissions
  readonly metadata?: SkillMetadata; // Optional documentation

  toToolDefinition(): ToolDefinition; // Converts to LLM tool format
  execute(context: SkillContext, options: TOptions): Promise<SkillResult<TResult>>;
  validate(input: unknown): TOptions; // Zod-based validation
}
```

### 2. Permissions

```typescript
type ToolPermission = "public" | "authenticated" | "admin" | "internal";
```

| Permission      | Description                                 |
| --------------- | ------------------------------------------- |
| `public`        | Available to all users (anonymous visitors) |
| `authenticated` | Requires valid user session                 |
| `admin`         | Requires admin role                         |
| `internal`      | Internal use only, not exposed to LLM       |

### 3. Context

```typescript
interface SkillContext {
  conversationId: string;
  sessionId: string;
  userId?: string;
  locale: string;
  requestId: string; // Correlation ID for tracing
  metadata?: Record<string, unknown>;
}
```

---

## Creating a New Skill

### Step 1: Create the Skill File

```typescript
// src/lib/ai/skills/my-skill.ts
import { z } from "zod";
import { Skill, SkillContext, SkillResult, ToolDefinition, ToolPermission } from "./types";

export interface MySkillInput {
  param1: string;
  param2?: number;
}

export interface MySkillOutput {
  result: string;
}

export class MySkill implements Skill<MySkillInput, MySkillOutput> {
  readonly name = "my_skill";
  readonly description = "Brief description for the LLM";
  readonly permissions: ToolPermission[] = ["public"];

  readonly schema = {
    type: "object",
    properties: {
      param1: { type: "string", description: "Required parameter" },
      param2: { type: "number", description: "Optional parameter", default: 10 },
    },
    required: ["param1"],
  } as const;

  readonly metadata = {
    category: "utility",
    tags: ["example"],
    version: "1.0.0",
  };

  toToolDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.schema,
      },
    };
  }

  validate(input: unknown): MySkillInput {
    const schema = z.object({
      param1: z.string().min(1),
      param2: z.number().optional().default(10),
    });
    return schema.parse(input);
  }

  async execute(context: SkillContext, options: MySkillInput): Promise<SkillResult<MySkillOutput>> {
    try {
      // Implementation here
      const result = await doSomething(options.param1, options.param2);

      return {
        success: true,
        data: { result },
        followUp: "Optional follow-up message for the LLM",
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Failed",
          recoverable: true,
        },
      };
    }
  }
}

export function createMySkill(deps: Dependencies): MySkill {
  return new MySkill();
}
```

### Step 2: Register the Skill

```typescript
// In your agent initialization (e.g., server function or agent setup)
import { skillRegistry } from "@/lib/ai/skills";
import { createMySkill } from "@/lib/ai/skills/my-skill";

const mySkill = createMySkill(dependencies);
skillRegistry.register(mySkill);
```

### Step 3: Use in Agent

The skill is now available to the LLM via the tool definitions returned by `skillRegistry.getToolDefinitions()`.

---

## Skill Conventions

### Naming

- **Name**: `snake_case` (e.g., `search_knowledge`, `send_email`)
- **File**: `kebab-case.ts` (e.g., `search-knowledge.ts`)
- **Class**: `PascalCase` + `Skill` (e.g., `SearchKnowledgeSkill`)

### Schema

- Use JSON Schema format (compatible with OpenAI tool calling)
- Include `description` for every property
- Mark required fields in `required` array
- Provide sensible `default` values where appropriate

### Validation

- Use Zod for input validation
- Return typed input from `validate()`
- Throw `SkillValidationError` on failure (handled by executor)

### Execution

- Return `SkillResult` with `success`, `data`, `error`, `citations`, `followUp`
- Never throw raw errors — return error results
- Include `citations` when using RAG or external sources
- Use `followUp` to guide the LLM's next action

### Error Handling

```typescript
return {
  success: false,
  error: {
    code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" |
          "EXECUTION_FAILED" | "RATE_LIMITED" | "PROVIDER_ERROR" |
          "INTERNAL_ERROR",
    message: "Human-readable error message",
    recoverable: boolean,  // Can the LLM retry?
    details?: Record<string, unknown>,
  },
};
```

### Permissions

- Default to `"public"` for visitor-facing skills
- Use `"authenticated"` for user-specific operations
- Use `"admin"` for administrative actions
- Use `"internal"` for skills not exposed to LLM

---

## Existing Skills

| Skill              | Permissions | Description                                     |
| ------------------ | ----------- | ----------------------------------------------- |
| `search_knowledge` | `public`    | Semantic search over knowledge base using RAG   |
| `summarize`        | `public`    | LLM-based text summarization with style options |

---

## Testing Skills

```typescript
// Unit test example
import { MySkill } from "@/lib/ai/skills/my-skill";
import { createMockSkillContext } from "@/lib/ai/__tests__/test-utils";

describe("MySkill", () => {
  let skill: MySkill;

  beforeEach(() => {
    skill = createMySkill(mockDependencies);
  });

  it("validates required parameters", () => {
    expect(() => skill.validate({})).toThrow();
    expect(() => skill.validate({ param1: "test" })).not.toThrow();
  });

  it("executes successfully", async () => {
    const context = createMockSkillContext();
    const result = await skill.execute(context, { param1: "test" });

    expect(result.success).toBe(true);
    expect(result.data?.result).toBeDefined();
  });

  it("handles execution errors", async () => {
    // Test error handling
  });
});
```

---

## Skill Development Checklist

- [ ] Unique `name` (snake_case)
- [ ] Clear `description` for LLM
- [ ] JSON Schema with descriptions
- [ ] Zod validation in `validate()`
- [ ] Proper `permissions` array
- [ ] `metadata` with category/tags/version
- [ ] Error handling returns `SkillResult` (no throws)
- [ ] Citations included when using external sources
- [ ] `followUp` message for LLM guidance
- [ ] Unit tests for validation, success, and error cases
- [ ] Registered in skill registry during initialization
- [ ] Documented in this file if adding new patterns

---

## Integration Points

- **Executor**: `src/lib/ai/skills/executor.ts` — handles validation, auth, execution pipeline
- **Registry**: `src/lib/ai/skills/registry.ts` — skill registration and tool definition generation
- **Validator**: `src/lib/ai/skills/validator.ts` — Zod-based validation utilities
- **Event Bus**: Emits `agent.tool.started` / `agent.tool.completed` events
- **Agent Loop**: Receives tool definitions via `getAllToolDefinitions()`
