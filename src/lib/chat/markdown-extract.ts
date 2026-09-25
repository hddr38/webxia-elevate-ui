import React from "react";

/**
 * react-markdown renders children bottom-up, so a `pre` override receives the
 * ALREADY-RENDERED inner `code` element. Extracting its props recovers both the
 * language class and the raw source without rendering it a second time.
 * Returns null when sanitize dropped the inner node or nothing is recoverable —
 * the caller then renders whatever is left bare instead of losing the block.
 *
 * Kept out of the component file so it stays unit-testable in a node
 * environment (no react-refresh export warning).
 */
export function extractCodeChild(
  children: React.ReactNode,
): { className?: string; text: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!React.isValidElement(child)) return null;
  const props = child.props as { className?: unknown; children?: unknown };
  const className = typeof props.className === "string" ? props.className : undefined;
  const raw = props.children;
  let text = "";
  if (typeof raw === "string") {
    text = raw;
  } else if (Array.isArray(raw)) {
    text = raw.map((part) => (typeof part === "string" ? part : "")).join("");
  }
  if (!text && !className) return null;
  return { className, text };
}
