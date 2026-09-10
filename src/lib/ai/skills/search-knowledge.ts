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
import { RAGEngine } from "../rag";
import type { DocumentMetadata } from "../contracts";
import { createSkillSchema } from "./validator";

export interface SearchKnowledgeInput extends SkillInput {
  query: string;
  topK?: number;
  similarityThreshold?: number;
  filters?: Record<string, unknown>;
}

export interface SearchKnowledgeOutput extends SkillOutput {
  results: SearchKnowledgeResult[];
  query: string;
  totalFound: number;
}

export interface SearchKnowledgeResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata: DocumentMetadata;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
}

export class SearchKnowledgeSkill implements Skill<SearchKnowledgeInput, SearchKnowledgeOutput> {
  /**
   * OFF THE WEBI CHAT PATH (Prompt 3B decision): per-turn automatic
   * retrieval injects KNOWLEDGE directly into the agent context, so this
   * skill is never offered as a chat tool (see CHAT_EXCLUDED_TOOLS in the
   * agent context-builder). Kept for future admin/agent use.
   */
  readonly name = "search_knowledge";
  readonly description =
    "Search the knowledge base for relevant information. Use this when you need to find specific information about WebXIA services, pricing, portfolio, or company information.";
  readonly permissions: ToolPermission[] = ["public"];

  readonly schema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant knowledge",
      },
      topK: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
        minimum: 1,
        maximum: 20,
        default: 5,
      },
      similarityThreshold: {
        type: "number",
        description: "Minimum similarity score (0-1) for results (default: 0.7)",
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
      filters: {
        type: "object",
        description: "Optional metadata filters (e.g., locale, tags)",
        additionalProperties: true,
      },
    },
    required: ["query"],
  } as const;

  readonly metadata = {
    category: "knowledge",
    tags: ["search", "rag", "knowledge-base"],
    version: "1.0.0",
    description: "Semantic search over WebXIA knowledge base",
  };

  private ragEngine: RAGEngine;

  constructor(ragEngine: RAGEngine) {
    this.ragEngine = ragEngine;
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

  validate(input: unknown): SearchKnowledgeInput {
    const schema = z.object({
      query: z.string().min(1).max(500),
      topK: z.number().int().min(1).max(20).optional().default(5),
      similarityThreshold: z.number().min(0).max(1).optional().default(0.7),
      filters: z.record(z.unknown()).optional(),
    });
    return schema.parse(input);
  }

  async execute(
    context: SkillContext,
    options: SearchKnowledgeInput,
  ): Promise<SkillResult<SearchKnowledgeOutput>> {
    try {
      const ragResult = await this.ragEngine.query(options.query, {
        topK: options.topK ?? 5,
        similarityThreshold: options.similarityThreshold ?? 0.7,
        metadataFilters: options.filters,
        sessionId: context.sessionId,
        userId: context.userId,
      });

      const results: SearchKnowledgeResult[] = ragResult.retrieveResult.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        source: this.formatSource(doc.source),
        score: doc.score,
        metadata: doc.metadata,
        documentId: doc.documentId,
        chunkId: doc.chunkId,
        chunkIndex: doc.chunkIndex,
      }));

      return {
        success: true,
        data: {
          results,
          query: options.query,
          totalFound: ragResult.retrieveResult.totalFound,
        },
        citations: results.map((r) => ({
          source: r.source,
          excerpt: r.content.slice(0, 200),
          relevance: r.score,
          documentId: r.documentId,
          chunkId: r.chunkId,
        })),
        followUp:
          results.length > 0
            ? `Found ${results.length} relevant documents. You can ask for more details on any specific topic.`
            : "No relevant information found. Try rephrasing your query or asking about a different topic.",
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Search failed",
          recoverable: true,
        },
      };
    }
  }

  private formatSource(source: { type: string; url?: string; path?: string }): string {
    const parts = [source.type];
    if (source.url) parts.push(source.url);
    if (source.path) parts.push(source.path);
    return parts.join(" | ");
  }
}

export function createSearchKnowledgeSkill(ragEngine: RAGEngine): SearchKnowledgeSkill {
  return new SearchKnowledgeSkill(ragEngine);
}
