import type { Root } from "mdast";

type Branch = {
  type: string;
  lang?: string | null;
  value?: string;
  position?: Root["position"];
  children?: Branch[];
};

/**
 * Renders Mermaid fences as components while retaining source positions for in-place edits.
 * @example remarkPlugins: [remarkMermaid, remarkSourceRange]
 */
export function remarkMermaid() {
  return (tree: Root) => transform(tree);
}

/** Replaces fences at every nesting level, preserving their source text and location. */
function transform(parent: Branch) {
  if (!parent.children) return;
  parent.children = parent.children.map((node) => {
    if (node.type === "code" && node.lang === "mermaid") {
      return {
        type: "mdxJsxFlowElement",
        name: "Mermaid",
        attributes: [{ type: "mdxJsxAttribute", name: "chart", value: node.value ?? "" }],
        children: [],
        position: node.position,
      };
    }
    transform(node);
    return node;
  });
}
