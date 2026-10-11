import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockBounds, handleAt, handleBounds, HANDLE_GAP, withinHandleArea } from "./handleGeometry";
import { createHandles, type BlockOps } from "./handles";

const paragraph = { left: 100, right: 400, top: 50, bottom: 90, height: 40, width: 300 };

/** Creates a measurable block with optional nested ownership for hover tests. */
function block(bounds = paragraph, parent?: BlockOps): BlockOps {
  const dom = {
    isConnected: true,
    childElementCount: 0,
    matches: () => false,
    querySelector: () => null,
    getBoundingClientRect: () => bounds,
    contains: (element: HTMLElement) => element === dom,
  } as unknown as HTMLElement;
  if (parent) parent.dom.contains = (element) => element === dom || element === parent.dom;

  return {
    dom,
    box: dom,
    markdown: () => "",
    snapshot: () => ({ block: { type: "paragraph" }, anchor: "" }),
    duplicate() {},
    insertLine() {},
    remove() {},
    dropAfter() {},
    dropBefore() {},
  };
}

describe("block handle geometry", () => {
  beforeEach(() => {
    vi.stubGlobal("getComputedStyle", () => ({ display: "block" }));
    return () => vi.unstubAllGlobals();
  });

  it("keeps the same gap and top alignment at every indentation", () => {
    for (const left of [100, 124, 180]) {
      const grip = handleBounds({ ...paragraph, left });
      expect(left - grip.right).toBe(HANDLE_GAP);
      expect(grip.top).toBe(paragraph.top);
    }
  });

  it("centers the divider grip and keeps the full route to it hoverable", () => {
    const divider = { ...paragraph, height: 1, bottom: 51 };
    const grip = handleBounds(divider);
    expect((grip.top + grip.bottom) / 2).toBe(50.5);
    for (const x of [76, 85, 95, 100]) {
      expect(withinHandleArea(divider, x, grip.top + 1)).toBe(true);
    }
    expect(withinHandleArea(divider, 75, 50)).toBe(false);
    expect(withinHandleArea(divider, 90, grip.bottom + 1)).toBe(false);
  });

  it("finds a nested divider through its hover area inside a parent", () => {
    const handles = createHandles();
    const parent = block();
    const divider = block({ ...paragraph, left: 140, top: 70, bottom: 71, height: 1 }, parent);
    handles.join(parent);
    handles.join(divider);
    expect(handleAt(handles, 120, 65)).toBe(divider);
    expect(handleAt(handles, 90, 55)).toBe(parent);
  });

  it("ignores hidden blocks", () => {
    const handles = createHandles();
    handles.join(block({ left: 0, right: 0, top: 0, bottom: 0, height: 0, width: 0 }));
    expect(handleAt(handles, 0, 0)).toBeNull();
  });

  it("unwraps editor hosts but preserves quotes and paragraphs with one formatted child", () => {
    class Element {
      style = { display: "" };
      classList = { length: 0 };
      constructor(
        readonly tag: string,
        readonly firstElementChild: Element | null = null,
      ) {}
      get childElementCount() {
        return this.firstElementChild ? 1 : 0;
      }
      matches() {
        return this.tag === "editor";
      }
      hasAttribute() {
        return false;
      }
      getBoundingClientRect() {
        return { ...paragraph, tag: this.tag };
      }
    }
    vi.stubGlobal("HTMLElement", Element);
    try {
      const quote = new Element("blockquote", new Element("p", new Element("strong")));
      const editor = new Element("editor", quote);
      expect(blockBounds(editor as unknown as HTMLElement)).toMatchObject({ tag: "blockquote" });
      expect(blockBounds(quote.firstElementChild as unknown as HTMLElement)).toMatchObject({ tag: "p" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
