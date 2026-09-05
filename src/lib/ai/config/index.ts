export interface AIConfig {
  nvidia: {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
  };
  fallback?: {
    enabled: boolean;
    provider: string;
    model: string;
  };
  limits: {
    timeoutMs: number;
    maxRetries: number;
    maxTokens: number;
  };
}

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env && key in process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }
  return undefined;
}

export function getAIConfig(): AIConfig {
  const apiKey = getEnv("NVIDIA_NIM_API_KEY");
  const baseUrl = getEnv("NVIDIA_NIM_BASE_URL") ?? "https://integrate.api.nvidia.com/v1";

  if (!apiKey) {
    throw new Error("NVIDIA_NIM_API_KEY is required but not set");
  }

  return {
    nvidia: {
      apiKey,
      baseUrl,
      defaultModel: getEnv("NVIDIA_NIM_DEFAULT_MODEL") ?? "nemotron-3-ultra",
    },
    fallback: {
      enabled: getEnv("AI_FALLBACK_ENABLED") === "true",
      provider: getEnv("AI_FALLBACK_PROVIDER") ?? "nvidia",
      model: getEnv("AI_FALLBACK_MODEL") ?? "llama-3.1-70b-instruct",
    },
    limits: {
      timeoutMs: parseInt(getEnv("AI_TIMEOUT_MS") ?? "120000", 10),
      maxRetries: parseInt(getEnv("AI_MAX_RETRIES") ?? "2", 10),
      maxTokens: parseInt(getEnv("AI_MAX_TOKENS") ?? "4096", 10),
    },
  };
}

export function createProviderConfigs(
  config: AIConfig,
): Record<string, { apiKey: string; baseUrl: string; timeout: number; maxRetries: number }> {
  return {
    nvidia: {
      apiKey: config.nvidia.apiKey,
      baseUrl: config.nvidia.baseUrl,
      timeout: config.limits.timeoutMs,
      maxRetries: config.limits.maxRetries,
    },
  };
}
