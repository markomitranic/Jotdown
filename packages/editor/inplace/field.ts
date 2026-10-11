/**
 * The editor half of a front matter field, behind the same lazy import a block is.
 *
 * A field is one line of plain text with nowhere to put a mark, exactly like a
 * callout's label, so it carries the same schema: every mark off rather than
 * merely discouraged, because the file has no spelling for a bold title. Undo
 * is the page's, so clearing a description and pressing Cmd+Z puts it back the
 * same way it puts a paragraph back.
 */

import { mount, TITLE_EXTENSIONS } from "./editor";
import { pageHistory, seat, sit } from "./seats";
import type { Inplace } from "./context";

/**
 * Hands one front matter field its own one-line editor.
 *
 * `data-empty` is on the element rather than a `:empty` rule, because a browser
 * leaves a stray `<br>` behind when the last character of a contenteditable
 * goes, so the element is never really empty and the placeholder would never
 * show.
 *
 * @example const stop = mountField(element, "Code review", report, page);
 */
export function mountField(
  element: HTMLElement,
  text: string,
  onChange: (value: string | null) => void,
  page: Inplace,
): () => void {
  const paint = (value: string | null) => {
    element.dataset.empty = value === null ? "true" : "false";
  };

  const chair = seat();
  const editor = mount(
    element,
    [...TITLE_EXTENSIONS, pageHistory(page.history)],
    text === "" ? [] : [{ type: "text", text }],
    () => {
      const value = editor.getText().trim() || null;
      paint(value);
      onChange(value);
    },
  );

  paint(text.trim() || null);
  sit(chair, editor, page.history);
  const leave = page.selection.join(editor);

  return () => {
    leave();
    editor.destroy();
  };
}
