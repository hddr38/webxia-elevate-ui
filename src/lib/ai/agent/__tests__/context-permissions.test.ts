import { describe, it, expect, vi, afterEach } from "vitest";
import { buildAgentContext } from "../context-builder";
import { skillRegistry, registerSkill, unregisterSkill } from "../../skills/registry";
import { SkillExecutor } from "../../skills/executor";
import type { Skill, SkillContext, SkillInput, ToolPermission } from "../../skills/types";
import type { RAGEngine } from "../../rag";

/**
 * Filtrage des tools par permissions dans le contexte agent.
 *
 * Contexte : `buildAgentContext()` calcule `isAuthenticated` mais ne filtre
 * pas `availableTools` (tout sauf `search_knowledge` est exposé, y compris
 * aux anonymes). L'exécution reste gatée par `SkillExecutor.checkPermissions`.
 * Voir revue D/orchestrateur. Aucun correctif appliqué ici.
 */

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({})),
}));

const registered: string[] = [];

afterEach(() => {
  for (const name of registered.splice(0)) {
    if (skillRegistry.has(name)) unregisterSkill(name);
  }
});

function makeTempSkill(name: string, permissions: ToolPermission[]): Skill {
  return {
    name,
    description: `Temporary test skill ${name}`,
    schema: { type: "object", properties: {} },
    permissions,
    toToolDefinition: () => ({
      type: "function",
      function: { name, description: "", parameters: {} },
    }),
    validate: (input: unknown): SkillInput => input as SkillInput,
    execute: vi.fn().mockResolvedValue({ success: true, data: {} }),
  };
}

function registerTempSkill(name: string, permissions: ToolPermission[]): void {
  registerSkill(makeTempSkill(name, permissions));
  registered.push(name);
}

function createMockRAGEngine(): RAGEngine {
  return {
    getEmbeddingProvider: () => ({ embed: vi.fn().mockResolvedValue([]) }),
    query: vi.fn().mockResolvedValue(null),
    buildKnowledgeContext: vi.fn().mockReturnValue({
      chunks: [],
      count: 0,
      topScore: 0,
      contextString: "",
      truncated: false,
    }),
  } as unknown as RAGEngine;
}

function baseOptions(userId?: string) {
  return {
    conversationId: "conv-1",
    sessionId: "session-1",
    userId,
    locale: "fr",
    requestId: "req-1",
    userMessage: "Bonjour",
    ragEngine: createMockRAGEngine(),
    conversationHistory: [],
  };
}

function toolNames(tools: { function: { name: string } }[]): string[] {
  return tools.map((t) => t.function.name);
}

function makeSkillContext(): SkillContext {
  return {
    conversationId: "conv-1",
    sessionId: "session-1",
    userId: undefined,
    locale: "fr",
    requestId: "req-1",
  };
}

describe("context tool permissions", () => {
  it("cas 1 — skills publiques visibles pour anonyme et authentifié", async () => {
    registerTempSkill("perm-public-tmp", ["public"]);

    const anonymous = await buildAgentContext(baseOptions(undefined));
    const authenticated = await buildAgentContext(baseOptions("user-1"));

    expect(toolNames(anonymous.availableTools)).toContain("perm-public-tmp");
    expect(toolNames(authenticated.availableTools)).toContain("perm-public-tmp");
  });

  it("cas 2 — skill authenticated absente pour un anonyme, visible authentifié", async () => {
    registerTempSkill("perm-auth-tmp-b", ["authenticated"]);

    const anonymous = await buildAgentContext(baseOptions(undefined));
    const authenticated = await buildAgentContext(baseOptions("user-1"));

    expect(toolNames(anonymous.availableTools)).not.toContain("perm-auth-tmp-b");
    expect(toolNames(authenticated.availableTools)).toContain("perm-auth-tmp-b");
  });

  it("cas 3 — skill admin absente pour anonyme et non-admin (fail closed)", async () => {
    // `isAdmin` n'est pas transmis à `buildAgentContext` (l'orchestrateur
    // ne le fait pas suivre) : les skills admin sont masquées pour tous
    // ici. L'exécution reste gatée par `SkillExecutor.checkPermissions`.
    registerTempSkill("perm-admin-tmp-b", ["admin"]);

    const anonymous = await buildAgentContext(baseOptions(undefined));
    const authenticated = await buildAgentContext(baseOptions("user-1"));

    expect(toolNames(anonymous.availableTools)).not.toContain("perm-admin-tmp-b");
    expect(toolNames(authenticated.availableTools)).not.toContain("perm-admin-tmp-b");
  });

  it.todo("cas 3c — skill admin visible pour un admin (nécessite isAdmin dans buildAgentContext)");

  it("cas 4 — l'exécution directe d'une skill non autorisée reste rejetée", async () => {
    // Protection d'exécution intacte avant comme après le correctif de liste.
    registerTempSkill("perm-admin-exec-tmp", ["admin"]);
    registerTempSkill("perm-public-exec-tmp", ["public"]);
    const executor = new SkillExecutor();

    const denied = await executor.execute("perm-admin-exec-tmp", makeSkillContext(), {});
    expect(denied.result.success).toBe(false);
    expect(denied.result.error).toContain("admin");
    expect(denied.result.metadata).toMatchObject({ errorCode: "UNAUTHORIZED" });

    const ok = await executor.execute("perm-public-exec-tmp", makeSkillContext(), {});
    expect(ok.result.success).toBe(true);
  });
});
