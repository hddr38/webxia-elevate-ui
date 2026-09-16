# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: French-speaking decision makers at PMEs / startups who need a premium website, application, or integrated AI feature. Situation: comparing agencies via services, réalisations, and journal, then briefing/contacting WebXIA. Success = submitting a qualified contact brief.

Secondary (confirmed, not primary): proof-seeking visitors who read work/journal before deciding; internal admin who publishes articles/réalisations and supervises AI memory via `/admin`.

## Product Purpose

WebXIA site vitrine + admin + Webi agent. It makes it possible for prospects to evaluate a senior product team (services, proof, journal) and start a project, while letting the agency publish proof autonomously and demonstrate AI competence through a working agent. Success = qualified briefs from the contact flow, plus admin autonomy for content and AI memory.

## Positioning

Senior product team shipping high-performance websites, applications, and AI tooling — with Webi (RAG + persistent memory + skills on NVIDIA NIM) integrated as a working proof of AI delivery, not a decorative chatbot. A neighboring agency vitrine without a production-grade agent loop could not truthfully copy this claim.

## Operating Context

Workflows: discover (services/work/journal) → evaluate proof → contact brief → agency follow-up; admin side: login → manage articles / réalisations / ai-memory → publish.

Environments: responsive web (desktop + mobile web), FR default with EN switch (`webxia-locale`), light default + dark mode supported.

Tools and rituals: `npm run dev` / `npm run build` (strict typecheck) / `npm run lint` / `npm run test`; Server Functions as sole client→server bridge; Lovable-synced branch — no force-push, no history rewrite; `.env` never committed, keys via password manager.

## Capabilities and Constraints

Confirmed functionality: public pages `/`, `/services`, `/work`, `/about`, `/contact`, `/journal`, `/journal.$slug`, legal (`mentions-legales`, `politique-confidentialite`, `cgu`); admin CMS `/admin` (articles, réalisations, ai-memory) behind Supabase Auth + `adminMiddleware`; Webi chat (`ChatWidget` + `/api/chat` SSE streaming, citations, tool status) with conversation history, `ai_memory` (pgvector 2048), RAG retrieval (`match_knowledge_chunks` RPC + fallback), skills (`search_knowledge` automatic, `summarize`), provider registry (NVIDIA NIM primary, fallback), rate limiting, prompt-injection defense, audit log, health endpoint.

Technical constraints: TanStack Start Server Functions only; RLS mandatory (`auth.uid() = user_id`), service role server-only; Zod on all Server Function inputs; TypeScript strict, no `any`; no real LLM calls in automated tests (mocked providers); `VITE_*` only on client; single-tenant, session-based conversations (no multi-tenancy claimed).

Explicitly undecided: which future surfaces (if any) get built next; whether journal/CMS needs multi-role admin; pricing/packaging content — must not be invented.

## Brand Commitments

Name: WebXIA. Existing assets: `public/logo.svg` (primary) + `public/logo (1).svg` (alternate); font stack Inter with system-ui fallback; FR/EN copy in `src/data/*` and locale context; contact identity `webxia@protonmail.com` / `webxia.fr` (confirmed by owner; canonical URLs in code use `https://webxia.fr`). Voice observed: professional, confident, modern. Binding visual constraints volunteered: none — visual world belongs to new-work/document, not init.

## Evidence on Hand

Real content and paths: `src/data/projects.ts`, `src/data/services-fr.ts`, `src/data/services-en.ts`, `src/data/articles.ts`, `src/data/team.ts`; `supabase/migrations/` + `docs/DATABASE_SCHEMA.md`; `docs/WEBI_ARCHITECTURE.md`, `AGENTS.md`, `README.md`; legal routes present. Absences future work must not fabricate: no confirmed testimonials, client logos, benchmarks, pricing, or deployment claims in the repo — do not invent them.

## Product Principles

1. Proof before promise — work, journal, and Webi itself carry the credibility, not adjectives.
2. Every surface serves the brief — browsing ends in a qualified contact, not endless exploration.
3. Webi demonstrates, then assists — the agent is evidence of AI delivery capability first, support widget second.
4. Admin autonomy without dev — content and memory management must stay publishable without code changes.
5. Trust via engineering rigor — RLS, validation, mocked tests, and auditability are product features, not internals.
