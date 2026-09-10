import type { ToolDefinition, ToolCall, ToolResult, ToolPermission } from "../contracts";

export type { ToolDefinition, ToolCall, ToolResult, ToolPermission };

export interface SkillContext {
  conversationId: string;
  sessionId: string;
  userId?: string;
  locale: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

export interface SkillInput {
  [key: string]: unknown;
}

export interface SkillOutput {
  [key: string]: unknown;
}

export interface SkillMetadata {
  category?: string;
  tags?: string[];
  version?: string;
  author?: string;
  description?: string;
  examples?: SkillExample[];
}

export interface SkillExample {
  input: SkillInput;
  output: SkillOutput;
  description: string;
}

export interface Skill<
  TOptions extends SkillInput = SkillInput,
  TResult extends SkillOutput = SkillOutput,
> {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  readonly permissions: ToolPermission[];
  readonly metadata?: SkillMetadata;

  toToolDefinition(): ToolDefinition;
  execute(context: SkillContext, options: TOptions): Promise<SkillResult<TResult>>;
  validate(input: unknown): TOptions;
}

export interface SkillResult<T extends SkillOutput = SkillOutput> {
  success: boolean;
  data?: T;
  error?: SkillError;
  citations?: SkillCitation[];
  followUp?: string;
}

export interface SkillError {
  code: SkillErrorCode;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export type SkillErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "EXECUTION_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface SkillCitation {
  source: string;
  excerpt: string;
  relevance: number;
  documentId?: string;
  chunkId?: string;
}

export interface SkillRegistry {
  register(skill: Skill): void;
  unregister(name: string): void;
  get(name: string): Skill | undefined;
  getAll(): Skill[];
  has(name: string): boolean;
  getToolDefinitions(): ToolDefinition[];
}

export interface SkillExecutorOptions {
  context: SkillContext;
  skillName: string;
  arguments: Record<string, unknown>;
  requestId: string;
}

export interface SkillExecutionResult {
  result: ToolResult;
  skillResult: SkillResult;
}
