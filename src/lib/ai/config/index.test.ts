import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAIConfig } from "./index";

/**
 * LOT 20 — model mapping coherence:
 * primary = nano-omni (multimodal, prepares voice/image inputs),
 * fallback = lightning (latency-optimized). AI_FALLBACK_MODEL is no
 * longer read — NVIDIA_NIM_FALLBACK_MODEL is the single source.
 */

const ENV_KEYS = [
  "NVIDIA_NIM_API_KEY",
  "NVIDIA_NIM_DEFAULT_MODEL",
  "NVIDIA_NIM_FALLBACK_MODEL",
  "AI_FALLBACK_MODEL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NVIDIA_NIM_API_KEY = "test-key";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

describe("getAIConfig — chat model mapping (LOT 20)", () => {
  it("uses NVIDIA_NIM_DEFAULT_MODEL when defined", () => {
    process.env.NVIDIA_NIM_DEFAULT_MODEL = "custom/primary-model";
    expect(getAIConfig().nvidia.defaultModel).toBe("custom/primary-model");
  });

  it("defaults primary to nano-omni when NVIDIA_NIM_DEFAULT_MODEL is absent", () => {
    expect(getAIConfig().nvidia.defaultModel).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
  });

  it("uses NVIDIA_NIM_FALLBACK_MODEL when defined", () => {
    process.env.NVIDIA_NIM_FALLBACK_MODEL = "custom/fallback-model";
    expect(getAIConfig().fallback?.model).toBe("custom/fallback-model");
  });

  it("defaults fallback to lightning when NVIDIA_NIM_FALLBACK_MODEL is absent", () => {
    expect(getAIConfig().fallback?.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });

  it("ignores AI_FALLBACK_MODEL (no longer read)", () => {
    process.env.AI_FALLBACK_MODEL = "deprecated/should-be-ignored";
    expect(getAIConfig().fallback?.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });
});
