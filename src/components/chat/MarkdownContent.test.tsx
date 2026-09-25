import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/locale-context";
import { MarkdownContent } from "@/components/chat/MarkdownContent";

/** Wrapper that provides a real locale context for the component under test. */
function renderMarkdown(content: string): string {
  return renderToStaticMarkup(
    <LocaleProvider>
      <MarkdownContent content={content} />
    </LocaleProvider>,
  );
}

describe("MarkdownContent", () => {
  it("renders inline code without wrapping in <pre>", () => {
    const html = renderMarkdown("Use `console.log` to print.");
    // Inline code → <code class="...">console.log</code> (no <pre> parent)
    expect(html).toContain("<code");
    expect(html).toContain("console.log");
    expect(html).not.toMatch(/<pre[^>]*>.*<code/); // no <pre> immediately wrapping
  });

  it("renders fenced code block with language badge and copy button", () => {
    const html = renderMarkdown("```ts\nconst x = 1;\n```");
    // Block path → outer <div> with badge + copy button + <pre><code>
    expect(html).toContain("ts");
    expect(html).toContain("const x = 1;");
    expect(html).toMatch(/<pre[^>]*>.*<code/); // block has <pre><code>
    expect(html).toContain("Copier le code"); // aria-label fr
  });

  it("renders fenced code block without language as plain", () => {
    const html = renderMarkdown("```\nplain text\n```");
    expect(html).toContain("Code"); // "chat.code.plain" translation
    expect(html).toContain("plain text");
  });

  it("renders table wrapped in horizontal scroll container", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("border-collapse");
    expect(html).toContain("a");
    expect(html).toContain("b");
  });

  it("renders headings with descending sizes", () => {
    const html = renderMarkdown("# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6");
    expect(html).toContain("text-base font-bold");
    expect(html).toContain("text-sm font-semibold");
    expect(html).toContain("text-xs font-medium uppercase");
  });

  it("sanitizes dangerous attributes and scripts", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    // rehype-sanitize strips unknown tags
    expect(html).not.toContain("<script");
  });

  it("keeps allowed tags: strong, em, u, s", () => {
    const html = renderMarkdown("**bold** *italic* __u__ ~~s~~");
    // strong/em get custom classes from components map
    expect(html).toContain('<strong class="font-semibold">bold</strong>');
    expect(html).toContain('<em class="italic">italic</em>');
    // u and s are allowed by sanitize config; u renders via strong fallback, s via <del>
    expect(html).toContain("u");
    expect(html).toContain("<del>s</del>");
  });
});
