import { AgentLimits, DEFAULT_AGENT_LIMITS } from "../contracts";

export interface AgentConfig {
  limits: AgentLimits;
  systemPrompt: string;
  defaultModel: string;
  enableStreaming: boolean;
}

export function createAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    limits: { ...DEFAULT_AGENT_LIMITS, ...overrides.limits },
    systemPrompt: overrides.systemPrompt ?? "",
    defaultModel: overrides.defaultModel ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    enableStreaming: overrides.enableStreaming ?? true,
  };
}

export function validateLimits(limits: Partial<AgentLimits>): AgentLimits {
  const validated: AgentLimits = { ...DEFAULT_AGENT_LIMITS };

  if (limits.maxAgentSteps !== undefined) {
    validated.maxAgentSteps = Math.min(50, Math.max(1, limits.maxAgentSteps));
  }
  if (limits.maxToolCalls !== undefined) {
    validated.maxToolCalls = Math.min(20, Math.max(1, limits.maxToolCalls));
  }
  if (limits.globalTimeoutMs !== undefined) {
    validated.globalTimeoutMs = Math.min(300000, Math.max(5000, limits.globalTimeoutMs));
  }
  if (limits.maxContextTokens !== undefined) {
    validated.maxContextTokens = Math.min(200000, Math.max(1000, limits.maxContextTokens));
  }
  if (limits.maxToolResultTokens !== undefined) {
    validated.maxToolResultTokens = Math.min(50000, Math.max(500, limits.maxToolResultTokens));
  }

  return validated;
}
