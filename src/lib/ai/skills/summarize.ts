import { z } from "zod";
import {
  Skill,
  SkillContext,
  SkillResult,
  SkillInput,
  SkillOutput,
  ToolDefinition,
  ToolPermission,
} from "./types";
import { LLMProvider } from "../providers";
import { createSkillSchema } from "./validator";

export interface SummarizeInput extends SkillInput {
  text: string;
  maxLength?: number;
  style?: "concise" | "detailed" | "bullet-points";
  focus?: string;
}

export interface SummarizeOutput extends SkillOutput {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
}

export class SummarizeSkill implements Skill<SummarizeInput, SummarizeOutput> {
  readonly name = "summarize";
  readonly description =
    "Summarize long text content. Useful for condensing articles, documents, or conversation history. Supports different styles: concise, detailed, or bullet-points.";
  readonly permissions: ToolPermission[] = ["public"];

  readonly schema = {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text content to summarize",
      },
      maxLength: {
        type: "number",
        description: "Maximum length of summary in characters (default: 500)",
        minimum: 50,
        maximum: 2000,
        default: 500,
      },
      style: {
        type: "string",
        enum: ["concise", "detailed", "bullet-points"],
        description: "Summary style (default: concise)",
        default: "concise",
      },
      focus: {
        type: "string",
        description: "Optional focus area for the summary (e.g., 'pricing', 'technical details')",
      },
    },
    required: ["text"],
  } as const;

  readonly metadata = {
    category: "utility",
    tags: ["summarize", "text-processing", "llm"],
    version: "1.0.0",
    description: "LLM-based text summarization with configurable style",
  };

  private llmProvider: LLMProvider;
  private defaultModel: string;

  constructor(llmProvider: LLMProvider, defaultModel: string) {
    this.llmProvider = llmProvider;
    this.defaultModel = defaultModel;
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.schema,
      },
    };
  }

  validate(input: unknown): SummarizeInput {
    const schema = z.object({
      text: z.string().min(1).max(50000),
      maxLength: z.number().int().min(50).max(2000).optional().default(500),
      style: z.enum(["concise", "detailed", "bullet-points"]).optional().default("concise"),
      focus: z.string().max(100).optional(),
    });
    return schema.parse(input);
  }

  async execute(
    context: SkillContext,
    options: SummarizeInput,
  ): Promise<SkillResult<SummarizeOutput>> {
    try {
      const systemPrompt = this.buildSystemPrompt(options.style ?? "concise", options.focus);
      const userPrompt = `Please summarize the following text:\n\n${options.text}`;

      const response = await this.llmProvider.complete({
        model: this.defaultModel,
        messages: [
          { id: "sys", role: "system", content: systemPrompt, timestamp: Date.now() },
          { id: "user", role: "user", content: userPrompt, timestamp: Date.now() },
        ],
        temperature: 0.3,
        maxTokens: options.maxLength,
      });

      const summary = response.content.trim();
      const originalLength = options.text.length;
      const summaryLength = summary.length;

      return {
        success: true,
        data: {
          summary,
          originalLength,
          summaryLength,
          compressionRatio: Math.round((summaryLength / originalLength) * 100) / 100,
        },
        followUp: "Summary complete. Let me know if you need a different style or focus.",
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Summarization failed",
          recoverable: true,
        },
      };
    }
  }

  private buildSystemPrompt(style: string, focus?: string): string {
    const styleInstructions = {
      concise: "Provide a brief, concise summary capturing only the most essential points.",
      detailed: "Provide a comprehensive summary covering all key points and important details.",
      "bullet-points": "Provide a summary as clear bullet points, each capturing a key idea.",
    };

    let prompt = `You are a professional summarizer. ${styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.concise}`;

    if (focus) {
      prompt += `\nFocus particularly on: ${focus}`;
    }

    prompt += "\n\nOutput only the summary, no additional commentary.";

    return prompt;
  }
}

export function createSummarizeSkill(
  llmProvider: LLMProvider,
  defaultModel: string,
): SummarizeSkill {
  return new SummarizeSkill(llmProvider, defaultModel);
}
