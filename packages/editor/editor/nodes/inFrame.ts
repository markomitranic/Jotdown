import { Extension, type Editor } from "@tiptap/core";

/**
 * Whether an editor stands inside markup the build drew, so its views draw no frame of their own.
 *
 * A block from the file already has its frame on the page: the code block's
 * card, the table's scrolling box, the bordered file tree. Its editor is
 * mounted inside that frame, and every node view asks this before drawing a
 * frame, so the page looks the same before and after the editor arrives. A
 * block inserted from the menu has no frame yet, and its views draw one.
 *
 * @example soloExtensions("steps", uploading, true) // includes InFrame.configure({ inFrame: true })
 */
export const InFrame = Extension.create<{ inFrame: boolean }, { inFrame: boolean }>({
  name: "inFrame",

  addOptions() {
    return { inFrame: false };
  },

  addStorage() {
    return { inFrame: this.options.inFrame };
  },
});

/** @example inFrameOf(editor); // true inside a frame the build drew */
export function inFrameOf(editor: Editor): boolean {
  const storage = editor.storage as { inFrame?: { inFrame: boolean } };
  return storage.inFrame?.inFrame === true;
}

/**
 * Whether the node at this position is the one standing in the build's frame.
 *
 * Only the document's own block is: a fence nested inside a step from the file
 * has no frame of its own on the page, so it draws one like an inserted fence
 * would. `depth` is how deep the asking node sits, 0 for the block itself and 1
 * for a panel directly inside it.
 *
 * @example inFrameAt(editor, getPos()); // true for the block the build framed
 * @example inFrameAt(editor, getPos(), 1); // true for a panel of that block
 */
export function inFrameAt(editor: Editor, pos: number | undefined, depth = 0): boolean {
  if (!inFrameOf(editor) || pos === undefined) return false;
  return editor.state.doc.resolve(pos).depth === depth;
}
