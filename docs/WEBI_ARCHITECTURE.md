# WEBI Architecture — Technical Specification

> **Version**: 1.0.0  
> **Date**: 2026-09-09  
> **Status**: Prompt 9 — E2E Tests, Observability, Deployment, Final Audit Complete ✅  
> **Reference**: `docs/SPRINT_0_ARCHITECTURE.md` (design), `AGENTS.md` (conventions), `src/lib/ai/contracts/domain.ts` (contracts)

---

## 1. Architecture Overview

### 1.1 Stack Summary

| Layer           | Technology                       | Version      |
| --------------- | -------------------------------- | ------------ |
| Frontend        | React                            | 19.2         |
| Full-Stack      | TanStack Start                   | 1.167        |
| Router          | TanStack Router                  | 1.168        |
| Server          | Nitro                            | 3.0          |
| Build           | Vite                             | 8            |
| Language        | TypeScript                       | 5.8 (strict) |
| Styling         | Tailwind CSS                     | 4.2          |
| UI Components   | shadcn/ui + Radix UI             | Latest       |
| Animation       | Framer Motion                    | 12.40        |
| Icons           | Lucide React                     | 0.575        |
| Data Fetching   | TanStack Query                   | 5.83         |
| Database        | Supabase (PostgreSQL + pgvector) | 2.111        |
| Auth            | Supabase Auth + @supabase/ssr    | 0.12         |
| Validation      | Zod                              | 3.24         |
| Forms           | React Hook Form                  | 7.71         |
| Package Manager | npm                              | 10+          |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ React 19 + TanStack Router                                │  │
│  │  ├── ChatWidget (Webi UI)                                 │  │
│  │  ├── Site Pages (public + admin)                          │  │
│  │  ├── Zustand Stores (UI state)                            │  │
│  │  └── TanStack Query (server state cache)                  │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │ Server Functions (RPC)               │
│                            ▼                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVER (Nitro)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TanStack Start Server Functions                           │  │
│  │  ├── Auth / Rate Limiting / Validation                    │  │
│  │  ├── Agent Orchestrator                                   │  │
│  │  │   ├── LLM Provider Registry (NVIDIA NIM)              │  │
│  │  │   ├── Skill Engine                                     │  │
│  │  │   ├── Memory Manager (ai_memory table)                │  │
│  │  │   └── RAG Engine (future)                             │  │
│  │  └── Event Bus (server-side emission)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│              ┌─────────────┼─────────────┐                       │
│              ▼             ▼             ▼                       │
│        ┌─────────┐  ┌───────────┐ ┌──────────┐                  │
│        │Supabase │  │  NVIDIA   │ │  Vector  │                  │
│        │  (DB)   │  │   NIM     │ │  Store   │                  │
│        └─────────┘  └───────────┘ └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Client / Server Boundary

### 2.1 Execution Domains

| Domain        | Execution                | Responsibilities                                 | Access                                               |
| ------------- | ------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| **Server** 🔒 | Server Functions / Nitro | Providers, RAG, DB, Skills, Prompts, Secrets     | `getSupabaseAdmin()`, env secrets, file system       |
| **Client** 🌍 | Browser                  | UI, Zustand, Hooks, Streaming display, Analytics | `import.meta.env.VITE_*`, browser APIs               |
| **Shared** 🔄 | Both                     | Types, Zod schemas, Pure utilities, Constants    | `src/lib/ai/contracts`, `src/lib/utils`, `src/types` |

### 2.2 Transport Layer

**TanStack Start Server Functions** are the ONLY mechanism for client→server communication.

```typescript
// Server Function pattern (ALWAYS use this)
export const myFunction = createServerFn({ method: "POST" })
  .validator((data: InputSchema) => data) // Zod validation
  .handler(async ({ data, context }) => {
    // context.request for auth/cookies
    // getSupabaseAdmin() for admin DB access
    // Throw Response for HTTP errors
  });
```

**Forbidden patterns**:

- ❌ Direct `fetch` to Supabase from client
- ❌ Next.js API routes (`app/api/route.ts`)
- ❌ Vercel-specific serverless functions
- ❌ Importing server-only modules in client components

---

## 3. Data Boundaries (Five Distinct Stores)

### 3.1 Boundary Definitions

| #   | Boundary                 | Storage                                   | Lifetime                      | Access Pattern              |
| --- | ------------------------ | ----------------------------------------- | ----------------------------- | --------------------------- |
| 1   | **Conversation History** | Server Function context (ephemeral)       | Session                       | In-memory during agent loop |
| 2   | **Agent/User Memory**    | `ai_memory` table (PostgreSQL + pgvector) | Persistent (TTL configurable) | Server Functions + RLS      |
| 3   | **Knowledge Base / RAG** | Future: separate vector table/index       | Persistent                    | RAG Engine (server)         |
| 4   | **Client UI State**      | Zustand stores                            | Session                       | React components            |
| 5   | **Server State**         | TanStack Query cache                      | Configurable TTL              | `useQuery` / `useMutation`  |

### 3.2 Non-Conflation Rules

- ❌ Never use `ai_memory` as conversation history
- ❌ Never use Zustand for server state (conversations, memory entries)
- ❌ Never use TanStack Query for UI state (widget open, draft text)
- ❌ Never embed RAG documents in `ai_memory` — separate table/index
- ✅ Each boundary has its own access layer and lifecycle

---

## 4. TanStack Ecosystem Roles

| Tool                 | Purpose                                     | Scope           |
| -------------------- | ------------------------------------------- | --------------- |
| **TanStack Router**  | File-based routing, type-safe navigation    | Client + SSR    |
| **TanStack Start**   | SSR, Server Functions, streaming            | Server + Client |
| **TanStack Query**   | Server state cache, mutations, invalidation | Client only     |
| **Server Functions** | Typed RPC, auth, validation, execution      | Server only     |

### 4.1 State Separation

```typescript
// ✅ Server State → TanStack Query
const { data: conversations } = useQuery({
  queryKey: ["conversations"],
  queryFn: () => getConversations(),
});

// ✅ Client UI State → Zustand
const useChatStore = create((set) => ({
  isOpen: false,
  draft: "",
  setDraft: (draft: string) => set({ draft }),
}));
```

---

## 5. Supabase Architecture

### 5.1 Client Types

| Client      | Key            | RLS         | Use Case                              |
| ----------- | -------------- | ----------- | ------------------------------------- |
| **Admin**   | Service Role   | ❌ Bypassed | Server Functions (write, admin reads) |
| **Server**  | Anon + Cookies | ✅ Enforced | SSR reads, user-scoped writes         |
| **Browser** | Anon + Cookies | ✅ Enforced | Client reads, user-scoped writes      |

### 5.2 Tables (Current)

```sql
-- ai_memory (Prompt 0: exists, RLS enabled)
CREATE TABLE public.ai_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  memory_type ai_memory_type NOT NULL,  -- conversation | context | knowledge | preference
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  embedding VECTOR(2048),  -- pgvector, native dim of nvidia/nemotron-3-embed-1b (012)
  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id, memory_type, key)
);

-- Indexes: user+session, type, expires_at, embedding (IVFFLAT)
```

### 5.3 RLS Policy Pattern

```sql
-- All tables: auth.uid() = user_id
CREATE POLICY "ai_memory_select_own" ON public.ai_memory
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 6. Webi Domain Model (Contracts)

Located in `src/lib/ai/contracts/domain.ts`:

### 6.1 Messages & Conversations

```typescript
type MessageRole = "user" | "assistant" | "system" | "tool";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  // Discriminated unions for each role:
  // UserMessage, AssistantMessage (with toolCalls), SystemMessage, ToolMessage
}

interface Conversation {
  id: string;
  sessionId: string;
  userId?: string;
  status: "active" | "archived" | "closed";
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

### 6.2 Agent Context

```typescript
interface AgentContext {
  conversationId: string;
  sessionId: string;
  userId?: string;
  messages: Message[];
  memory: MemoryContext;
  rag: RAGContext;
  systemPrompt: string;
  availableTools: ToolDefinition[];
  locale: string;
  requestId: string; // Correlation ID
}
```

### 6.3 Providers

```typescript
interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly models: AIModel[];
  initialize(config: ProviderConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterable<StreamEvent>;
  abort(): void;
  getModel(modelId: string): AIModel | undefined;
  isAvailable(): boolean;
}

interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
}
```

### 6.4 Skills / Tools

```typescript
interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ToolResult {
  toolCallId: string;
  toolName: string;
  content: string;
  success: boolean;
  error?: string;
}

type ToolPermission = "public" | "authenticated" | "admin" | "internal";

interface Skill<TOptions, TResult> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly permissions: ToolPermission[];
  toToolDefinition(): ToolDefinition;
  execute(context: SkillContext<TOptions>): Promise<SkillResult<TResult>>;
  validate?(options: unknown): TOptions;
}
```

### 6.5 Events & Streaming

```typescript
type AgentEventType =
  | "agent.message.received"
  | "agent.context.built"
  | "agent.llm.started"
  | "agent.llm.completed"
  | "agent.tool.started"
  | "agent.tool.completed"
  | "agent.memory.created"
  | "agent.response.completed"
  | "agent.error";

type StreamEventType =
  | "message_start"
  | "text_delta"
  | "tool_start"
  | "tool_result"
  | "citation"
  | "message_complete"
  | "error";
```

### 6.6 Errors & Limits

```typescript
type AgentErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_INVALID_REQUEST"
  | "INVALID_TOOL_CALL"
  | "TOOL_UNAUTHORIZED"
  | "TOOL_EXECUTION_FAILED"
  | "TOOL_VALIDATION_FAILED"
  | "MAX_STEPS_EXCEEDED"
  | "CONTEXT_TOO_LARGE"
  | "TOOL_RESULT_TOO_LARGE"
  | "RAG_UNAVAILABLE"
  | "MEMORY_UNAVAILABLE"
  | "INTERNAL_ERROR";

interface AgentLimits {
  maxAgentSteps: 10;
  maxToolCalls: 5;
  globalTimeoutMs: 120_000;
  maxContextTokens: 128_000;
  maxToolResultTokens: 8_000;
}
```

---

## 7. Agent Loop Specification

### 7.1 Flow

```
User Message Received
        │
        ▼
┌───────────────────┐
│ Security Layer    │ ← Auth, Rate Limit, Validation (Zod)
└─────────┬─────────┘
        │
        ▼
┌───────────────────┐
│ Build Context     │ ← History + Memory + RAG + System Prompt + Tools
└─────────┬─────────┘
        │
        ▼
┌───────────────────┐
│ LLM Call          │ ← Provider.complete() or .stream()
└─────────┬─────────┘
        │
    ┌───┴───┐
    │       │
    ▼       ▼
FINAL    TOOL CALL
    │       │
    │       ▼
    │ ┌─────────────┐
    │ │ Validate    │ ← Zod schema validation
    │ │ Authorize   │ ← Check ToolPermission
    │ │ Execute     │ ← Skill.execute()
    │ └──────┬──────┘
    │        │
    │        ▼
    │ ┌─────────────┐
    │ │ Tool Result │ ← Append to messages
    │ └──────┬──────┘
    │        │
    └────────┘
        │
        ▼
   LOOP (while not final, enforce limits)
```

### 7.2 Limits Enforcement

- **Step counter** increments each LLM call
- **Tool call counter** increments each tool execution
- **Timeout** tracked via `AbortController` + `setTimeout`
- **Token counting** estimated via `tiktoken` or provider metadata
- **Hard stop** throws `AgentError` with `recoverable: false` for limit errors

---

## 8. Security Architecture

### 8.1 Defense Layers

| Layer                 | Mechanism                              | Location                                   |
| --------------------- | -------------------------------------- | ------------------------------------------ |
| 1. Input Validation   | Zod schemas on Server Functions        | `validator()`                              |
| 2. Sanitization       | Strip HTML, escape special chars       | Pre-LLM                                    |
| 3. Prompt Boundary    | System/user separation, explicit tools | Prompt Compiler                            |
| 4. Rate Limiting      | Token bucket / sliding window          | Middleware (Prompt 6)                      |
| 5. XSS Protection     | React auto-escape, sanitize output     | Client                                     |
| 6. Tool Authorization | Permission check before execution      | Skill Engine                               |
| 7. Secrets Management | Server-only env vars                   | `process.env` / `import.meta.env` (server) |

### 8.2 Prompt Injection Defense

- **System prompt**: Static, versioned, never includes user data
- **User messages**: Sanitized, length-limited, no tool definitions
- **Tool definitions**: Only authorized tools exposed to LLM
- **Tool results**: Validated, truncated, no raw injection
- **Output validation**: Optional schema validation on FINAL response

---

## 9. Implementation Roadmap (Prompts 1-9)

| Prompt | Focus                              | Key Deliverables                                    | Status  |
| ------ | ---------------------------------- | --------------------------------------------------- | ------- |
| **1**  | LLM Infrastructure                 | `NvidiaProvider`, `ProviderRegistry`, env config    | ✅ Done |
| **2**  | Conversations + Memory + Event Bus | Conversation CRUD, `MemoryManager`, `EventBus`      | ✅ Done |
| **3**  | RAG / Knowledge Layer              | `VectorStore`, `RAGEngine`, document ingestion      | ✅ Done |
| **4**  | Skills / Tools Engine              | `SkillRegistry`, `SkillEngine`, initial skills      | ✅ Done |
| **5**  | Agent Orchestrator                 | `Agent` class, loop, limits, persistence            | ✅ Done |
| **6**  | Security / Auth / Rate Limiting    | Middleware, rate limiter, audit log, prompt defense | ✅ Done |
| **7**  | TanStack Start API + Streaming     | `/api/chat` Server Function, stream protocol        | ✅ Done |
| **8**  | Chat UI                            | `ChatWidget`, Zustand stores, streaming hooks       | ✅ Done |
| **9**  | E2E + Observability + Deploy       | Tests, health endpoint, logging, `.env.example`     | ✅ Done |

---

## 10. Current Repository State (Post-Prompt 0)

## 10. Current Repository State (Post-Prompt 9)

### 10.1 Created Files

```
src/lib/ai/contracts/
├── index.ts       # Barrel export
└── domain.ts      # All Webi domain types (1000+ lines)

src/lib/ai/providers/
├── nvidia.ts          # NVIDIA NIM provider implementation
├── model-router.ts    # Provider registry with fallback
├── types.ts           # Provider types
├── errors.ts          # Provider error types
├── nvidia/            # NVIDIA-specific types
└── index.ts           # Barrel export

src/lib/ai/agent/
├── orchestrator.ts       # Agent orchestrator with loop
├── context-builder.ts    # Context builder for agent
├── agent-limits.ts       # Agent limits configuration
├── system-prompt.ts      # System prompt builder
├── index.ts              # Barrel export

src/lib/ai/skills/
├── types.ts              # Skill types & contracts
├── registry.ts           # Skill registry
├── executor.ts           # Skill executor with auth
├── validator.ts          # Skill validation (Zod)
├── search-knowledge.ts   # RAG search skill
├── summarize.ts          # Summarization skill
├── index.ts              # Barrel export

src/lib/ai/rag/
├── rag-engine.ts        # RAG engine
├── retriever.ts         # Retriever with fallback
├── context-builder.ts   # Context builder
├── pgvector-store.ts    # pgvector store
├── types.ts             # RAG types
├── index.ts             # Barrel export

src/lib/ai/embeddings/
├── nvidia.ts            # NVIDIA embedding provider
├── index.ts             # Barrel export

src/lib/ai/providers/
├── nvidia.ts            # NVIDIA provider
├── model-router.ts      # Provider registry
├── types.ts             # Provider types
├── errors.ts            # Provider errors
├── index.ts             # Barrel export

src/lib/ai/security/
├── rate-limiter.ts      # Rate limiting (token bucket + sliding window)
├── validation.ts        # Zod validation schemas
├── prompt-injection.ts  # Prompt injection detection
├── audit-log.ts         # Audit logging
├── middleware.ts        # Security middleware
├── tool-security.ts     # Tool authorization
├── headers.ts           # Security headers
├── index.ts             # Barrel export

src/lib/ai/memory/
├── memory-service.ts    # Memory service
├── index.ts             # Barrel export

src/lib/ai/events/
├── event-bus.ts         # Event bus
├── index.ts             # Barrel export

src/lib/ai/__tests__/
├── chat.test.ts             # Chat integration tests
├── orchestrator.test.ts     # Orchestrator tests
├── providers.test.ts        # Provider tests
├── rag.test.ts              # RAG tests
├── skills.test.ts           # Skills tests
├── security.test.ts         # Security tests
├── security-integration.test.ts # Security integration tests
├── memory-event-bus.test.ts # Memory/Event bus tests
├── test-utils.ts            # Test utilities

src/lib/observability.ts       # Observability (metrics, logging, health)
src/lib/auth/session.ts        # Session management
src/lib/auth/middleware.ts     # Auth middleware

src/server/functions/
├── chat.ts             # Chat Server Function (SSE streaming)
├── health.ts           # Health endpoint
├── conversations.ts    # Conversation CRUD
├── ai-memory.ts        # AI Memory CRUD
├── articles.ts         # Articles CRUD
├── realisations.ts     # Realisations CRUD
├── admin.ts            # Admin functions

src/components/chat/
├── ChatWidget.tsx       # Main chat widget
├── ChatWindow.tsx       # Chat window
├── ChatMessage.tsx      # Message rendering
├── ChatInput.tsx        # Input component
├── TypingIndicator.tsx  # Typing indicator
├── ToolStatus.tsx       # Tool status display
├── Citation.tsx         # Citation display
├── types.ts             # Chat types
├── index.ts             # Barrel export

src/hooks/
├── use-chat.ts          # Chat hook with SSE
├── use-mobile.ts        # Mobile detection

src/lib/locale-context.tsx   # Locale context
src/lib/theme-context.tsx    # Theme context
src/lib/supabase/client.ts   # Browser Supabase client
src/lib/supabase/server.ts   # Server Supabase client
src/lib/supabase/admin.ts    # Admin Supabase client
src/lib/supabase/index.ts    # Barrel export

src/lib/ai/contracts/index.ts  # Barrel export
src/lib/ai/contracts/domain.ts # Domain types

AGENTS.md          # Updated with full conventions + Webi rules
docs/WEBI_ARCHITECTURE.md     # This document
.env.example       # Environment variables template
```

### 10.2 Existing Infrastructure (Ready for Production)

- ✅ TanStack Start + Nitro + Vite configured
- ✅ Supabase clients (admin, server, browser)
- ✅ Auth middleware + session extraction
- ✅ `ai_memory` table with pgvector (`vector(2048)`), RLS, indexes
- ✅ Server Functions for `ai_memory` CRUD
- ✅ Admin UI at `/admin/ai-memory`
- ✅ shadcn/ui (47 components), Tailwind 4, Framer Motion
- ✅ TypeScript strict, ESLint, Prettier
- ✅ **206 tests passing** (unit + integration)
- ✅ **Observability layer** (metrics, structured logging, health checks)
- ✅ **Health endpoint** (`/api/health`) with DB + provider checks
- ✅ **Structured logging** (requestId, conversationId, provider, duration, event, error type)
- ✅ **Security middleware** (auth, rate limit, validation, prompt injection, audit)
- ✅ **Chat endpoint** (`/api/chat`) with SSE streaming
- ✅ **Chat UI** (widget, window, messages, input, citations, tool status)
- ✅ **Rate limiting** (token bucket, 30 req/min, burst 5)
- ✅ **Prompt injection detection** (29 patterns)
- ✅ **Audit logging** (buffered writes to `ai_audit_log`)
- ✅ **Tool security** (public/authenticated/admin/internal permissions)
- ✅ **RAG Engine** with server-side vector search (`match_knowledge_chunks` RPC) + fallback
- ✅ **Skills**: search_knowledge (off the chat path — automatic retrieval instead), summarize
- ✅ **NVIDIA NIM provider** with streaming + fallback
- ✅ **NVIDIA Embedding provider** (`nvidia/nemotron-3-embed-1b`, 2048 dims, single `EmbeddingConfig`)
- ✅ **Provider registry** with fallback support
- ✅ **Chat UI** (widget, window, messages, input, citations, tool status)
- ✅ **Zustand store** for chat UI state
- ✅ **TanStack Query** for server state
- ✅ **Streaming SSE** with typed events
- ✅ **Health endpoint** (`/api/health`) with DB + provider checks
- ✅ **Structured logging** (requestId, conversationId, provider, duration, event, error type)
- ✅ **`.env.example`** with all required variables

### 10.3 Missing (None — All Prompts 1-9 Complete)

---

## 11. Assumptions & Decisions

### 11.1 Assumptions

1. **Single admin user** — Current `admin_users` table assumes one admin
2. **Session-based** — Conversations tied to `session_id` (UUID), not user auth
3. **NVIDIA NIM API** — Compatible with OpenAI-compatible `/chat/completions` endpoint
4. **Embeddings** — 2048 dims native (`nvidia/nemotron-3-embed-1b`, NVIDIA NIM; single `EmbeddingConfig`, never truncated)
5. **No multi-tenancy** — Current schema is single-tenant (admin only)

### 11.2 Key Decisions (ADRs)

| ADR | Decision                                | Rationale                                        |
| --- | --------------------------------------- | ------------------------------------------------ |
| 001 | TanStack Start Server Functions         | Typed RPC, server-only secrets, SSR native       |
| 002 | Supabase + pgvector                     | Unified DB + vector, RLS, admin UI ready         |
| 003 | NVIDIA NIM primary                      | Cost-effective, OpenAI-compatible, self-hostable |
| 004 | `src/lib/ai/contracts`                  | Shared types, provider-agnostic, single source   |
| 005 | Zustand (UI) + TanStack Query (server)  | Clear separation, no conflation                  |
| 006 | RLS everywhere, service role only in SF | Defense in depth, least privilege                |
| 007 | No LangChain                            | Avoid bloat, direct provider control             |
| 008 | Hard limits in agent loop               | Prevent runaway costs, infinite loops            |

---

## 12. Pre-Existing Issues (Not Blocking Prompt 0)

| Issue                                                                                                       | Severity | Notes                                                          |
| ----------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| No tests configured                                                                                         | Medium   | No Vitest/Jest, no CI                                          |
| No `.env.example`                                                                                           | Low      | Required for Prompt 1+                                         |
| `ai_memory.embedding` / `knowledge_chunks.embedding` are `vector(2048)` (012) but TypeScript shows `string` | Low      | PostgREST JSON bridge; repository maps explicitly, no raw leak |
| No rate limiting                                                                                            | Medium   | Required for Prompt 6                                          |
| No health endpoint                                                                                          | Low      | Required for Prompt 9                                          |
| Bunfig.toml exists but npm is reference                                                                     | Info     | Documented in AGENTS.md                                        |

---

## 13. Next Steps (Prompt 1)

1. Install NVIDIA NIM SDK (or use `openai` package with custom baseURL)
2. Create `src/lib/ai/providers/nvidia/`
3. Implement `LLMProvider` interface for NVIDIA
4. Create `ProviderRegistry` with primary/fallback
5. Add `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_BASE_URL` to env
6. Create `.env.example`
7. Unit tests with mocked provider

---

_Generated by Prompt 0 — Audit, Architecture & Contracts_  
_Reference: `AGENTS.md` for conventions, `src/lib/ai/contracts/domain.ts` for types_
