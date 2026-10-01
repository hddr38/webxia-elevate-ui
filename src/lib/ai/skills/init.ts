import { registerSkill, skillRegistry } from "./registry";
import { createSaveLeadSkill } from "./save-lead";
import { createSummarizeSkill } from "./summarize";
import { createSearchKnowledgeSkill } from "./search-knowledge";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LLMProvider } from "../providers";
import type { RAGEngine } from "../rag";

let skillsInitialized = false;

export function initializeSkills(
  llmProvider: LLMProvider,
  defaultModel: string,
  ragEngine: RAGEngine,
): void {
  if (skillsInitialized) return;

  // SaveLeadSkill - only needs getSupabaseAdmin (singleton)
  registerSkill(createSaveLeadSkill(() => getSupabaseAdmin()));

  // SummarizeSkill - needs LLMProvider
  registerSkill(createSummarizeSkill(llmProvider, defaultModel));

  // SearchKnowledgeSkill - needs RAGEngine
  registerSkill(createSearchKnowledgeSkill(ragEngine));

  skillsInitialized = true;
}

export function resetSkillsForTesting(): void {
  skillRegistry.clear();
  skillsInitialized = false;
}
