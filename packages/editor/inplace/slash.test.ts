import { describe, expect, it } from "vitest";
import { blockFor, inplaceChoices } from "./slash";

const MDX = { mdx: true };

describe("the in-place slash menu", () => {
  it("offers the supported blocks in reading order", () => {
    expect(inplaceChoices(MDX, "").map((item) => item.title)).toEqual([
      "Paste markdown",
      "Text",
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Code block",
      "Diagram",
      "Whiteboard",
      "Image",
      "Video embed",
      "Link embed",
      "File attachment",
      "Table",
      "Divider",
      "Note",
      "Tip",
      "Info",
      "Warning",
      "Caution",
      "Danger",
      "Source",
      "Accordion",
      "Steps",
      "Tabs",
      "Cards",
      "File tree",
    ]);
  });

  it("offers nothing that writes a JSX tag on a .md page", () => {
    const titles = inplaceChoices({ mdx: false }, "").map((item) => item.title);

    expect(titles).toContain("Table");
    expect(titles).not.toContain("Steps");
    expect(inplaceChoices({ mdx: false }, "video")).toEqual([]);
  });

  it("finds choices by their familiar command names", () => {
    expect(inplaceChoices(MDX, "h2").map((item) => item.title)).toEqual(["Heading 2"]);
    expect(inplaceChoices(MDX, "call").map((item) => item.title)).toEqual([
      "Note",
      "Tip",
      "Info",
      "Warning",
      "Caution",
      "Danger",
    ]);
  });

  it("builds the smallest valid shape for structural blocks", () => {
    expect(blockFor("heading3")).toEqual({ type: "heading", attrs: { level: 3 } });
    expect(blockFor("bulletList")).toEqual({
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    });
    expect(blockFor("note")).toEqual({
      type: "admonition",
      attrs: { kind: "note", title: null },
      content: [{ type: "paragraph" }],
    });
  });

  it("starts a diagram as a drawing rather than an empty canvas", () => {
    const fence = blockFor("mermaid");

    expect(fence.attrs).toEqual({ language: "mermaid" });
    expect(fence.content?.[0]?.text).toContain("flowchart");
  });

  it("gives a table the header row markdown requires, at the size asked for", () => {
    const table = blockFor("table", { rows: 2, cols: 3 });
    const [header, body] = table.content ?? [];

    expect(table.content).toHaveLength(2);
    expect(header!.content?.map((cell) => cell.type)).toEqual(["tableHeader", "tableHeader", "tableHeader"]);
    expect(body!.content?.map((cell) => cell.type)).toEqual(["tableCell", "tableCell", "tableCell"]);
  });
});
