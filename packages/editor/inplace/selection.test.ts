import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { createSelectionTracker } from "./selection";

type Handler = () => void;

/** Enough of an `Editor` for the tracker to read: events, its words, its focus, and a selection it can move. */
function fakeEditor(words = "Hello world") {
  const handlers = new Map<string, Handler[]>();
  const doc = { textBetween: (from: number, to: number) => words.slice(from, to) };
  const view = { focused: true, hasFocus: () => view.focused };

  return {
    view,
    state: { doc, selection: { empty: true, from: 0, to: 0 } },
    on(event: string, handler: Handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    off(event: string, handler: Handler) {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((registered) => registered !== handler),
      );
    },
    fire(event: string) {
      (handlers.get(event) ?? []).forEach((handler) => handler());
    },
  };
}

describe("createSelectionTracker", () => {
  it("reports a selection, and says when it has collapsed to a caret", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor();
    tracker.join(editor as unknown as Editor);

    editor.state.selection = { empty: false, from: 2, to: 5 };
    editor.fire("transaction");
    expect(tracker.get()).toEqual({ editor, from: 2, to: 5, empty: false, text: true });

    editor.state.selection = { empty: true, from: 5, to: 5 };
    editor.fire("transaction");
    expect(tracker.get()).toEqual({ editor, from: 5, to: 5, empty: true, text: false });
  });

  it("says a block selected whole, such as an image, holds no text", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor("");
    tracker.join(editor as unknown as Editor);

    editor.state.selection = { empty: false, from: 0, to: 1 };
    editor.fire("transaction");

    expect(tracker.get()?.text).toBe(false);
  });

  it("is unmoved by anything that is not a transaction on a tracked editor", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor();
    tracker.join(editor as unknown as Editor);
    editor.state.selection = { empty: false, from: 1, to: 3 };
    editor.fire("transaction");

    editor.fire("blur");
    editor.fire("focus");

    expect(tracker.get()).toEqual({ editor, from: 1, to: 3, empty: false, text: true });
  });

  it("keeps the reader's selection while an editor without focus runs a transaction of its own", () => {
    const tracker = createSelectionTracker();
    const reading = fakeEditor();
    const elsewhere = fakeEditor();
    tracker.join(reading as unknown as Editor);
    tracker.join(elsewhere as unknown as Editor);

    reading.state.selection = { empty: false, from: 1, to: 4 };
    reading.fire("transaction");
    elsewhere.view.focused = false;
    elsewhere.fire("transaction");

    expect(tracker.get()).toEqual({ editor: reading, from: 1, to: 4, empty: false, text: true });
  });

  it("keeps following the reader's editor after a menu beside it takes focus", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor();
    tracker.join(editor as unknown as Editor);
    editor.state.selection = { empty: false, from: 1, to: 4 };
    editor.fire("transaction");

    editor.view.focused = false;
    editor.state.selection = { empty: false, from: 1, to: 6 };
    editor.fire("transaction");

    expect(tracker.get()).toEqual({ editor, from: 1, to: 6, empty: false, text: true });
  });

  it("forgets a selection once its editor leaves", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor();
    const leave = tracker.join(editor as unknown as Editor);
    editor.state.selection = { empty: false, from: 1, to: 2 };
    editor.fire("transaction");

    leave();

    expect(tracker.get()).toBeNull();
  });

  it("follows the reader from one editor into another", () => {
    const tracker = createSelectionTracker();
    const first = fakeEditor();
    const second = fakeEditor();
    tracker.join(first as unknown as Editor);
    tracker.join(second as unknown as Editor);

    first.state.selection = { empty: false, from: 1, to: 2 };
    first.fire("transaction");
    second.state.selection = { empty: true, from: 0, to: 0 };
    second.fire("transaction");

    expect(tracker.get()).toEqual({ editor: second, from: 0, to: 0, empty: true, text: false });
  });

  it("tells every subscriber, however the selection moved", () => {
    const tracker = createSelectionTracker();
    const editor = fakeEditor();
    tracker.join(editor as unknown as Editor);

    let told = 0;
    tracker.subscribe(() => (told += 1));

    editor.state.selection = { empty: false, from: 1, to: 2 };
    editor.fire("transaction");
    editor.state.selection = { empty: true, from: 2, to: 2 };
    editor.fire("transaction");

    expect(told).toBe(2);
  });
});
