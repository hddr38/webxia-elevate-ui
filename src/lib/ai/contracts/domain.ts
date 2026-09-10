export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface BaseMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UserMessage extends BaseMessage {
  role: "user";
}

export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  toolCalls?: ToolCall[];
}

export interface SystemMessage extends BaseMessage {
  role: "system";
}

export interface ToolMessage extends BaseMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
}

export type Message = UserMessage | AssistantMessage | SystemMessage | ToolMessage;

export type ConversationStatus = "active" | "archived" | "closed";

export interface Conversation {
  id: string;
  sessionId: string;
  userId?: string;
  status: ConversationStatus;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  userAgent?: string;
  referrer?: string;
  pagePath?: string;
  locale?: string;
  leadId?: string;
}

export interface AgentContext {
  conversationId: string;
  sessionId: string;
  userId?: string;
  messages: Message[];
  memory: MemoryContext;
  rag: RAGContext;
  systemPrompt: string;
  availableTools: ToolDefinition[];
  locale: string;
  requestId: string;
}

export interface MemoryContext {
  conversation: ConversationSummary[];
  session: SessionInfo;
  user?: UserProfile;
  project?: ProjectInfo;
  summaries: ConversationSummary[];
  history: ConversationHistory[];
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  generatedAt: number;
}

export interface SessionInfo {
  sessionId: string;
  startedAt: number;
  lastActivity: number;
  pageViews: number;
  messagesCount: number;
  locale: string;
  currentPage?: string;
}

export interface UserProfile {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  preferences: UserPreferences;
  firstContact: number;
  lastContact: number;
}

export interface UserPreferences {
  locale: string;
  theme: "light" | "dark";
  communicationChannel: "web" | "mobile" | "whatsapp" | "telegram" | "email";
}

export interface ProjectInfo {
  projectId?: string;
  name?: string;
  type?: string;
  status: "discovery" | "proposal" | "active" | "completed" | "cancelled";
  budget?: "<5k" | "5k-15k" | "15k-50k" | "50k+";
  timeline?: "urgent" | "1month" | "3months" | "6months" | "exploring";
}

export interface ConversationHistory {
  conversationId: string;
  summary: string;
  date: number;
  outcome?: string;
}

export interface RAGContext {
  documents: ScoredDocument[];
  query: string;
  strategy: RetrievalStrategy;
}

export interface ScoredDocument {
  /** Stable unique id of the retrieved unit (the chunk id). */
  id: string;
  title: string;
  content: string;
  source: DocumentSource;
  metadata: DocumentMetadata;
  score: number;
  distance: number;
  /** Chunk identity — always kept separate from the document identity. */
  chunkId: string;
  chunkIndex: number;
  documentId: string;
}

export interface DocumentSource {
  type: "website" | "pdf" | "manual" | "faq" | "blog" | "case_study";
  url?: string;
  path?: string;
  version?: string;
}

export interface DocumentMetadata {
  author?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  locale: string;
  priority: number;
  chunkId?: string;
  // Extra domain fields are preserved through jsonb columns as JSON.
  [key: string]: string | number | boolean | string[] | undefined;
}

export type RetrievalStrategy = "semantic" | "keyword" | "hybrid" | "rerank";

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly models: AIModel[];

  initialize(config: ProviderConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterable<StreamChunk>;
  abort(): void;
  getModel(modelId: string): AIModel | undefined;
  isAvailable(): boolean;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;

  initialize(config: ProviderConfig): Promise<void>;
  embed(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
  isAvailable(): boolean;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  embeddings: boolean;
  vision: boolean;
  /** Reasoning toggle (chat_template_kwargs.enable_thinking) documented for
   * this model by official NVIDIA samples. Absent = never send the flag. */
  thinking?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ProviderCapabilities;
  maxTokens: number;
  costPerToken: CostPerToken;
}

export interface CostPerToken {
  input: number;
  output: number;
}

export interface ProviderRequest {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ProviderResponse {
  id: string;
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  toolCalls?: ToolCall[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason = "stop" | "length" | "tool_calls" | "error" | "abort";

export interface StreamChunk {
  type: "chunk" | "done" | "error" | "tool_calls";
  content?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: FinishReason;
  error?: { code: string; message: string; recoverable: boolean };
  /** Thinking deltas observed on this stream (reasoning models). Informational. */
  reasoningChunks?: number;
  index: number;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  content: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type ToolPermission = "public" | "authenticated" | "admin" | "internal";

export interface Skill<TOptions = Record<string, unknown>, TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly permissions: ToolPermission[];

  toToolDefinition(): ToolDefinition;
  execute(context: SkillContext<TOptions>): Promise<SkillResult<TResult>>;
  validate?(options: unknown): TOptions;
}

export interface SkillContext<TOptions = Record<string, unknown>> {
  conversationId: string;
  sessionId: string;
  options: TOptions;
  memory: MemoryContext;
  knowledge: ScoredDocument[];
  userId?: string;
  locale: string;
  requestId: string;
}

export interface SkillResult<TResult = unknown> {
  data: TResult;
  summary: string;
  citations?: Citation[];
  followUp?: string;
}

export interface Citation {
  source: string;
  excerpt: string;
  relevance: number;
  documentId?: string;
  chunkId?: string;
  /** Denormalized citation identity (derived ONLY from server retrieval). */
  title?: string;
  chunkIndex?: number;
}

export type AgentEventType =
  | "agent.message.received"
  | "agent.context.built"
  | "agent.llm.started"
  | "agent.llm.completed"
  | "agent.tool.started"
  | "agent.tool.completed"
  | "agent.memory.created"
  | "agent.response.completed"
  | "agent.error";

export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  payload: T;
  requestId: string;
  conversationId?: string;
  timestamp: number;
}

export type StreamEventType =
  | "message_start"
  | "text_delta"
  | "tool_start"
  | "tool_result"
  | "citation"
  | "message_complete"
  | "error";

export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  data: T;
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface MessageStartEvent {
  type: "message_start";
  data: { messageId: string };
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface TextDeltaEvent {
  type: "text_delta";
  data: { content: string; index: number };
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface ToolStartEvent {
  type: "tool_start";
  data: { toolCallId: string; toolName: string; arguments: string };
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface ToolResultEvent {
  type: "tool_result";
  data: ToolResult;
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface CitationEvent {
  type: "citation";
  data: Citation;
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export interface MessageCompleteEvent {
  type: "message_complete";
  data: {
    fullContent: string;
    usage: TokenUsage;
    toolCalls?: ToolCall[];
    conversationId: string;
  };
  timestamp: number;
  conversationId: string;
  requestId: string;
  durationMs?: number;
}

export interface StreamErrorEvent {
  type: "error";
  data: { code: string; message: string; recoverable: boolean };
  timestamp: number;
  conversationId: string;
  requestId: string;
}

export type TypedStreamEvent =
  | MessageStartEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | CitationEvent
  | MessageCompleteEvent
  | StreamErrorEvent;

export type AgentErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "INVALID_TOOL_CALL"
  | "TOOL_UNAUTHORIZED"
  | "TOOL_EXECUTION_FAILED"
  | "TOOL_VALIDATION_FAILED"
  | "MAX_STEPS_EXCEEDED"
  | "MAX_TOOL_CALLS_EXCEEDED"
  | "GLOBAL_TIMEOUT"
  | "UNKNOWN_ERROR"
  | "CONTEXT_TOO_LARGE"
  | "TOOL_RESULT_TOO_LARGE"
  | "RAG_UNAVAILABLE"
  | "MEMORY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface AgentError extends Error {
  code: AgentErrorCode;
  recoverable: boolean;
  provider?: string;
  toolName?: string;
  requestId?: string;
  conversationId?: string;
  details?: Record<string, unknown>;
}

export function createAgentError(
  code: AgentErrorCode,
  message: string,
  options: {
    recoverable?: boolean;
    provider?: string;
    toolName?: string;
    requestId?: string;
    conversationId?: string;
    details?: Record<string, unknown>;
  } = {},
): AgentError {
  const error = new Error(message) as AgentError;
  error.code = code;
  error.recoverable = options.recoverable ?? false;
  error.provider = options.provider;
  error.toolName = options.toolName;
  error.requestId = options.requestId;
  error.conversationId = options.conversationId;
  error.details = options.details;
  return error;
}

export interface AgentLimits {
  maxAgentSteps: number;
  maxToolCalls: number;
  globalTimeoutMs: number;
  maxContextTokens: number;
  maxToolResultTokens: number;
}

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxAgentSteps: 10,
  maxToolCalls: 5,
  globalTimeoutMs: 120_000,
  maxContextTokens: 128_000,
  maxToolResultTokens: 8_000,
};
