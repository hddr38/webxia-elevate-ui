import type { ScoredDocument, DocumentSource, RAGContext, RetrievalStrategy } from "../contracts";
import type { RetrieveResult } from "./retriever";

export interface ContextBuilderOptions {
  maxContextTokens?: number;
  maxDocuments?: number;
  includeScore?: boolean;
  includeSource?: boolean;
  template?: string;
}

const DEFAULT_OPTIONS: Required<ContextBuilderOptions> = {
  maxContextTokens: 4000,
  maxDocuments: 5,
  includeScore: true,
  includeSource: true,
  template:
    "[DOCUMENT {index}]\nTitle: {title}\nSource: {source}\nScore: {score}\nContent: {content}\n",
};

export class ContextBuilder {
  private options: Required<ContextBuilderOptions>;

  constructor(options: ContextBuilderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  buildContext(retrieveResult: RetrieveResult): RAGContext {
    const { documents, strategy } = retrieveResult;

    const limitedDocs = documents.slice(0, this.options.maxDocuments);

    const formattedDocs = limitedDocs.map((doc, index) => {
      let formatted = this.options.template
        .replace("{index}", String(index + 1))
        .replace("{title}", doc.title)
        .replace("{source}", this.formatSource(doc.source))
        .replace("{score}", this.options.includeScore ? doc.score.toFixed(3) : "")
        .replace("{content}", doc.content);

      if (!this.options.includeSource) {
        formatted = formatted.replace(`Source: ${this.formatSource(doc.source)}\n`, "");
      }
      if (!this.options.includeScore) {
        formatted = formatted.replace(`Score: ${doc.score.toFixed(3)}\n`, "");
      }

      return formatted.trim();
    });

    const fullContext = formattedDocs.join("\n---\n");

    const estimatedTokens = this.estimateTokens(fullContext);
    let finalContext = fullContext;

    if (estimatedTokens > this.options.maxContextTokens) {
      finalContext = this.truncateToTokenLimit(fullContext, this.options.maxContextTokens);
    }

    return {
      documents: limitedDocs,
      query: retrieveResult.query,
      strategy,
    };
  }

  buildContextString(retrieveResult: RetrieveResult): string {
    const { documents } = retrieveResult;
    const limitedDocs = documents.slice(0, this.options.maxDocuments);

    const formattedDocs = limitedDocs.map((doc, index) => {
      let formatted = this.options.template
        .replace("{index}", String(index + 1))
        .replace("{title}", doc.title)
        .replace("{source}", this.formatSource(doc.source))
        .replace("{score}", this.options.includeScore ? doc.score.toFixed(3) : "")
        .replace("{content}", doc.content);

      if (!this.options.includeSource) {
        formatted = formatted.replace(`Source: ${this.formatSource(doc.source)}\n`, "");
      }
      if (!this.options.includeScore) {
        formatted = formatted.replace(`Score: ${doc.score.toFixed(3)}\n`, "");
      }

      return formatted.trim();
    });

    return formattedDocs.join("\n---\n");
  }

  private formatSource(source: DocumentSource): string {
    const parts: string[] = [source.type];
    if (source.url) parts.push(`URL: ${source.url}`);
    if (source.path) parts.push(`Path: ${source.path}`);
    if (source.version) parts.push(`v${source.version}`);
    return parts.join(" | ");
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;

    const truncated = text.slice(0, maxChars);
    const lastSeparator = truncated.lastIndexOf("\n---\n");
    return lastSeparator > maxChars * 0.5
      ? truncated.slice(0, lastSeparator)
      : truncated.slice(0, maxChars) + "\n[TRUNCATED]";
  }

  setOptions(options: Partial<ContextBuilderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): Required<ContextBuilderOptions> {
    return { ...this.options };
  }
}
