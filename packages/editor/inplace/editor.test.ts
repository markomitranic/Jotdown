import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { printBlock } from "../markdown/fromProseMirror";
import { planFor } from "./editor";

/** What a block would print as if the reader opened it and changed nothing. */
function reprint(markdown: string) {
  const plan = planFor(markdown);
  return plan === null ? null : printBlock(plan.block) + plan.anchor;
}

/**
 * The same, after a full trip through the editor's own schema.
 *
 * Everything below the top block goes through ProseMirror, which drops an
 * attribute its schema does not declare and says nothing about it, so a nested
 * list losing its blank lines would only ever show up here.
 */
function throughSchema(markdown: string) {
  const plan = planFor(markdown)!;
  const doc = Node.fromJSON(getSchema(plan.extensions), {
    type: "doc",
    content: plan.block.content ?? [],
  });

  return printBlock({ ...plan.block, content: doc.toJSON().content }) + plan.anchor;
}

describe("planFor", () => {
  it("prints an untouched block back byte for byte", () => {
    const shapes = [
      "A paragraph of **prose**.",
      "## A heading",
      "## A heading [#custom]",
      "- one\n- two",
      "1. first\n2. second",
      "- one\n\n- two",
      "> A quote.\n>\n> Still quoting.",
      ":::warning[Required]\n\nCareful.\n\n:::",
      ":::note\n\nPlain.\n\n:::",
      ":::note\n\nRead this:\n\n```\ncurl https://x/llms.txt\n```\n\n:::",
      ':::note\n\n```ts title="lib/source.ts" lineNumbers\nconst x = 1;\n```\n\n:::',
    ];

    expect(shapes.map(reprint)).toEqual(shapes);
    expect(shapes.map(throughSchema)).toEqual(shapes);
  });

  it("keeps a nested list's spacing across the editor's own schema", () => {
    const shapes = [
      "- outer\n\n  - inner a\n\n  - inner b",
      "- one\n  - inner a\n  - inner b",
      "> - one\n> - two",
      ":::note\n\n- one\n\n- two\n\n:::",
    ];

    expect(shapes.map(throughSchema)).toEqual(shapes);
  });

  it("keeps Markdown blocks editable inside callouts and nested quotes", () => {
    const body = [
      "## A heading",
      "A **bold** and *italic* paragraph with `code` and [a link](/manual).",
      "A hard break.\\\nNext line.",
      "---",
      "- first\n- second",
      "3. third\n4. fourth",
      "> ### Nested heading\n>\n> Quoted prose.",
      '```ts title="sample.ts"\nconst value = 1;\n```',
      '![A shot](/img/docs/x.png "Caption")',
      "| Left | Right |\n| :--- | ---: |\n| one | two |",
    ].join("\n\n");
    const markdown = `:::note\n\n${body}\n\n:::`;
    const plan = planFor(markdown)!;

    expect(plan).not.toBeNull();
    expect(plan.block.content?.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "horizontalRule",
      "bulletList",
      "orderedList",
      "blockquote",
      "codeBlock",
      "image",
      "table",
    ]);
    expect(throughSchema(markdown)).toBe(reprint(markdown));
    expect(throughSchema("> ## A quoted heading")).toBe("> ## A quoted heading");
  });

  it("holds a heading's anchor aside, so it is never shown as text", () => {
    const plan = planFor("## A heading [#custom]")!;

    expect(plan.anchor).toBe(" [#custom]");
    expect(plan.block.content).toEqual([{ type: "text", text: "A heading" }]);
  });

  it("leaves a bracket that upstream would not read as an anchor in the text", () => {
    expect(planFor("## Not an id [#a] and more")!.anchor).toBe("");
    expect(reprint("## Not an id [#a] and more")).toBe("## Not an id \\[#a] and more");
  });

  it("leaves a block alone when its own editor could not draw it", () => {
    const undrawable = ['```ts title="lib/source.ts"\nconst x = 1;\n```', "<Steps>\n  <Step>Do it.</Step>\n</Steps>"];

    expect(undrawable.map(planFor)).toEqual(undrawable.map(() => null));
  });
});
