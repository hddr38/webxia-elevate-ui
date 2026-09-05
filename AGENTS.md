<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# WebXIA — Webi Agent Architecture

> **Stack**: React 19.2 · TanStack Start 1.167 · TanStack Router 1.168 · Nitro 3.0 · Vite 8 · TypeScript 5.8 strict
> **UI**: Tailwind CSS 4.2 · shadcn/ui · Radix UI · Framer Motion · Lucide React
> **Data**: TanStack Query 5.83 · Supabase JS 2.111 · @supabase/ssr 0.12
> **Validation**: Zod 3.24 · React Hook Form 7.71
> **Package Manager**: npm (bunfig.toml exists but npm is reference)
> **LLM Provider**: NVIDIA NIM (priority) · OpenAI · Anthropic (future)

---

## Scripts

```json
{
  "dev": "vite dev",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

Run `npm run lint` and `npm run build` before committing. TypeScript strict mode is enabled.

---

## Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui primitives (47 components)
│   └── site/         # WebXIA site components
├── data/             # Static site data (translations, etc.)
├── features/
│   ├── articles/     # Articles CMS (admin)
│   ├── auth/         # Auth feature (admin)
│   └── realisations/ # Portfolio CMS (admin)
├── hooks/            # Shared hooks (use-mobile)
├── lib/
│   ├── ai/
│   │   └── contracts/ # Webi domain types (NEW - Prompt 0)
│   ├── auth/         # Supabase auth helpers
│   ├── supabase/     # Supabase clients (admin, server, browser)
│   ├── utils.ts      # Shared utilities (cn, slugify, cookies, pagination)
│   ├── constants.ts  # Site constants
│   ├── locale-context.tsx
│   ├── theme-context.tsx
│   ├── seo.ts
│   ├── error-capture.ts
│   └── error-page.ts
├── routes/           # TanStack Router file-based routes
│   ├── admin/        # Admin panel (protected)
│   └── ...           # Public pages
├── server/
│   └── functions/    # TanStack Start Server Functions (RPC)
│       ├── admin.ts
│       ├── ai-memory.ts
│       ├── articles.ts
│       └── realisations.ts
├── types/
│   ├── database.ts   # Generated Supabase types
│   ├── admin.ts
│   └── index.ts
├── router.tsx        # Router configuration
├── server.ts         # Nitro entry point
├── start.ts          # TanStack Start instance
└── styles.css        # Global Tailwind styles
```

---

## Architecture

### Client / Server Boundary (TanStack Start)

| Domain | Execution | Access |
|--------|-----------|--------|
| **Server** 🔒 | Server Functions / Nitro | Providers, RAG, DB, Skills, Prompts, Secrets |
| **Client** 🌍 | Browser | UI, Zustand, Hooks, Streaming display, Analytics |
| **Shared** 🔄 | Both | Types, Zod schemas, Pure utilities, Constants |

**Rule**: Server Functions are the ONLY way to call server code from client. Never import server-only code in client components.

### Data Flow

```
CLIENT (React)
  ↓ TanStack Start transport (Server Functions)
SERVER (Nitro)
  ↓ Security / auth / rate limiting
  ↓ Conversation context
  ↓ Memory + RAG + History
  ↓ Agent Orchestrator
  ↓ LLM Provider (NVIDIA NIM)
  ↓ Tool Call (optional)
  ↓ Schema validation (Zod)
  ↓ Authorization
  ↓ Skill execution
  ↓ Tool Result
  ↓ LLM
  ↓ Streaming (AsyncIterable)
  ↓ CLIENT
```

### Five Data Boundaries (NEVER conflate)

1. **Conversation History** — Ephemeral, per-session message log
2. **Agent/User Memory** — Persistent `ai_memory` table (RLS-protected)
3. **Knowledge Base / RAG** — Vector-indexed documents (future, separate from `ai_memory`)
4. **Client UI State** — Zustand stores (widget open, draft, streaming status)
5. **Server State** — TanStack Query cache (conversations, memory, RAG results)

---

## Conventions

### TypeScript

- `strict: true` in tsconfig
- No `any` — use `unknown` and narrow
- Discriminated unions for message roles, event types, error codes
- Interfaces over types for extensibility
- Zod schemas for ALL external inputs (Server Function validators)

### Server Functions

```typescript
export const myFunction = createServerFn({ method: "POST" })
  .validator((data: InputSchema) => data) // Zod schema
  .handler(async ({ data, context }) => {
    // context.request available for auth
    // Use getSupabaseAdmin() for admin operations
    // Throw Response for HTTP errors (401, 403, 429, etc.)
  });
```

### Supabase

- **Admin client** (`getSupabaseAdmin()`): Service role, bypasses RLS — ONLY in Server Functions
- **Server client** (`createSupabaseServerClient(request)`): Anon key + cookies, enforces RLS — SSR reads
- **Browser client** (`getSupabaseBrowserClient()`): Anon key, enforces RLS — Client reads

**RLS is mandatory** on all tables. Policies use `auth.uid()` = `user_id`.

### Authentication

- Supabase Auth (email/password, OAuth)
- Admin-only routes protected by `adminMiddleware` (Server Function middleware)
- `getSessionUser(request)` extracts user from access token in cookies
- `requireSessionUser(request)` throws 401 if unauthenticated

### Environment Variables

| Variable | Scope | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | Client + Server | Yes |
| `VITE_SUPABASE_ANON_KEY` | Client + Server | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes |
| `NVIDIA_NIM_API_KEY` | Server only | For Prompt 1+ |
| `NVIDIA_NIM_BASE_URL` | Server only | For Prompt 1+ |

**Never expose secrets to client**. Use `import.meta.env` only for `VITE_*` prefixed vars.

---

## Webi Agent Rules

### AI Contracts (Prompt 0)

Located in `src/lib/ai/contracts/domain.ts`:

- `Message` / `MessageRole` — User, Assistant, System, Tool
- `Conversation` / `ConversationStatus` — Conversation container
- `AgentContext` — Full context passed to LLM
- `LLMProvider` / `EmbeddingProvider` — Provider interfaces
- `ToolDefinition` / `ToolCall` / `ToolResult` — Tool calling
- `Skill` / `SkillContext` / `SkillResult` — Skill engine
- `AgentEvent` / `StreamEvent` — Event bus + streaming protocol
- `AgentError` / `AgentErrorCode` — Typed errors with recoverability
- `AgentLimits` — Configurable loop limits

### Provider Architecture (Prompt 1+)

- `LLMProvider` interface — `complete`, `stream`, `abort`, `getModel`, `isAvailable`
- `EmbeddingProvider` interface — `embed`, `batchEmbed`
- `ProviderRegistry` — Selects active provider (primary + fallback)
- NVIDIA NIM first, OpenAI/Anthropic future
- No LangChain, no excessive abstraction

### Agent Loop (Prompt 5+)

```
request
  → context (history + memory + RAG + system prompt)
  → LLM
  → FINAL response OR tool call
  → validate (Zod)
  → authorize (permissions)
  → execute (Skill)
  → tool result → LLM
  → FINAL
```

Limits: `maxAgentSteps`, `maxToolCalls`, `globalTimeoutMs`, `maxContextTokens`, `maxToolResultTokens`

### Security Rules

1. **All auth decisions server-side** — Client never decides userId, tenantId, permissions
2. **Secrets server-only** — API keys, service role key never in client bundle
3. **Zod validation** on every Server Function input
4. **Rate limiting** per IP + per user (implement in Prompt 6)
5. **Prompt injection defense** — System/data separation, explicit tool exposure, schema validation
6. **Tool permissions** — `public` | `authenticated` | `admin` | `internal` checked server-side
7. **Audit log** — `ai_audit_log` table for security events (Prompt 6)

---

## Testing Rules

- **No real LLM calls** in automated tests — mock providers
- Test: provider resolution, generation, streaming, tool calls, timeouts, retries, error mapping
- Test: conversation, memory, RAG, skills, event bus, authorization
- Run `npm run lint` and `npm run build` (includes typecheck) before commit

---

## Sensitive Files (Do Not Modify Without Reason)

- `src/server.ts` — Nitro entry point
- `src/start.ts` — TanStack Start config
- `src/router.tsx` — Router setup
- `src/lib/supabase/admin.ts` — Service role client
- `src/lib/supabase/server.ts` — SSR client
- `src/lib/auth/session.ts` — Auth extraction
- `src/lib/auth/middleware.ts` — Admin middleware
- `supabase/schema.sql` — Database schema
- `vite.config.ts` — Build config
- `tsconfig.json` — TypeScript config
- `.env` — **Never commit real secrets**

---

## Webi Implementation Status

| Prompt | Feature | Status |
|--------|---------|--------|
| 0 | Audit, Architecture, Contracts | ✅ Done |
| 1 | LLM Infrastructure / NVIDIA NIM | ⏳ Next |
| 2 | Conversations, Memory, Event Bus | ⏳ |
| 3 | RAG / Knowledge Layer | ⏳ |
| 4 | Skills / Tools Engine | ⏳ |
| 5 | Agent Orchestrator / Loop | ⏳ |
| 6 | Security / Auth / Rate Limiting | ⏳ |
| 7 | TanStack Start API + Streaming | ⏳ |
| 8 | Chat UI + Zustand + TanStack Query | ⏳ |
| 9 | E2E Tests + Observability + Deploy | ⏳ |

---

## Key Decisions (ADRs)

- **ADR-001**: TanStack Start Server Functions for all server RPC
- **ADR-002**: Supabase + pgvector for persistence + embeddings
- **ADR-003**: NVIDIA NIM as primary LLM provider
- **ADR-004**: `src/lib/ai/contracts` for provider-agnostic types
- **ADR-005**: Zustand for client UI state only, TanStack Query for server state
- **ADR-006**: RLS on all tables, service role only in Server Functions
- **ADR-007**: No LangChain, minimal provider abstraction
- **ADR-008**: Agent loop with hard limits (steps, tokens, time)