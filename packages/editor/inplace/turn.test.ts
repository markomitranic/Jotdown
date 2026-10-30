import { describe, expect, it } from "vitest";
import { turnInto } from "./turn";

const bold = { type: "text", text: "Hi", marks: [{ type: "bold" }] };
const words = (text: string) => [{ type: "text", text }];
const item = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: words(text) }] });

describe("turn into", () => {
  it("keeps a paragraph's marks when it becomes a heading", () => {
    expect(turnInto({ type: "paragraph", content: [bold] }, "heading3")).toEqual([
      { type: "heading", attrs: { level: 3 }, content: [bold] },
    ]);
  });

  it("makes one paragraph per list item", () => {
    const list = { type: "bulletList", content: [item("One"), item("Two")] };

    expect(turnInto(list, "paragraph")).toEqual([
      { type: "paragraph", content: words("One") },
      { type: "paragraph", content: words("Two") },
    ]);
  });

  it("keeps the items when a list changes kind", () => {
    const list = { type: "bulletList", content: [item("One")] };

    expect(turnInto(list, "orderedList")).toEqual([{ type: "orderedList", content: [item("One")] }]);
  });

  it("gives every item an open box when a list becomes a to-do list", () => {
    const list = { type: "bulletList", content: [item("One"), item("Two")] };

    expect(turnInto(list, "taskList")).toEqual([
      {
        type: "bulletList",
        content: [
          { ...item("One"), attrs: { checked: false } },
          { ...item("Two"), attrs: { checked: false } },
        ],
      },
    ]);
  });

  it("takes the boxes off when a to-do list becomes a numbered one", () => {
    const list = { type: "bulletList", content: [{ ...item("One"), attrs: { checked: false } }] };

    expect(turnInto(list, "orderedList")).toEqual([
      { type: "orderedList", content: [{ ...item("One"), attrs: { checked: null } }] },
    ]);
  });

  it("keeps a quote's blocks when it becomes a callout", () => {
    const inside = [{ type: "paragraph", content: words("Said") }];

    expect(turnInto({ type: "blockquote", content: inside }, "callout")).toEqual([
      { type: "admonition", attrs: { kind: "note", title: null }, content: inside },
    ]);
  });

  it("gives each line of a fence its own item", () => {
    const fence = { type: "codeBlock", attrs: { language: "sh" }, content: words("a\nb") };

    expect(turnInto(fence, "bulletList")).toEqual([{ type: "bulletList", content: [item("a"), item("b")] }]);
  });

  it("joins the lines of a callout into one fence", () => {
    const callout = {
      type: "admonition",
      content: [
        { type: "paragraph", content: words("a") },
        { type: "paragraph", content: words("b") },
      ],
    };

    expect(turnInto(callout, "codeBlock")).toEqual([
      { type: "codeBlock", attrs: { language: null }, content: words("a\nb") },
    ]);
  });
});

describe("turn into link", () => {
  it("gives an embed back as the link it was pasted as", () => {
    const url = "https://fumadocs.dev/";

    expect(turnInto({ type: "linkEmbed", attrs: { url, title: "Fumadocs" } }, "paragraph")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }] },
    ]);
  });
});
