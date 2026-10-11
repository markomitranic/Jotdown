import { createHash } from "node:crypto";
import type { Root, RootContent } from "mdast";
import { parseMarkdown } from "@jotdown/editor/markdown/pipeline";
import { MAX_WHITEBOARD_BYTES, readScene, whiteboardMarkdown } from "@jotdown/core/components/blocks/whiteboard/model";
import type { Result } from "./_contract";
import type { Addition } from "../storage/types";

type Branch = { type: string; children?: Branch[] };
type WhiteboardTag = Extract<RootContent, { type: "mdxJsxFlowElement" }>;

/** Finds whiteboard tags at any nesting depth without treating code examples as drawings. */
function boards(tree: Root) {
  const found: WhiteboardTag[] = [];
  const walk = (node: Branch) => {
    if (node.type === "mdxJsxFlowElement" && (node as WhiteboardTag).name === "Whiteboard") {
      found.push(node as WhiteboardTag);
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return found;
}

/**
 * Converts pending scenes into immutable files in the uploads folder, and references to them, for a single page commit.
 *
 * @example prepareWhiteboards("<Whiteboard />", "docs/_uploads"); // unchanged text, no additions
 */
export function prepareWhiteboards(text: string, uploads: string): Result<{ text: string; additions: Addition[] }> {
  if (!text.includes("<Whiteboard")) return { ok: true, value: { text, additions: [] } };

  try {
    const additions = new Map<string, Addition>();
    const replacements: { start: number; end: number; text: string }[] = [];

    for (const node of boards(parseMarkdown(text))) {
      const attrs: Record<string, string> = {};
      for (const attribute of node.attributes) {
        if (
          attribute.type !== "mdxJsxAttribute" ||
          typeof attribute.name !== "string" ||
          typeof attribute.value !== "string"
        ) {
          throw new Error("Whiteboard attributes must be plain strings.");
        }
        attrs[attribute.name] = attribute.value;
      }
      if (!attrs.scene) continue;
      if (node.children.length || Object.keys(attrs).some((key) => !["src", "preview", "scene"].includes(key))) {
        throw new Error("A whiteboard cannot have children or unknown attributes.");
      }
      const previewData = attrs.preview ?? "";
      if (Buffer.byteLength(attrs.scene + previewData) > MAX_WHITEBOARD_BYTES) {
        throw new Error("This whiteboard is too large. Keep the drawing and preview under 3 MB.");
      }
      readScene(attrs.scene);
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(previewData)) {
        throw new Error("The whiteboard needs a PNG preview. Open it and apply the drawing again.");
      }
      const preview = Buffer.from(previewData.slice("data:image/png;base64,".length), "base64");
      if (!preview.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error("The whiteboard preview is not a PNG image.");
      }
      const hash = createHash("sha256").update(attrs.scene).update(preview).digest("hex");
      const src = `/whiteboards/${hash}.excalidraw`;
      const image = `/whiteboards/${hash}.png`;
      additions.set(src, { path: `${uploads}${src}`, content: attrs.scene });
      additions.set(image, { path: `${uploads}${image}`, content: preview });

      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) throw new Error("The whiteboard has no source position.");
      replacements.push({
        start,
        end,
        text: whiteboardMarkdown({ src, preview: image, scene: "" }),
      });
    }

    for (const replacement of replacements.reverse()) {
      text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
    }
    return { ok: true, value: { text, additions: [...additions.values()] } };
  } catch (error) {
    return {
      ok: false,
      failure: {
        status: 400,
        error: error instanceof Error ? error.message : "Invalid whiteboard.",
      },
    };
  }
}
