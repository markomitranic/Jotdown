import { describe, expect, it } from "vitest";
import { prepareWhiteboards } from "./_whiteboard";
import { parseDocument } from "@jotdown/editor/markdown/parse";
import { printBlock } from "@jotdown/editor/markdown/fromProseMirror";
import { whiteboardMarkdown } from "@jotdown/core/components/blocks/whiteboard/model";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
const scene = JSON.stringify({
  type: "excalidraw",
  version: 2,
  elements: [{ id: "image1", type: "image", fileId: "asset1" }],
  appState: { viewBackgroundColor: "#ffffff" },
  files: { asset1: { id: "asset1", mimeType: "image/png", dataURL: png } },
});
const pending = whiteboardMarkdown({ src: "", preview: png, scene });

describe("whiteboard saves", () => {
  it("keeps embedded images through draft serialization and writes a scene/preview pair", () => {
    const block = parseDocument(pending).doc.content![0]!;
    expect(block.type).toBe("whiteboard");
    expect(block.attrs?.scene).toBe(scene);
    expect(printBlock(block)).toBe(pending);

    const result = prepareWhiteboards(`Before.\n\n${pending}\n\nAfter.`, "docs/_uploads");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failure.error);
    const drawing = result.value.additions[0]!;
    const preview = result.value.additions[1]!;
    expect(drawing.path).toMatch(/^docs\/_uploads\/whiteboards\/[a-f0-9]{64}\.excalidraw$/);
    expect(drawing.content).toBe(scene);
    expect(preview.path).toBe(drawing.path.replace(/\.excalidraw$/, ".png"));
    expect(preview.content).toEqual(Buffer.from(png.split(",")[1]!, "base64"));
    expect(result.value.text).toContain(`src="${drawing.path.replace(/^docs\/_uploads/, "")}"`);
    expect(result.value.text).not.toContain("scene=");
    expect(result.value.text.startsWith("Before.\n\n")).toBe(true);
    expect(result.value.text.endsWith("\n\nAfter.")).toBe(true);
  });

  it("deduplicates identical boards and leaves code examples untouched", () => {
    const example = `\`\`\`mdx\n${pending}\n\`\`\``;
    const result = prepareWhiteboards(`${pending}\n\n${pending}\n\n${example}`, "docs/_uploads");
    expect(result.ok && result.value.additions).toHaveLength(2);
    expect(result.ok && result.value.text).toContain(example);
  });

  it("rejects invalid scene data and active preview formats before writing", () => {
    for (const data of [
      { src: "", preview: png, scene: "{}" },
      { src: "", preview: "data:image/svg+xml;base64,PHN2Zy8+", scene },
      { src: "", preview: "data:image/png;base64,PHN2Zy8+", scene },
    ])
      expect(prepareWhiteboards(whiteboardMarkdown(data), "docs/_uploads").ok).toBe(false);
  });

  it("round trips quotes and ampersands in drawing labels", () => {
    const text = scene.replace('"#ffffff"', '"A &quot; and <B>"');
    const draft = whiteboardMarkdown({ src: "", preview: png, scene: text });
    expect(parseDocument(draft).doc.content![0]!.attrs?.scene).toBe(text);
  });
});
