# WebXIA — Database Schema

> Source of truth for DDL: `supabase/migrations/001–014`.
> 011 (`uq_conversations_one_active_per_session`, partial unique index) is
> committed but NOT yet applied remotely — apply via SQL Editor before relying
> on getOrCreateConversation idempotence under concurrency.
> 012/013/014 (RAG: `vector(2048)` + HNSW halfvec, `match_knowledge_chunks` RPC,
> `content_hash`) were APPLIED manually on 2026-09-10 and verified read-only
> (columns, HNSW indexes, RPC `SECURITY DEFINER`/`STABLE`, UNIQUE hash).
> Remote is aligned with 3B code. See `015_rag_match_lockdown.sql`
> (CREATED — NOT APPLIED): restricts RPC `EXECUTE` to `service_role`
> (`anon`/`authenticated` still hold it via default privileges).
> Remote state verified read-only on 2026-09-09 (PostgREST `limit=0` + OpenAPI):
> all tables below **EXIST** with the columns and types listed, EXCEPT the
> 012–014 changes (columns still `vector(1536)`, no RPC, no `content_hash`
> until applied).
> Indexes and RLS policies are **per migrations** (not directly introspectable
> via PostgREST); RLS enforcement on `conversations` was proven behaviorally
> (anon INSERT rejected before the service-role fix).

Conventions: PK `id uuid default uuid_generate_v4()` (extension `uuid-ossp`),
`t created_at / updated_at timestamptz default now()`, RLS enabled on every table.

---

## 1. `admin_users` — CMS admins (001)

| Column                      | Type                                            | Notes                         |
| --------------------------- | ----------------------------------------------- | ----------------------------- |
| `id`                        | uuid PK                                         | internal admin id             |
| `user_id`                   | uuid UNIQUE NOT NULL → `auth.users(id)` cascade | Supabase auth user            |
| `email`                     | text UNIQUE NOT NULL                            |                               |
| `role`                      | text, check `= 'admin'`                         | single role today             |
| `created_at` / `updated_at` | timestamptz                                     | trigger `handle_updated_at()` |

- **Indexes:** none beyond PK/unique.
- **RLS:** self-access only (`auth.uid() = user_id` for select/insert/update/delete).
- **Usage:** `getSessionUser()` joins this table to resolve identity + role; admin bypass policies reference it.

## 2. `articles` — Journal CMS (001, +002, +006)

`id, slug UNIQUE, title, excerpt, content_md NOT NULL, content_html,
cover_image_url, status article_status (draft/published/archived),
published_at, meta_title, meta_description, tags text[] default '{}',
author_id uuid → auth.users SET NULL (nullable since 002),
created_at, updated_at, category text[] default '{}' (006),
reading_minutes int default 0 (006)`.

- **Indexes:** `status`, `slug`, `author_id`, `published_at desc`,
  `category` (gin), `tags` (gin), `(status, published_at desc)` partial published.
- **RLS:** public `select` where `published`; full admin CRUD via `admin_users` check.
- **Usage:** public journal + admin CMS. Enums: `article_status`.

## 3. `realisations` — Portfolio CMS (001, +002, +006)

`id, slug UNIQUE, title, short_description, description_md NOT NULL,
description_html, client_name, project_url, github_url, cover_image_url,
gallery_images text[], technologies text[], status realisation_status,
published_at, featured bool default false, sort_order int default 0,
meta_title, meta_description, author_id uuid → auth.users SET NULL,
created_at, updated_at, category text[] default '{}' (006)`.

- **Indexes:** `status`, `slug`, `author_id`, `featured` (partial), `category` (gin),
  `technologies` (gin), `(status, published_at)`, `(status, sort_order)`.
- **RLS:** same pattern as articles (public read published, admin CRUD).
- **Usage:** public work pages + admin CMS.

## 4. `ai_memory` — Agent/user persistent memory (001)

| Column                      | Type                                     | Notes                                                                                                   |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                        | uuid PK                                  |                                                                                                         |
| `user_id`                   | uuid NOT NULL → `auth.users(id)` cascade | owner (Supabase user)                                                                                   |
| `session_id`                | uuid NOT NULL                            | anonymous Webi session                                                                                  |
| `memory_type`               | `ai_memory_type` enum                    | conversation \| context \| knowledge \| preference                                                      |
| `key`                       | text NOT NULL                            |                                                                                                         |
| `value`                     | jsonb NOT NULL default `'{}'`            |                                                                                                         |
| `embedding`                 | `vector(2048)` NULL                      | pgvector (`vector` ext. from 001); native dim of `nvidia/nemotron-3-embed-1b` (012, applied 2026-09-10) |
| `metadata`                  | jsonb NOT NULL default `'{}'`            |                                                                                                         |
| `expires_at`                | timestamptz NULL                         | TTL                                                                                                     |
| `created_at` / `updated_at` | timestamptz                              | trigger `handle_updated_at()`                                                                           |

Unique `(user_id, session_id, memory_type, key)`.

- **Indexes:** `(user_id, session_id)`, `memory_type`, `expires_at` (partial NOT NULL),
  `embedding` **HNSW on `(embedding::halfvec(2048))`** (012).
- **RLS:** owner-only via `auth.uid() = user_id` (all commands).
- **Usage:** `memoryService.searchMemory` in agent context; stats via `get_memory_stats()` (003, redefined 004).
- **Embeddings:** same `EMBEDDING_CONFIG` as RAG (provider/model/2048); `embedText` wired in `buildAgentContext`.

## 5. `conversations` — Webi anonymous sessions (007, policies fixed `::text`)

| Column                      | Type                                              | Notes                                        |
| --------------------------- | ------------------------------------------------- | -------------------------------------------- |
| `id`                        | uuid PK                                           | = `conversationId` client                    |
| `session_id`                | uuid NOT NULL                                     | anonymous Webi session, **not an identity**  |
| `status`                    | text check active/archived/closed, default active |                                              |
| `metadata`                  | jsonb NOT NULL default `'{}'`                     |                                              |
| `created_at` / `updated_at` | timestamptz                                       | `updated_at` bumped by message trigger (008) |

- **Indexes:** `(session_id, created_at desc)` (primary access pattern), `status`.
- **RLS:** 4 session policies comparing `session_id::text` to the
  `session_id` JWT claim (fail-closed when claim absent; inert for anonymous
  visitors who carry no such claim) + `conversations_admin_all` bypass
  (`admin_users` + `auth.uid()`).
- **Usage:** created/read by `/api/chat` via **service-role + explicit checks**
  (401 without session, 403 on `conversation.session_id !== sessionId`).
  RLS remains as second layer for direct client access.

## 6. `messages` — Chat history (008, policies fixed `::text`)

| Column                       | Type                                        | Notes                   |
| ---------------------------- | ------------------------------------------- | ----------------------- |
| `id`                         | uuid PK                                     |                         |
| `conversation_id`            | uuid NOT NULL → `conversations(id)` cascade |                         |
| `role`                       | text check user/assistant/system/tool       |                         |
| `content`                    | text NOT NULL                               |                         |
| `tool_calls`                 | jsonb NULL                                  |                         |
| `tool_call_id` / `tool_name` | text NULL                                   | tool linkage            |
| `metadata`                   | jsonb NOT NULL default `'{}'`               |                         |
| `created_at`                 | timestamptz                                 | ascending history order |

- **Indexes:** `(conversation_id, created_at asc)`, `tool_call_id` (partial NOT NULL).
- **RLS:** select/insert inherit session isolation via `conversations` subquery
  (same `::text` claim comparison) + admin bypass. No update/delete policies
  (server-side writes only).
- **Usage:** conversation history loaded by `/api/chat`; trigger
  `messages_update_conversation_timestamp()` bumps parent `updated_at`.
- **Trigger function:** `update_conversation_timestamp()` (`CREATE OR REPLACE`, replayable).

## 7. `knowledge_documents` + `knowledge_chunks` — RAG base (009)

Documents: `id, title NOT NULL, content NOT NULL, source_type knowledge_doc_type
(website/pdf/manual/faq/blog/case_study), source_url, source_path, version,
author, locale default 'fr', tags text[], priority int default 0,
metadata jsonb, content_hash text NULL UNIQUE (014, global idempotence key),
created_at, updated_at` (trigger `handle_updated_at()`).

Chunks: `id, document_id → documents(id) cascade, chunk_index int,
content, embedding vector(2048) NULL (012), metadata jsonb, created_at`,
unique `(document_id, chunk_index)`.

- **Indexes:** documents `(source_type, source_url)`, `locale`, `tags` (gin),
  `priority desc`, `content_hash` unique (014); chunks `embedding`
  **HNSW on `(embedding::halfvec(2048))`** (`halfvec_cosine_ops`, 012),
  `document_id`.
- **RLS:** public select (documents unconditionally, chunks via parent match);
  writes admin-only.
- **Retrieval:** `match_knowledge_chunks(query_embedding vector(2048),
threshold, count≤20, locale?, source_type?)` — `SECURITY DEFINER`,
  searched in **halfvec space** (matches the HNSW indexes), `EXECUTE` to
  `service_role` only (013). Returns chunk+document rows with cosine
  `similarity`. See `docs/RAG.md`.

## 8. `ai_audit_log` — Security audit (010)

`id, event_type ai_audit_event_type (14 values) NOT NULL,
severity ai_audit_severity default 'medium', user_id uuid → auth.users SET NULL,
session_id uuid NULL, conversation_id uuid NULL, request_id uuid NULL,
ip_address inet NULL, user_agent text NULL, event_data jsonb default '{}',
error_message text NULL, created_at`.

- **Indexes:** `event_type`, `session_id`, `conversation_id`, `created_at desc`,
  `severity`, `user_id`.
- **RLS:** admin read + admin insert only; server writes via service-role
  (`auditLogger`, buffered 5 s flush, fail-soft).
- **Usage:** auth failures, rate limits, prompt injection, validation failures,
  permission denials. `request_id` must be UUID (`crypto.randomUUID()` everywhere).

---

## Helper functions / triggers (001, 003, 004, 008)

- `handle_updated_at()` + per-table triggers (001, 009 reuses it).
- `is_admin()`, `current_admin_id()`, `generate_slug()` (001).
- `get_articles_stats()`, `get_realisations_stats()` (003),
  `get_memory_stats()` (003, redefined 004).
- `update_conversation_timestamp()` (008).

## Verification log

- 2026-09-09, read-only probe (`limit=0` + OpenAPI, service-role, no writes):
  `conversations, messages, ai_memory, knowledge_documents, knowledge_chunks,
ai_audit_log, articles, realisations, admin_users` → all HTTP 200 with the
  columns above. Script: outside repo (temp), removed after use.
- Behavioral: anon INSERT into `conversations` rejected by RLS pre-service-role
  fix (policies enforced); post-fix chat streams end-to-end.
