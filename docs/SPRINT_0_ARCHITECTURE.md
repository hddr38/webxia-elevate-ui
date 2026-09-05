# SPRINT 0 — Architecture & Conception de Webi

> **Version** : 2.0.0  
> **Date** : 2026-07-28  
> **Projet** : Webi — Agent IA Officiel de WebXIA  
> **Stack** : [React 19](https://react.dev) · [TanStack Start](https://tanstack.com/start/latest) · [TanStack Router](https://tanstack.com/router/latest) · Vite (dernière version stable) · [TypeScript Strict](https://www.typescriptlang.org/tsconfig/#strict) · [Tailwind CSS v4](https://tailwindcss.com) · [Framer Motion](https://motion.dev) · [shadcn/ui](https://ui.shadcn.com)  
> **LLM** : [build.nvidia.com](https://build.nvidia.com) (NVIDIA NIM API)  
> **État** : Sprint 0 — Conception pure, **zéro implémentation métier**

---

## Table des matières

1. [Architecture générale](#1-architecture-generale)
2. [Responsabilités des modules](#2-responsabilites-des-modules)
3. [Interfaces TypeScript](#3-interfaces-typescript)
4. [Système Providers](#4-systeme-providers)
5. [Moteur de Skills](#5-moteur-de-skills)
6. [Système Mémoire](#6-systeme-memoire)
7. [Architecture RAG](#7-architecture-rag)
8. [Système de Prompts](#8-systeme-de-prompts)
9. [Configuration centralisée](#9-configuration-centralisee)
10. [Store (Zustand)](#10-store-zustand)
11. [Sécurité](#11-securite)
12. [Analytics](#12-analytics)
13. [Diagrammes](#13-diagrammes)
14. [Décisions d'architecture](#14-decisions-darchitecture)
15. [Roadmap technique](#15-roadmap-technique)

---

## 1. Architecture générale

### 🌍 Frontière Client / Serveur (TanStack Start)

TanStack Start est un framework full-stack basé sur Nitro (serveur). Il permet de définir des **Server Functions** (RPC typé) qui s'exécutent exclusivement côté serveur, avec un bundle séparé. L'architecture de Webi exploite cette capacité pour cloisonner strictement les responsabilités :

| Domaine     | Icône | Exécution                     | Accès                                                           |
| ----------- | ----- | ----------------------------- | --------------------------------------------------------------- |
| **Serveur** | 🔒    | Server Functions / API Routes | Providers IA, RAG, BDD, Skills, Prompts, Secrets                |
| **Client**  | 🌍    | Browser                       | UI, Store Zustand, Hooks, Streaming display, Analytics tracking |
| **Partagé** | 🔄    | Les deux                      | Types, Schémas Zod, Utilitaires purs, Constantes                |

### Arborescence complète

```
src/
│
├── features/                          # 🌍 Feature Webi (front office)
│   └── webi/
│       ├── analytics/                 # 🌍 Tracking événements, analytics client
│       ├── api/                       # 🔒 Server Functions (TanStack Start RPC)
│       ├── components/                # 🌍 Composants React Webi
│       ├── config/                    # 🔄 Configuration feature Webi
│       ├── constants/                 # 🔄 Constantes feature Webi
│       ├── context/                   # 🌍 Context React Webi
│       ├── events/                    # 🌍🔒 Event Bus (PubSub interne)
│       │   ├── bus.ts                 #   - Instance du bus typé
│       │   ├── events.ts              #   - Énumération/liste des événements
│       │   └── types.ts               #   - Payloads des événements
│       ├── hooks/                     # 🌍 Hooks React Webi
│       ├── knowledge/                 # 🔒 Base de connaissances WebXIA
│       ├── lib/                       # 🔄 Utilitaires Webi (purs)
│       ├── memory/                    # 🔒 Gestion mémoire (serveur)
│       │   ├── conversation.ts        #   - Mémoire de conversation
│       │   ├── session.ts             #   - Mémoire de session
│       │   ├── user.ts                #   - Mémoire utilisateur
│       │   ├── project.ts             #   - Mémoire projet
│       │   ├── summary.ts             #   - Génération de résumés
│       │   ├── history.ts             #   - Historique long-terme
│       │   └── types.ts               #   - Types mémoire
│       ├── models/                    # 🔄 Modèles de données
│       ├── navigation/                # 🔒 Navigation contextuelle IA
│       ├── prompts/                   # 🔒 Prompts système et spécialisés
│       │   ├── system/                #   - Prompt système global
│       │   ├── conversation/          #   - Prompts de conversation
│       │   ├── qualification/         #   - Prompts de qualification lead
│       │   ├── seo/                   #   - Prompts SEO
│       │   ├── recommendation/        #   - Prompts de recommandation
│       │   ├── skills/                #   - Prompts spécifiques aux Skills
│       │   └── navigation/            #   - Prompts de navigation
│       ├── providers/                 # 🔒 Providers IA (côté serveur)
│       │   ├── registry.ts            #   - Registry des providers
│       │   ├── nvidia/                #   - Implémentation NVIDIA NIM
│       │   ├── openai/                #   - Implémentation OpenAI (futur)
│       │   ├── anthropic/             #   - Implémentation Anthropic (futur)
│       │   ├── mistral/               #   - Implémentation Mistral (futur)
│       │   ├── gemini/                #   - Implémentation Gemini (futur)
│       │   └── types.ts               #   - Interface commune Provider
│       ├── rag/                       # 🔒 Architecture RAG (serveur)
│       │   ├── documents/             #   - Stockage documents
│       │   ├── indexing/              #   - Indexation vectorielle
│       │   ├── retrieval/             #   - Recherche sémantique
│       │   ├── injection/             #   - Injection dans les prompts
│       │   └── types.ts               #   - Types RAG
│       ├── schemas/                   # 🔄 Schémas Zod (validation)
│       ├── services/                  # 🔒 Services métier (serveur)
│       ├── skills/                    # 🔒 Moteur de Skills (serveur)
│       │   ├── engine.ts              #   - Moteur d'exécution
│       │   ├── registry.ts            #   - Registry des Skills
│       │   ├── types.ts               #   - Interface Skill commune
│       │   ├── audit-website/         #   - Skill : Audit site web
│       │   ├── audit-seo/             #   - Skill : Audit SEO
│       │   ├── estimate/              #   - Skill : Devis
│       │   ├── recommend/             #   - Skill : Recommandation
│       │   ├── qualification/         #   - Skill : Qualification lead
│       │   ├── navigation/            #   - Skill : Navigation site
│       │   ├── generate-spec/         #   - Skill : Cahier des charges
│       │   └── appointment/           #   - Skill : Prise de rendez-vous
│       ├── store/                     # 🌍 Store client (Zustand)
│       │   ├── conversation-store.ts  #   - État conversation
│       │   ├── messages-store.ts      #   - État messages
│       │   ├── streaming-store.ts     #   - État streaming
│       │   ├── memory-store.ts        #   - État mémoire
│       │   ├── skills-store.ts        #   - État Skills
│       │   ├── navigation-store.ts    #   - État navigation
│       │   ├── provider-store.ts      #   - État provider actif
│       │   ├── lead-store.ts          #   - État lead
│       │   ├── analytics-store.ts     #   - État analytics
│       │   └── index.ts              #   - Agrégation des stores
│       ├── types/                     # 🔄 Types spécifiques Webi
│       └── utils/                     # 🔄 Utilitaires Webi
│
├── shared/                            # 🔄 Code partagé (client + serveur)
│   ├── components/                    #   - Composants partagés
│   ├── hooks/                         #   - Hooks partagés
│   ├── lib/                           #   - Bibliothèques partagées
│   ├── types/                         #   - Types globaux
│   └── utils/                         #   - Utilitaires purs
│
├── components/                        # 🌍 Composants site existants
│   ├── ui/                            #   - shadcn/ui primitives
│   └── site/                          #   - Composants site WebXIA
│
├── hooks/                             # 🌍 Hooks site existants
├── lib/                               # 🔄 Librairies site (utils, theme, locale)
├── data/                              # 🔄 Données statiques site
├── routes/                            # 🌍 Routes TanStack Router
├── router.tsx                         # 🌍 Configuration router
├── server.ts                          # 🔒 Point d'entrée SSR
├── start.ts                           # 🔒 App TanStack Start
└── styles.css                         # 🌍 Styles globaux Tailwind
```

### Explication des dossiers

#### 🔒 `features/webi/providers/` — Système de Providers IA (serveur)

Contient l'interface abstraite `AIProvider` et toutes les implémentations concrètes (NVIDIA, OpenAI, etc.). Le `registry.ts` centralise la découverte et la sélection du provider actif. Chaque provider encapsule la logique d'appel API, le streaming, la gestion des tokens et le formatage des requêtes/réponses. **Aucun code client ne dépend directement d'un provider concret.**

#### 🔒 `features/webi/skills/` — Moteur de Skills (serveur)

Implémente le standard **Tool Calling** des LLM modernes. Chaque Skill est une classe autonome qui implémente l'interface `Skill`. Le `registry.ts` découvre et enregistre automatiquement toutes les Skills. Le `engine.ts` orchestre l'appel : LLM → Tool Call Request → Skill → Tool Call Response → LLM. Les Skills s'exécutent exclusivement côté serveur.

#### 🌍 `features/webi/events/` — Event Bus (client + serveur)

Système PubSub interne qui découple l'UI des services IA. Le bus permet à n'importe quel module d'émettre ou de s'abonner à des événements typés (`StreamChunkReceived`, `SkillStarted`, `MemoryUpdated`, etc.) sans créer de dépendances directes. L'UI s'abonne aux événements pour mettre à jour le Store Zustand ; les services émettent des événements sans connaître les consommateurs.

#### 🌍 `features/webi/store/` — Store client Zustand

Gestion d'état côté client uniquement. Chaque store est un slice Zustand indépendant. Les stores sont mis à jour soit par des actions directes (clic utilisateur), soit par abonnement à l'Event Bus. Aucune logique métier lourde dans les stores — ils sont de simples conteneurs d'état.

#### 🔒 `features/webi/rag/` — Architecture RAG (serveur)

Définit le contrat pour le Retrieval-Augmented Generation. Les documents sont stockés, indexés dans un moteur vectoriel, et retrouvés par similarité sémantique. Les résultats sont injectés dans les prompts système. Compatible avec Pinecone, Supabase pgvector, Qdrant, ou tout autre moteur vectoriel via une interface commune.

#### 🔒 `features/webi/memory/` — Système mémoire (serveur)

Gère la persistance et la récupération du contexte à plusieurs niveaux : conversation courante, session en cours, historique utilisateur, mémoire projet, résumés générés, et connaissances WebXIA. Chaque niveau a une durée de vie et une granularité différentes. La mémoire est injectée dans le contexte du LLM à chaque tour.

#### 🔒 `features/webi/prompts/` — Système de prompts (serveur)

Tous les prompts sont isolés dans des fichiers dédiés, organisés par domaine fonctionnel. Le prompt système global est totalement séparé des prompts spécialisés (qualification, SEO, recommandation). Les prompts sont chargés dynamiquement et composés par le service de conversation avant envoi au LLM.

#### 🔄 `features/webi/lib/` — Utilitaires purs (partagé)

Fonctions utilitaires pures (sans effet de bord, sans dépendance au DOM ou au serveur) qui peuvent être importées des deux côtés de la barrière client/serveur.

---

## 2. Responsabilités des modules

### Chaîne de dépendance

```
                    ┌─────────────────────────────┐
                    │         Provider             │ 🔒 Appel API LLM
                    │  (NVIDIA, OpenAI, ...)       │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │       Conversation           │ 🔒 Orchestration
                    │  (orchestrateur central)     │
                    └──┬───┬───┬───┬───┬───┬──────┘
                       │   │   │   │   │   │
         ┌─────────────┘   │   │   │   │   └─────────────┐
         ▼                 ▼   │   ▼   ▼                  ▼
  ┌────────────┐   ┌──────────┐│┌──────────┐   ┌──────────────────┐
  │  Memory    │   │  Skills  │││   RAG    │   │   Prompts        │
  │ (contexte) │   │ (tools)  │││(knowledg)│   │ (template)       │
  └────────────┘   └──────────┘│└──────────┘   └──────────────────┘
                              │
                         ┌────┴──────┐
                         │  Event Bus │ 🌍🔒
                         │  (PubSub)  │
                         └────┬──────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
  │   Store      │   │  Navigation  │   │   Analytics      │
  │  (Zustand)   │   │  (UI state)  │   │   (tracking)     │
  └──────────────┘   └──────────────┘   └──────────────────┘
         │
         ▼
  ┌──────────────┐
  │   UI / React  │ 🌍
  │  (components) │
  └──────────────┘
```

### Responsabilités uniques par module

| Module           | Responsabilité unique                                             | Domaine       |
| ---------------- | ----------------------------------------------------------------- | ------------- |
| **Provider**     | Encapsuler l'appel API à un fournisseur LLM                       | 🔒 Serveur    |
| **Conversation** | Orchestrer le cycle complet d'un échange utilisateur-LLM          | 🔒 Serveur    |
| **Memory**       | Gérer la persistance et l'injection du contexte conversationnel   | 🔒 Serveur    |
| **Skills**       | Exécuter les outils spécialisés décidés par le LLM (Tool Calling) | 🔒 Serveur    |
| **RAG**          | Retrieval-Augmented Generation : indexer, chercher, injecter      | 🔒 Serveur    |
| **Prompts**      | Stocker et composer les templates de prompts                      | 🔒 Serveur    |
| **Navigation**   | Déduire et proposer des actions de navigation sur le site         | 🔒 Serveur    |
| **Analytics**    | Collecter et transmettre les événements d'interaction             | 🌍 Client     |
| **Event Bus**    | Découpler les modules par un système PubSub typé                  | 🌍🔒 Les deux |
| **Store**        | Gérer l'état réactif côté client (Zustand)                        | 🌍 Client     |
| **UI**           | Rendre l'interface utilisateur et les interactions                | 🌍 Client     |

### Règle de non-circularié

```
Provider     →  Conversation
Memory       →  Conversation
Skills       →  Conversation (via Tool Call Response)
RAG          →  Conversation (via context injection)
Prompts      →  Conversation (via template loading)
Conversation →  Event Bus (émet)
Event Bus    →  Store (souscription)
Store        →  UI (binding Zustand → React)
UI           →  Conversation (via action utilisateur)
```

**Aucune dépendance circulaire.** Le graphe de dépendance est orienté et acyclique. L'Event Bus permet spécifiquement d'éviter que l'UI dépende directement des services serveur.

---

## 3. Interfaces TypeScript (contrats du système)

### 3.1 Conversation

```typescript
// features/webi/types/domain.ts

type MessageRole = "user" | "assistant" | "system" | "tool";

interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface UserMessage extends ConversationMessage {
  role: "user";
}

interface AssistantMessage extends ConversationMessage {
  role: "assistant";
  toolCalls?: ToolCallRequest[];
}

interface SystemMessage extends ConversationMessage {
  role: "system";
}

interface ToolMessage extends ConversationMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
}

interface Conversation {
  id: string;
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
  metadata?: ConversationMetadata;
}

interface ConversationMetadata {
  userAgent?: string;
  referrer?: string;
  pagePath?: string;
  locale?: string;
  leadId?: string;
}
```

### 3.2 System Prompt & Prompt Templates

```typescript
// features/webi/types/prompts.ts

interface SystemPrompt {
  id: string;
  version: string;
  content: string;
  priority: number;
}

interface PromptTemplate {
  id: string;
  category: PromptCategory;
  template: string;
  variables: string[];
  description?: string;
}

type PromptCategory =
  | "system"
  | "conversation"
  | "qualification"
  | "seo"
  | "recommendation"
  | "skills"
  | "navigation";

interface CompiledPrompt {
  system: string;
  messages: ConversationMessage[];
  context?: RAGContext;
  memory?: MemoryContext;
}
```

### 3.3 Provider

```typescript
// features/webi/providers/types.ts

interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: AIModel[];

  initialize(config: ProviderConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterable<AIStreamEvent>;
  abort(): void;
  getModel(modelId: string): AIModel | undefined;
  isAvailable(): boolean;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

interface ProviderRequest {
  model: string;
  messages: ConversationMessage[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ProviderResponse {
  id: string;
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  toolCalls?: ToolCallRequest[];
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

type FinishReason = "stop" | "length" | "tool_calls" | "error" | "abort";

interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  maxTokens: number;
  costPerToken: CostPerToken;
}

interface ModelCapability {
  type: "chat" | "streaming" | "tool_calling" | "vision" | "function_calling";
  enabled: boolean;
}

interface CostPerToken {
  input: number;
  output: number;
}
```

### 3.4 Streaming

```typescript
// features/webi/types/streaming.ts

interface AIStreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
  conversationId: string;
}

type StreamEventType =
  | "chunk"
  | "done"
  | "error"
  | "tool_call_start"
  | "tool_call_end"
  | "provider_switch";

interface StreamChunk {
  type: "chunk";
  data: {
    content: string;
    index: number;
    finishReason?: FinishReason;
  };
}

interface StreamDone {
  type: "done";
  data: {
    fullContent: string;
    usage: TokenUsage;
    toolCalls?: ToolCallRequest[];
  };
}

interface StreamError {
  type: "error";
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

### 3.5 Tools & Skills

```typescript
// features/webi/skills/types.ts

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCallRequest {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolCallResponse {
  toolCallId: string;
  content: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface Skill<TOptions = Record<string, unknown>, TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;

  toToolDefinition(): ToolDefinition;
  execute(context: SkillContext<TOptions>): Promise<SkillResult<TResult>>;
  validate?(options: unknown): TOptions;
}

interface SkillContext<TOptions = Record<string, unknown>> {
  conversationId: string;
  sessionId: string;
  options: TOptions;
  memory: MemoryContext;
  knowledge: KnowledgeDocument[];
}

interface SkillResult<TResult = unknown> {
  data: TResult;
  summary: string;
  citations?: Citation[];
  followUp?: string;
}

interface SkillRegistry {
  register(skill: Skill): void;
  unregister(skillId: string): void;
  get(skillId: string): Skill | undefined;
  getAll(): Skill[];
  getToolDefinitions(): ToolDefinition[];
  findByName(name: string): Skill | undefined;
}
```

### 3.6 Recommendation & Lead

```typescript
// features/webi/types/business.ts

interface Recommendation {
  id: string;
  serviceId: string;
  serviceName: string;
  score: number;
  reason: string;
  confidence: number;
  citations?: Citation[];
}

interface Citation {
  source: string;
  excerpt: string;
  relevance: number;
}

interface Lead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  budget?: BudgetRange;
  timeline?: Timeline;
  source: string;
  createdAt: number;
  qualified: boolean;
}

type BudgetRange = "<5k" | "5k-15k" | "15k-50k" | "50k+";
type Timeline = "urgent" | "1month" | "3months" | "6months" | "exploring";

interface LeadQualification {
  leadId: string;
  score: number;
  category: QualificationCategory;
  criteria: QualificationCriterion[];
  recommendedAction: string;
}

type QualificationCategory = "hot" | "warm" | "cold" | "unqualified";

interface QualificationCriterion {
  name: string;
  score: number;
  weight: number;
  reason: string;
}
```

### 3.7 Knowledge & RAG

```typescript
// features/webi/rag/types.ts

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: DocumentSource;
  metadata: DocumentMetadata;
  embeddings?: number[];
}

interface DocumentSource {
  type: "website" | "pdf" | "manual" | "faq" | "blog" | "case_study";
  url?: string;
  path?: string;
  version?: string;
}

interface DocumentMetadata {
  author?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  locale: string;
  priority: number;
}

interface RAGContext {
  documents: ScoredDocument[];
  query: string;
  strategy: RetrievalStrategy;
}

interface ScoredDocument extends KnowledgeDocument {
  score: number;
  distance: number;
}

type RetrievalStrategy = "semantic" | "keyword" | "hybrid" | "rerank";

interface VectorStore {
  store(documents: KnowledgeDocument[]): Promise<void>;
  search(query: string, limit?: number): Promise<ScoredDocument[]>;
  delete(documentId: string): Promise<void>;
  update(document: KnowledgeDocument): Promise<void>;
  clear(): Promise<void>;
}
```

### 3.8 Memory

```typescript
// features/webi/memory/types.ts

interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  summary?: string;
  timestamp: number;
  ttl?: number;
}

type MemoryType = "conversation" | "session" | "user" | "project" | "summary" | "history";

interface MemoryContext {
  conversation: ConversationSummary;
  session: SessionInfo;
  user?: UserProfile;
  project?: ProjectInfo;
  summaries: ConversationSummary[];
  history: ConversationHistory[];
}

interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  sentiment: Sentiment;
  generatedAt: number;
}

interface SessionInfo {
  sessionId: string;
  startedAt: number;
  lastActivity: number;
  pageViews: number;
  messagesCount: number;
  locale: string;
}

interface UserProfile {
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

interface UserPreferences {
  locale: string;
  theme: "light" | "dark";
  communicationChannel: Channel;
}

type Channel = "web" | "mobile" | "whatsapp" | "telegram" | "email";

interface ProjectInfo {
  projectId?: string;
  name?: string;
  type?: string;
  status: ProjectStatus;
  budget?: BudgetRange;
  timeline?: Timeline;
}

type ProjectStatus = "discovery" | "proposal" | "active" | "completed" | "cancelled";

interface ConversationHistory {
  conversationId: string;
  summary: string;
  date: number;
  outcome?: string;
}
```

### 3.9 Navigation

```typescript
// features/webi/navigation/types.ts

interface NavigationAction {
  id: string;
  type: NavigationType;
  label: string;
  path: string;
  params?: Record<string, string>;
  confidence: number;
  reason: string;
}

type NavigationType = "page" | "section" | "service" | "portfolio" | "contact" | "external";

interface NavigationSuggestion {
  actions: NavigationAction[];
  context: string;
  triggeredBy: string;
}
```

### 3.10 Analytics

```typescript
// features/webi/analytics/types.ts

interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  conversationId?: string;
  metadata: Record<string, unknown>;
}

type AnalyticsEventType =
  | "conversation_started"
  | "message_sent"
  | "message_received"
  | "recommendation_generated"
  | "recommendation_clicked"
  | "skill_started"
  | "skill_completed"
  | "skill_failed"
  | "page_opened"
  | "lead_created"
  | "lead_qualified"
  | "conversation_finished"
  | "error"
  | "provider_switched"
  | "memory_updated"
  | "user_feedback";

interface AnalyticsTracker {
  track(event: AnalyticsEvent): void;
  flush(): Promise<void>;
  getSessionEvents(sessionId: string): AnalyticsEvent[];
}
```

### 3.11 Event Bus (Partie 2)

```typescript
// features/webi/events/types.ts

interface EventBusPayload {
  [EventTypeName]: {
    conversation_started: { conversationId: string; sessionId: string };
    message_sent: { messageId: string; content: string; role: MessageRole };
    message_received: { messageId: string; content: string };
    stream_chunk_received: { content: string; index: number };
    stream_completed: { fullContent: string; usage: TokenUsage };
    stream_error: { code: string; message: string; recoverable: boolean };
    skill_started: { skillId: string; conversationId: string };
    skill_completed: { skillId: string; result: unknown; duration: number };
    skill_failed: { skillId: string; error: string };
    memory_updated: { type: MemoryType; summary: string };
    provider_switched: { from: string; to: string; model: string };
    recommendation_generated: { recommendations: number };
    navigation_suggested: { actions: NavigationAction[] };
    lead_created: { leadId: string; score: number };
    error_occurred: { code: string; message: string; fatal: boolean };
  }[EventTypeName];
}

type EventTypeName = keyof EventTypeMap;

interface EventTypeMap {
  conversation_started: { conversationId: string; sessionId: string };
  message_sent: { messageId: string; content: string; role: MessageRole };
  message_received: { messageId: string; content: string };
  stream_chunk_received: { content: string; index: number };
  stream_completed: { fullContent: string; usage: TokenUsage };
  stream_error: { code: string; message: string; recoverable: boolean };
  skill_started: { skillId: string; conversationId: string };
  skill_completed: { skillId: string; result: unknown; duration: number };
  skill_failed: { skillId: string; error: string };
  memory_updated: { type: MemoryType; summary: string };
  provider_switched: { from: string; to: string; model: string };
  recommendation_generated: { recommendations: number };
  navigation_suggested: { actions: NavigationAction[] };
  lead_created: { leadId: string; score: number };
  error_occurred: { code: string; message: string; fatal: boolean };
}

interface EventBus {
  emit<T extends EventTypeName>(type: T, payload: EventBusPayload[T]): void;
  on<T extends EventTypeName>(type: T, handler: EventHandler<EventBusPayload[T]>): Unsubscribe;
  once<T extends EventTypeName>(type: T, handler: EventHandler<EventBusPayload[T]>): Unsubscribe;
  off<T extends EventTypeName>(type: T, handler: EventHandler<EventBusPayload[T]>): void;
  clear(): void;
}

type EventHandler<T> = (payload: T) => void;
type Unsubscribe = () => void;
```

### 3.12 Server Function Calls (TanStack Start RPC)

```typescript
// features/webi/api/types.ts

interface ServerFunctionCall<TRequest = unknown, TResponse = unknown> {
  name: string;
  input: TRequest;
  output: TResponse;
  meta: {
    authenticated?: boolean;
    rateLimited?: boolean;
    timeout?: number;
  };
}

// Exemple : les Server Functions TanStack Start sont typées ainsi :
// 'server only' — ce fichier ne sera jamais importé côté client
interface WebiServerFunctions {
  sendMessage(input: SendMessageInput): Promise<SendMessageOutput>;
  streamMessage(input: StreamMessageInput): AsyncIterable<AIStreamEvent>;
  executeSkill(input: ExecuteSkillInput): Promise<SkillResult>;
  getConversation(input: GetConversationInput): Promise<Conversation>;
  getMemory(input: GetMemoryInput): Promise<MemoryContext>;
  searchKnowledge(input: SearchKnowledgeInput): Promise<RAGContext>;
  qualifyLead(input: QualifyLeadInput): Promise<LeadQualification>;
}
```

### 3.13 Configuration & État global

```typescript
// features/webi/types/config.ts

interface Configuration {
  provider: ProviderConfig;
  models: ModelConfig;
  limits: LimitsConfig;
  features: FeaturesConfig;
  prompts: PromptsConfig;
  env: EnvironmentConfig;
}

interface ProviderConfig {
  defaultProvider: string;
  fallbackProvider: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

interface ModelConfig {
  enabledModels: string[];
  defaultMaxTokens: number;
  defaultTemperature: number;
}

interface LimitsConfig {
  maxMessagesPerConversation: number;
  maxConversationLength: number;
  maxContextTokens: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  maxSkillExecutionTime: number;
}

interface FeaturesConfig {
  streaming: boolean;
  toolCalling: boolean;
  memory: boolean;
  rag: boolean;
  analytics: boolean;
  navigation: boolean;
  feedback: boolean;
}

interface PromptsConfig {
  systemPromptVersion: string;
  maxSystemPromptTokens: number;
  enableDynamicPrompts: boolean;
}

interface EnvironmentConfig {
  nodeEnv: "development" | "staging" | "production";
  logLevel: "debug" | "info" | "warn" | "error";
  enableDebugMode: boolean;
}

// features/webi/types/state.ts

interface AssistantState {
  conversation: ConversationState;
  streaming: StreamingState;
  memory: MemoryContext;
  skills: SkillsState;
  navigation: NavigationState;
  provider: ProviderState;
  lead: LeadState;
  analytics: AnalyticsState;
  ui: UIState;
}

interface ConversationState {
  activeConversationId: string | null;
  messages: ConversationMessage[];
  isProcessing: boolean;
}

interface StreamingState {
  isStreaming: boolean;
  streamingContent: string;
  streamingError: string | null;
}

interface SkillsState {
  activeSkills: string[];
  skillResults: Map<string, SkillResult>;
}

interface NavigationState {
  currentPage: string;
  suggestedActions: NavigationAction[];
}

interface ProviderState {
  activeProvider: string;
  activeModel: string;
  availableProviders: string[];
  isSwitching: boolean;
}

interface LeadState {
  currentLead: Lead | null;
  qualification: LeadQualification | null;
}

interface UIState {
  isTyping: boolean;
  isOpen: boolean;
  minimized: boolean;
  theme: "light" | "dark";
}
```

### 3.14 Sécurité

```typescript
// features/webi/types/security.ts

interface SecurityConfig {
  promptInjection: PromptInjectionProtection;
  validation: ValidationConfig;
  sanitization: SanitizationConfig;
  rateLimiting: RateLimitingConfig;
  xss: XSSProtectionConfig;
  csrf: CSRFProtectionConfig;
  secrets: SecretsManagementConfig;
}

interface PromptInjectionProtection {
  enabled: boolean;
  strategy: "input_validation" | "system_boundary" | "semantic_filter" | "all";
  maxInputLength: number;
  blockedPatterns: RegExp[];
}

interface ValidationConfig {
  schema: Record<string, ZodSchema>;
  strict: boolean;
}

interface SanitizationConfig {
  stripHtml: boolean;
  escapeSpecialChars: boolean;
  maxLength: number;
}

interface RateLimitingConfig {
  enabled: boolean;
  strategy: "token_bucket" | "sliding_window" | "fixed_window";
  maxRequests: number;
  windowMs: number;
  perSession?: boolean;
  perUser?: boolean;
}

interface XSSProtectionConfig {
  enabled: boolean;
  sanitizeInput: boolean;
  sanitizeOutput: boolean;
  allowedTags: string[];
}

interface CSRFProtectionConfig {
  enabled: boolean;
  useDoubleSubmitCookie: boolean;
  tokenExpiry: number;
}

interface SecretsManagementConfig {
  provider: "env" | "vault" | "aws_secrets" | "gcp_secret";
  encryptionAtRest: boolean;
  rotationDays: number;
}
```

---

## 4. Système Providers

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AIProvider (interface)                     │
│  +initialize(config)  +complete(req)  +stream(req)  +abort() │
│  +getModel(id)  +isAvailable()                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          ▼                ▼                ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ NvidiaProvider  │ │OpenAIProvider│ │AnthropicProv.│ │MistralProv.  │
│ (NVIDIA NIM)    │ │ (GPT-4o...)  │ │ (Claude...)  │ │ (Mistral...)  │
└─────────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Règles

1. **Tous les providers implémentent `AIProvider`** — le reste de l'application ne connaît que cette interface.
2. **Le `ProviderRegistry`** découvre, enregistre et sélectionne le provider actif via configuration.
3. **Le changement de provider est transparent** : la `Conversation` appelle `providerRegistry.getActive()` sans savoir quel provider est utilisé.
4. **Le streaming est standardisé** via `AsyncIterable<AIStreamEvent>`, peu importe le format natif du LLM.
5. **L'ajout d'un nouveau provider** = 1 fichier d'implémentation + 1 enregistrement dans le registry. Aucune autre modification.

### Sélection du provider

```typescript
// Logique de sélection (conceptuelle — non implémentée)
// ProviderRegistry.getActive() retourne le provider selon :
// 1. Configuration explicite (defaultProvider dans config)
// 2. Fallback si le provider principal est indisponible
// 3. Modèle demandé (ex: claude-3-opus → AnthropicProvider)
```

---

## 5. Moteur de Skills (Tool Calling)

### Cycle Tool Calling (LLM Natif)

Le moteur de Skills suit le standard **Tool Calling** moderne (OpenAI, Anthropic, etc.) :

```
Utilisateur envoie un message
         │
         ▼
  Conversation.orchestrate()
         │
         ├── 1. Récupérer contexte (Memory)
         ├── 2. Rechercher connaissances (RAG)
         ├── 3. Compiler le prompt
         ├── 4. Envoyer au Provider (avec ToolDefinitions)
         │
         ▼
  LLM répond — soit texte, soit ToolCallRequest
         │
         ├── Texte → Retourner à l'utilisateur
         │
         └── ToolCallRequest → Skill Engine
                  │
                  ├── 5. Registry.find(toolName)
                  ├── 6. Skill.execute(context)
                  ├── 7. ToolCallResponse → LLM
                  │
                  ▼
              LLM formule la réponse finale avec le résultat du tool
                  │
                  ▼
            Retourner à l'utilisateur
```

### Architecture du moteur

```
┌──────────────────────────────────────────┐
│           SkillEngine                     │
│  - executeToolCall(request): Response     │
│  - getToolDefinitions(): ToolDef[]        │
└──────────────────────┬───────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐     ┌────────────────────┐
│  SkillRegistry   │     │  Skill (interface) │
│  - register()    │     │  +toToolDefinition │
│  - get()         │     │  +execute()        │
│  - getAll()      │     └────────────────────┘
└─────────────────┘              │
         │              ┌────────┼────────┬────────┐
         │              ▼        ▼        ▼        ▼
         │        ┌────────┐┌──────┐┌──────┐┌──────────┐
         └────────│auditWeb││audit ││recom ││qualifica │
                  │       ││SEO   ││mend  ││tion      │
                  └────────┘└──────┘└──────┘└──────────┘
```

### Enregistrement automatique

```typescript
// Concept : le registry découvre les Skills automatiquement
// via un pattern de scan ou d'export nommé.
// Les Skills sont dans features/webi/skills/*/index.ts
// Chaque dossier exporte une classe implémentant Skill.

// SkillRegistry.scan() est appelé au démarrage du serveur.
// Il importe dynamiquement les Skills et les enregistre.
```

---

## 6. Système Mémoire

### Niveaux de mémoire

```
Niveau          Durée de vie           Granularité           Responsabilité
──────────────────────────────────────────────────────────────────────────
Conversation    Session (quelques h)   Message individuel     Contexte immédiat
Session         24h                    Événements session     Navigation, état UI
Utilisateur     Permanent              Profil, préférences    Personnalisation
Projet          Durée du projet        Infos projet           Suivi client
Résumé          Permanent              Résumé généré IA       Synthèse longue
Historique      Permanent              Anciennes convers.     Apprentissage
Connaissances   Jusqu'à mise à jour    Documents WebXIA       Base de référence
```

### Architecture

```
┌──────────────────────────────────────────────────┐
│                 MemoryManager                      │
│  - getContext(sessionId): MemoryContext             │
│  - addEntry(type, entry): void                      │
│  - generateSummary(conversationId): void            │
│  - prune(): void                                    │
└──┬───────┬───────┬───────┬───────┬───────┬─────────┘
   │       │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼       ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐
│Conv. ││Sess. ││User  ││Proj. ││Summ. ││History   │
│Store ││Store ││Store ││Store ││Store ││Store     │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────────┘
```

### Injection dans la conversation

À chaque tour, le `MemoryManager` compile le `MemoryContext` et l'injecte dans le prompt système (ou dans un message système dédié). Seuls les niveaux pertinents sont inclus selon la phase de la conversation.

---

## 7. Architecture RAG

### Composants

```
┌────────────────────────────────────────────────────┐
│                    RAGEngine                         │
│  - query(question, options): RAGContext              │
│  - indexDocument(doc): void                          │
│  - updateDocument(doc): void                         │
│  - deleteDocument(id): void                          │
└──┬──────────────┬──────────────┬────────────────────┘
   │              │              │
   ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────────┐
│ Document │ │ Vector   │ │ PromptInjector   │
│ Store    │ │ Store    │ │ - inject(ctx)     │
│ (source) │ │ (index)  │ │ - format(docs)    │
└──────────┘ └──────────┘ └──────────────────┘
```

### Flux

1. **Document Store** : stocke les documents source (pages web, PDF, manuels, FAQ, blog).
2. **Vector Store** : indexe les embeddings des documents. Interface commune (`VectorStore`) pour changer de moteur (Pinecone, pgvector, Qdrant, etc.).
3. **Retrieval** : à chaque question utilisateur, recherche les K documents les plus pertinents par similarité cosinus.
4. **Injection** : les documents retrouvés sont formatés et injectés dans le prompt système sous forme de contexte.

### Stratégies de recherche

```typescript
type RetrievalStrategy = "semantic" | "keyword" | "hybrid" | "rerank";
```

- `semantic` : similarité vectorielle pure
- `keyword` : BM25 / recherche textuelle
- `hybrid` : combinaison pondérée des deux
- `rerank` : recherche initiale + re-ranking avec un modèle dédié

---

## 8. Système de Prompts

### Arborescence

```
features/webi/prompts/
├── system/
│   ├── index.ts              # Prompt système principal (exporté)
│   ├── personality.ts        # Personnalité de Webi
│   ├── rules.ts              # Règles de comportement
│   └── constraints.ts        # Contraintes (ne pas inventer, etc.)
├── conversation/
│   ├── greeting.ts           # Message de bienvenue
│   ├── fallback.ts           # Réponse par défaut
│   └── clarification.ts      # Demande de clarification
├── qualification/
│   ├── questions.ts          # Questions de qualification
│   ├── analysis.ts           # Analyse des réponses
│   └── scoring.ts            # Scoring lead
├── seo/
│   ├── audit.ts              # Prompt d'audit SEO
│   └── recommendations.ts    # Recommandations SEO
├── recommendation/
│   ├── services.ts           # Recommandation services
│   └── cross-sell.ts         # Recommandation croisée
├── skills/
│   ├── audit-website.ts      # Prompt Skill audit site
│   ├── estimate.ts           # Prompt Skill devis
│   └── appointment.ts        # Prompt Skill rendez-vous
└── navigation/
    ├── suggestions.ts        # Suggestions de navigation
    └── contextual.ts         # Navigation contextuelle
```

### Règles de composition

1. Le **Prompt Système** est composé une fois par session (ou au démarrage du serveur).
2. Les **prompts spécialisés** sont chargés dynamiquement selon le contexte (Skill activée, phase de qualification, etc.).
3. Le service `PromptCompiler` assemble les morceaux en un prompt final, en respectant l'ordre : système > contexte mémoire > contexte RAG > messages conversation.
4. Chaque prompt est un **template** avec des variables (délimitées par `{{variable}}`) qui sont substituées à l'exécution.

---

## 9. Configuration centralisée

```
features/webi/config/
├── providers.ts      # Configuration des providers (endpoints, modèles par défaut)
├── models.ts         # Configuration des modèles (capabilities, limites, coûts)
├── limits.ts         # Limites (rate limiting, max tokens, timeouts)
├── features.ts       # Feature flags (streaming, tool calling, RAG, memory, etc.)
├── prompts.ts        # Configuration des prompts (versions, priorités)
└── env.ts            # Variables d'environnement (typées, avec validation Zod)
```

Toutes les constantes sont centralisées ici. Aucune valeur magique (magic number/string) dans le code métier.

---

## 10. Store (Zustand)

### Stores identifiés

| Store               | Responsabilité                                     | Slice          |
| ------------------- | -------------------------------------------------- | -------------- |
| `conversationStore` | Conversation active, messages, traitement en cours | `conversation` |
| `messagesStore`     | Cache des messages, historique visible             | `messages`     |
| `streamingStore`    | État du streaming en cours, contenu partiel        | `streaming`    |
| `memoryStore`       | Contexte mémoire affiché/résumé                    | `memory`       |
| `skillsStore`       | Skills actives, résultats, statuts                 | `skills`       |
| `navigationStore`   | Page courante, suggestions de navigation           | `navigation`   |
| `providerStore`     | Provider actif, modèle, disponibilité              | `provider`     |
| `leadStore`         | Lead courant, qualification                        | `lead`         |
| `analyticsStore`    | Événements en attente d'envoi                      | `analytics`    |
| `uiStore`           | État UI (ouvert/fermé, typing, thème)              | `ui`           |

### Binding avec l'Event Bus

```
[Événement du bus] → [Handler du store] → [React re-rend]
```

Exemple : Quand `StreamChunkReceived` est émis par le serveur, le `streamingStore` met à jour `streamingContent`, et le composant `ChatMessage` se re-rend via le hook Zustand `useStreamingStore`.

---

## 11. Sécurité

### Architecture défensive

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Input       │───▶│  Validation   │───▶│  Sanitisation │───▶│  LLM         │
│  Utilisateur │    │  (Zod)       │    │  (XSS/Injec) │    │  (Provider)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                            │
                            ▼
                     ┌──────────────┐    ┌──────────────┐
                     │  Rate        │    │  Prompt       │
                     │  Limiting    │    │  Boundary     │
                     └──────────────┘    └──────────────┘
```

### Couches de protection

| Couche | Protection                                               | Emplacement                      |
| ------ | -------------------------------------------------------- | -------------------------------- |
| 1      | Validation Zod (schémas stricts)                         | Entrée de chaque Server Function |
| 2      | Sanitisation (strip HTML, escape)                        | Avant envoi au LLM               |
| 3      | Prompt Boundary (séparation système/utilisateur)         | Dans le prompt compilé           |
| 4      | Rate Limiting (par session/IP/utilisateur)               | Middleware serveur               |
| 5      | XSS Protection (sortie encodée)                          | Côté client (React)              |
| 6      | CSRF Protection (tokens)                                 | Server Functions                 |
| 7      | Gestion sécurisée des secrets (jamais exposés au client) | Serveur uniquement               |

---

## 12. Analytics

### Événements

```typescript
type AnalyticsEventType =
  // Conversation
  | "conversation_started" // Nouvelle conversation initiée
  | "message_sent" // Message utilisateur envoyé
  | "message_received" // Réponse LLM reçue
  | "conversation_finished" // Conversation terminée

  // Streaming
  | "streaming_started" // Début du streaming
  | "streaming_chunk" // Chunk reçu (optionnel — volumétrie)
  | "streaming_completed" // Streaming terminé
  | "streaming_error" // Erreur de streaming

  // Skills
  | "skill_invoked" // LLM demande l'exécution d'une Skill
  | "skill_started" // Début d'exécution Skill
  | "skill_completed" // Skill exécutée avec succès
  | "skill_failed" // Échec d'exécution Skill

  // Recommandations
  | "recommendation_generated" // Recommandations produites
  | "recommendation_clicked" // Utilisateur clique sur une reco
  | "recommendation_dismissed" // Utilisateur ignore une reco

  // Navigation
  | "page_opened" // Visiteur arrive sur une page
  | "navigation_suggested" // Webi suggère une navigation
  | "navigation_followed" // Utilisateur suit la suggestion

  // Lead
  | "lead_created" // Nouveau lead identifié
  | "lead_qualified" // Lead qualifié (hot/warm/cold)
  | "lead_converted" // Lead converti (devenir client)

  // Feedback
  | "feedback_positive" // Like / Utile
  | "feedback_negative" // Dislike / Pas utile

  // Technique
  | "error" // Erreur applicative
  | "provider_switched" // Changement de provider
  | "memory_pruned" // Nettoyage mémoire effectué
  | "rag_query"; // Requête RAG effectuée
```

---

## 13. Diagrammes

### 13.1 Architecture globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                      NAVIGATEUR (Client)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     React 19 / TanStack Router                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │Webi UI   │  │Site UI   │  │Hooks     │  │Components    │ │   │
│  │  │(Chat)    │  │(Pages)   │  │(custom)  │  │(shadcn/ui)   │ │   │
│  │  └─────┬────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  │        │                                                     │   │
│  │  ┌─────┴──────────────────────────────────────────────────┐ │   │
│  │  │              Zustand Stores                             │ │   │
│  │  │  conv │ msg │ stream │ memory │ skills │ nav │ lead    │ │   │
│  │  └─────┬──────────────────────────────────────────────────┘ │   │
│  │        │                                                     │   │
│  │  ┌─────┴──────┐  ┌──────────────┐                           │   │
│  │  │Event Bus   │  │Analytics     │                           │   │
│  │  │(souscript.)│  │(tracking)    │                           │   │
│  │  └─────┬──────┘  └──────────────┘                           │   │
│  └────────┼─────────────────────────────────────────────────────┘  │
└───────────┼─────────────────────────────────────────────────────────┘
            │    Server Functions (RPC typé — TanStack Start)
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVEUR (Nitro)                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Conversation Orchestrator                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │Provider  │  │Memory    │  │Skills    │  │RAG           │ │   │
│  │  │Registry  │  │Manager   │  │Engine    │  │Engine        │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │   │
│  │  │Prompts   │  │Knowledge  │  │Event Bus│                   │   │
│  │  │Compiler  │  │Base      │  │(émetteur)│                   │   │
│  │  └──────────┘  └──────────┘  └──────────┘                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Infrastructure                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │NVIDIA    │  │Vector DB │  │Session   │  │Secrets       │ │   │
│  │  │NIM API   │  │(futur)   │  │Storage   │  │Manager       │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Cycle complet d'une conversation (avec Tool Calling)

```
DÉBUT
  │
  ▼
┌──────────────────────────────────────────────┐
│  1. Utilisateur envoie un message             │
│     → Server Function: sendMessage()          │
│     → Validation Zod du message               │
│     → Sanitisation                           │
│     → Émission événement: message_sent        │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  2. Récupération du contexte                  │
│     → MemoryManager.getContext(sessionId)     │
│     → RAGEngine.query(message)                │
│     → PromptCompiler.compile(memory, rag)     │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  3. Envoi au Provider (avec ToolDefinitions)  │
│     → Provider.complete() ou .stream()        │
│     → Émission événement: streaming_started   │
└──────────────────┬───────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌──────────────────┐  ┌──────────────────────────────┐
│ 4a. Réponse      │  │ 4b. ToolCallRequest          │
│     texte        │  │     (LLM veut utiliser une   │
│     ← Provider   │  │      Skill)                  │
└────────┬─────────┘  │     → Émission: skill_started│
         │            └──────────────┬───────────────┘
         │                           │
         │                           ▼
         │            ┌──────────────────────────────┐
         │            │ 5. Exécution de la Skill      │
         │            │     → SkillRegistry.get()     │
         │            │     → Skill.execute(context)  │
         │            │     → Émission: skill_ok/fail │
         │            └──────────────┬───────────────┘
         │                           │
         │                           ▼
         │            ┌──────────────────────────────┐
         │            │ 6. ToolCallResponse → LLM     │
         │            │     → Provider.complete()     │
         │            │     (avec résultat du tool)   │
         │            └──────────────┬───────────────┘
         │                           │
         │                           ▼
         │            ┌──────────────────────────────┐
         │            │ 7. LLM produit réponse finale │
         │            │     (intégrant le résultat)   │
         │            └──────────────┬───────────────┘
         │                           │
         └──────┬────────────────────┘
                ▼
┌──────────────────────────────────────────────┐
│  8. Mise à jour mémoire                       │
│     → MemoryManager.addEntry()                │
│     → MemoryManager.generateSummary() (si     │
│       seuil atteint)                          │
│     → Émission événement: memory_updated       │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  9. Analyse & Actions post-réponse            │
│     → LeadQualification (si nouveau lead)     │
│     → NavigationSuggestion (si pertinent)     │
│     → Analytics.track()                       │
│     → Émission événement: stream_completed    │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│ 10. Diffusion au client                       │
│     → Event Bus → Store → React re-render    │
│     → Affichage du message + suggestions      │
│     → Mise à jour lead/navigation si besoin   │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
                FIN (en attente du prochain message)
```

### 13.3 Architecture des Skills (Tool Calling)

```
┌─────────────────────────────────────────────────────────────┐
│                     LLM (Provider)                           │
│                                                              │
│  Reçoit : messages + ToolDefinitions[]                       │
│  Décide : répondre OU appeler un tool                       │
│                                                              │
│  Si tool : renvoie ToolCallRequest { name, arguments }      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SkillEngine                                │
│                                                              │
│  1. Reçoit le ToolCallRequest                                │
│  2. Registry.find(name) → Skill                             │
│  3. Skill.execute(context)                                   │
│  4. Retourne ToolCallResponse                                │
│  5. Le Provider renvoie au LLM                               │
│                                                              │
│  Flux : LLM → SkillEngine → Skill → LLM → Réponse finale    │
└─────────────────────────────────────────────────────────────┘
```

### 13.4 Architecture des Providers

```
┌─────────────────────────────────────────────────────────────┐
│                    AIProvider (interface)                     │
│                                                              │
│  +initialize(config)    → void                               │
│  +complete(request)     → ProviderResponse                   │
│  +stream(request)       → AsyncIterable<AIStreamEvent>       │
│  +abort()               → void                               │
│  +getModel(id)          → AIModel | undefined                │
│  +isAvailable()         → boolean                            │
│                                                              │
│  Propriétés : id, name, models[]                             │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          ▼                ▼                ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ NvidiaProvider  │ │OpenAIProvider│ │AnthropicProv.│ │MistralProv.  │
│                 │ │              │ │              │ │              │
│ - baseUrl       │ │ - baseUrl    │ │ - baseUrl    │ │ - baseUrl    │
│ - apiKey        │ │ - apiKey     │ │ - apiKey     │ │ - apiKey     │
│ - models:       │ │ - models:    │ │ - models:    │ │ - models:    │
│   nemotron      │ │   gpt-4o     │ │   claude-opus│ │   mistral-lrg│
│   llama-3       │ │   gpt-4o-mini│ │   claude-son.│ │   mistral-med│
│                 │ │              │ │              │ │              │
│ Transforme le   │ │ Adapte le    │ │ Adapte le    │ │ Adapte le    │
│ format NVIDIA   │ │ format OpenAI│ │ format Anth. │ │ format Mist. │
│ en AIStreamEvent│ │ → AIStream   │ │ → AIStream   │ │ → AIStream   │
└─────────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 13.5 Architecture Mémoire

```
┌─────────────────────────────────────────────────────────────┐
│                      MemoryManager                           │
│                                                              │
│  - getContext(sessionId) → MemoryContext                    │
│  - addEntry(type, entry) → void                              │
│  - generateSummary(convId) → ConversationSummary            │
│  - prune() → void                                            │
│                                                              │
│  Compile le contexte à chaque tour :                         │
│    Contexte = {                                              │
│      conversation: messages récents (n derniers)             │
│      session: page, durée, compteurs                         │
│      user: profil si identifié                               │
│      project: infos projet si en cours                       │
│      summaries: résumés des conversations passées            │
│      history: anciens échanges pertinents                    │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          ▼                ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Conversation │  │   Session    │  │    User      │  │   Project    │
│   Memory     │  │   Memory     │  │   Memory     │  │   Memory     │
│              │  │              │  │              │  │              │
│ - Derniers N │  │ - SessionId  │  │ - UserId     │  │ - ProjectId  │
│   messages   │  │ - Start/End  │  │ - Profil     │  │ - Type       │
│ - Résumé     │  │ - Pages vues │  │ - Préférences│  │ - Status     │
│ - Topics     │  │ - Compteurs  │  │ - Historique │  │ - Budget     │
│              │  │              │  │              │  │              │
│ TTL: session │  │ TTL: 24h    │  │ TTL: perm.   │  │ TTL: projet  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 13.6 Architecture RAG

```
┌─────────────────────────────────────────────────────────────┐
│                        RAGEngine                             │
│                                                              │
│  - query(question): ScoredDocument[]                         │
│  - indexDocument(doc): void                                  │
│  - updateDocument(doc): void                                 │
│  - deleteDocument(id): void                                  │
│  - refreshIndex(): void                                      │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Document    │  │   Vector     │  │   Prompt     │
│   Store      │  │   Store      │  │   Injector   │
│              │  │              │  │              │
│ - Pages web  │  │ - Embeddings │  │ - Formate    │
│ - PDF        │  │ - Index      │  │   documents  │
│ - FAQ        │  │ - Recherche  │  │   en contexte│
│ - Blog       │  │   sémantique │  │ - Injection  │
│ - Case study │  │              │  │   dans prompt │
│              │  │              │  │              │
│ Interface    │  │ Interface    │  │ Sortie :     │
│ commune      │  │ commune      │  │ RAGContext   │
│ d'accès      │  │ (Pinecone,   │  │              │
│ aux docs     │  │  pgvector    │  │              │
│              │  │  Qdrant...)  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 13.7 Flux Event Bus

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Serveur   │    │ Event Bus │    │  Store    │    │    UI     │
│ (Service) │    │  (PubSub) │    │ (Zustand) │    │ (React)   │
└─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
      │                │                │                │
      │─── emit() ────▶│                │                │
      │   (ex:         │                │                │
      │    StreamChunk)│                │                │
      │                │─── on() ──────▶│                │
      │                │   (handler)    │                │
      │                │                │─── state ────▶│
      │                │                │   (reactive)  │
      │                │                │                │
      │                │                │                │─── render ──▶
      │                │                │                │
```

---

## 14. Décisions d'architecture

### ADR-006 : Feature First

**Statut** : Accepté  
**Raison** : La feature `webi` est autonome. Tous ses fichiers (composants, hooks, services, types, configurations) sont regroupés. Cela permet de développer, tester et déployer Webi indépendamment du reste du site.

### ADR-007 : Clean Architecture

**Statut** : Accepté  
**Raison** : Séparation stricte en couches : Entities (types) → Use Cases (services) → Infrastructure (providers, RAG) → UI. Les dépendances pointent vers l'intérieur. Les providers et la BDD sont des détails interchangeables.

### ADR-008 : Providers interchangeables via interface

**Statut** : Accepté  
**Raison** : `AIProvider` est une interface. Le `ProviderRegistry` masque l'implémentation concrète. Changer de LLM (NVIDIA → OpenAI) ne modifie que la configuration `defaultProvider`, aucun code métier.

### ADR-009 : Skills en architecture plugin

**Statut** : Accepté  
**Raison** : Chaque Skill est une classe autonome qui implémente `Skill`. Le `SkillRegistry` découvre et enregistre automatiquement. Ajouter une Skill = créer un dossier + une classe. Le moteur (`SkillEngine`) ne change pas.

### ADR-010 : Event Bus pour découpler UI et services

**Statut** : Accepté  
**Raison** : Les services IA (streaming, skills, mémoire) émettent des événements. L'UI s'abonne via le Store Zustand. Pas de couplage direct. L'Event Bus fonctionne côté serveur (émission) et côté client (souscription).

### ADR-011 : Zustand pour le store client

**Statut** : Accepté  
**Raison** : Zustand est léger, TypeScript-first, sans boilerplate, compatible React 19. Pas de Provider wrapper nécessaire. Idéal pour une architecture à stores multiples découplés.

### ADR-012 : TanStack Start Server Functions

**Statut** : Accepté  
**Raison** : Les Server Functions offrent un RPC typé entre le client et le serveur. Toute la logique IA (providers, skills, RAG) reste côté serveur. Jamais exposée au client. Sécurité et secret management naturels.

### ADR-013 : Mémoire multi-niveaux

**Statut** : Accepté  
**Raison** : Chaque niveau de mémoire (conversation, session, utilisateur, projet) a une durée de vie et une granularité différentes. Le `MemoryManager` compile le contexte pertinent à chaque tour sans surcharger le LLM.

### ADR-014 : RAG via interface vectorielle

**Statut** : Accepté  
**Raison** : L'interface `VectorStore` permet de changer de moteur vectoriel (Pinecone, pgvector, Qdrant) sans modifier le `RAGEngine`. Le choix du moteur est une décision d'infrastructure.

### ADR-015 : Prompts isolés par domaine

**Statut** : Accepté  
**Raison** : Chaque prompt est un fichier indépendant. Le prompt système global est totalement séparé des prompts spécialisés (qualification, SEO, skills). Modification et versioning facilités.

### ADR-016 : Pas de dépendance circulaire

**Statut** : Accepté  
**Raison** : Le graphe de dépendance est orienté. Conversation dépend de Provider, Memory, Skills, RAG, Prompts. Ces modules ne dépendent pas de Conversation. L'Event Bus permet des communications indirectes sans cycle.

### ADR-017 : Validation Zod à toutes les entrées

**Statut** : Accepté  
**Raison** : Chaque Server Function valide ses entrées avec un schéma Zod. Protection contre les injections, les malformations et les données invalides. Premier niveau de défense.

### ADR-018 : Analytics événementiels côté client

**Statut** : Accepté  
**Raison** : Les analytics sont collectées côté client et envoyées à un service externe. Les événements peuvent être émis depuis le serveur via l'Event Bus et relayés au tracker client.

---

## 15. Roadmap technique

### Sprint 1 — Fondations (prochain sprint)

- [ ] Créer l'arborescence `features/webi/` (dossiers vides)
- [ ] Implémenter les types et interfaces TypeScript
- [ ] Implémenter la configuration centralisée (`config/`)
- [ ] Implémenter les schémas Zod
- [ ] Implémenter l'Event Bus
- [ ] Implémenter le Store Zustand (squelette)
- [ ] Implémenter le `ProviderRegistry` avec l'interface `AIProvider`
- [ ] Implémenter `NvidiaProvider` (NVIDIA NIM API)

### Sprint 2 — Cœur conversationnel

- [ ] Implémenter la gestion de prompts (`prompts/system/`)
- [ ] Implémenter le service de conversation (envoi, réception, orchestration)
- [ ] Implémenter le streaming (serveur → client via Server Functions)
- [ ] Connecter le streaming au Store Zustand
- [ ] Créer les composants UI de base du chat

### Sprint 3 — Mémoire & Contexte

- [ ] Implémenter `MemoryManager` (conversation + session)
- [ ] Implémenter la persistance session (sessionStorage/cookie)
- [ ] Implémenter la génération de résumés
- [ ] Implémenter l'injection du contexte mémoire dans les prompts
- [ ] UI : affichage du contexte, historique

### Sprint 4 — Skills

- [ ] Implémenter `SkillRegistry` (découverte automatique)
- [ ] Implémenter `SkillEngine` (orchestration Tool Calling)
- [ ] Implémenter les Skills prioritaires : qualification + recommandation
- [ ] UI : affichage des résultats de Skills

### Sprint 5 — RAG & Connaissances

- [ ] Implémenter `DocumentStore`
- [ ] Implémenter `VectorStore` (interface + adaptateur)
- [ ] Implémenter `RAGEngine` (query, retrieve, inject)
- [ ] Implémenter `KnowledgeBase` (documents WebXIA)
- [ ] UI : citations, sources affichées

### Sprint 6 — Lead & Analytics

- [ ] Implémenter la qualification de leads
- [ ] Implémenter le système d'analytics
- [ ] Implémenter les événements de tracking
- [ ] UI : formulaire lead, notifications

### Sprint 7 — Navigation & Expérience

- [ ] Implémenter `NavigationEngine` (suggestions contextuelles)
- [ ] Intégrer la navigation aux routes TanStack Router
- [ ] UI : suggestions de navigation, boutons d'action
- [ ] Polir l'expérience (typing indicator, animations Framer Motion)

### Sprint 8 — Sécurité & Robustesse

- [ ] Implémenter la validation Zod sur toutes les entrées
- [ ] Implémenter le rate limiting
- [ ] Implémenter la sanitisation XSS
- [ ] Implémenter la protection Prompt Injection
- [ ] Tests de sécurité et de robustesse

### Futur (post-Sprint 8)

- [ ] Nouveaux providers (OpenAI, Anthropic, Mistral, Gemini)
- [ ] Nouvelles Skills (audit site, audit SEO, devis, cahier des charges, rendez-vous)
- [ ] Voix (Web Speech API → STT/TTS)
- [ ] Partage de fichiers (analyse de documents)
- [ ] Connexion CRM (HubSpot, Salesforce)
- [ ] Canaux supplémentaires (WhatsApp, Telegram, Messenger)
- [ ] Mode SaaS multi-clients
- [ ] Dashboard analytics Webi

---

## Vérifications finales

| Critère                                       | Statut | Justification                                          |
| --------------------------------------------- | ------ | ------------------------------------------------------ |
| Aucun module à plusieurs responsabilités      | ✅     | Chaque module a une responsabilité unique (section 2)  |
| Aucune dépendance circulaire                  | ✅     | Graphe orienté acyclique (section 2)                   |
| Ajout d'un Provider sans modification majeure | ✅     | Nouveau fichier + enregistrement registry (section 4)  |
| Ajout d'une Skill sans modification du moteur | ✅     | Nouveau dossier + classe Skill (section 5)             |
| Évolutivité vers SaaS multi-clients           | ✅     | Architecture client/serveur, store découplé, Event Bus |
| Ajout futur voix, fichiers, CRM, WhatsApp     | ✅     | Architecture feature, providers, skills extensibles    |

---

_Document généré dans le cadre du Sprint 0 — Conception & Architecture de Webi_  
_Aucune implémentation métier dans ce document._  
_Ce document sert de référence pour tous les Sprints à venir._
