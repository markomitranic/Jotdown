import { describe, expect, it } from "vitest";
import { createHandles, moveBlocks, type BlockOps, type BlockSnapshot } from "./handles";
import { createHistory } from "./history";

/** A block that writes its own name down whenever it is asked to do something. */
function stubOps(history: ReturnType<typeof createHistory>, log: string[], name: string): BlockOps {
  const dom = {} as HTMLElement;

  const record = (label: string) => {
    log.push(`${name}:${label}`);
    history.did({
      undo: () => log.push(`${name}:-${label}`),
      redo: () => log.push(`${name}:+${label}`),
    });
  };

  return {
    dom,
    box: dom,
    markdown: () => name,
    snapshot: (): BlockSnapshot => ({ block: { type: "paragraph", attrs: { name } }, anchor: "" }),
    duplicate: () => record("duplicate"),
    insertLine: () => record("insertLine"),
    remove: () => record("remove"),
    dropAfter: (moved) => record(`dropAfter(${moved.block.attrs?.name})`),
    dropBefore: (moved) => record(`dropBefore(${moved.block.attrs?.name})`),
  };
}

describe("createHandles", () => {
  it("finds the ops registered for exactly this element", () => {
    const handles = createHandles();
    const a = stubOps(createHistory(), [], "a");
    const b = stubOps(createHistory(), [], "b");
    handles.join(a);
    handles.join(b);

    expect(handles.at(a.dom)).toBe(a);
    expect(handles.at(b.dom)).toBe(b);
    expect(handles.at({} as HTMLElement)).toBeNull();
  });

  it("forgets a block once it leaves", () => {
    const handles = createHandles();
    const a = stubOps(createHistory(), [], "a");
    const leave = handles.join(a);

    leave();

    expect(handles.at(a.dom)).toBeNull();
  });

  it("lists every block currently on the page", () => {
    const handles = createHandles();
    const a = stubOps(createHistory(), [], "a");
    const b = stubOps(createHistory(), [], "b");
    const leave = handles.join(a);
    handles.join(b);

    expect(handles.all()).toEqual([a, b]);

    leave();
    expect(handles.all()).toEqual([b]);
  });
});

describe("moveBlocks", () => {
  it("drops the block beside its target before removing it from its own, as one entry", () => {
    const log: string[] = [];
    const history = createHistory();
    const source = stubOps(history, log, "source");
    const target = stubOps(history, log, "target");

    moveBlocks(history, [source], target, "after");
    expect(log).toEqual(["target:dropAfter(source)", "source:remove"]);

    expect(history.undo()).toBe(true);
    expect(log).toEqual(["target:dropAfter(source)", "source:remove", "source:-remove", "target:-dropAfter(source)"]);
    expect(history.undo()).toBe(false);
  });

  it("drops before the target when asked to", () => {
    const log: string[] = [];
    const history = createHistory();
    const source = stubOps(history, log, "source");
    const target = stubOps(history, log, "target");

    moveBlocks(history, [source], target, "before");

    expect(log).toEqual(["target:dropBefore(source)", "source:remove"]);
  });

  it("keeps a group of blocks in its order on either side of the target", () => {
    const log: string[] = [];
    const history = createHistory();
    const first = stubOps(history, log, "first");
    const second = stubOps(history, log, "second");
    const target = stubOps(history, log, "target");

    moveBlocks(history, [first, second], target, "after");
    moveBlocks(history, [first, second], target, "before");

    expect(log).toEqual([
      "target:dropAfter(second)",
      "target:dropAfter(first)",
      "first:remove",
      "second:remove",
      "target:dropBefore(first)",
      "target:dropBefore(second)",
      "first:remove",
      "second:remove",
    ]);
  });

  it("does nothing when dropped on itself", () => {
    const log: string[] = [];
    const history = createHistory();
    const only = stubOps(history, log, "only");

    moveBlocks(history, [only], only, "before");

    expect(log).toEqual([]);
  });

  it("leaves the block where it is when the target cannot hold it", () => {
    const log: string[] = [];
    const history = createHistory();
    const source = stubOps(history, log, "source");
    const target = { ...stubOps(history, log, "target"), accepts: () => false };

    moveBlocks(history, [source], target, "after");

    expect(log).toEqual([]);
    expect(history.undo()).toBe(false);
  });
});
