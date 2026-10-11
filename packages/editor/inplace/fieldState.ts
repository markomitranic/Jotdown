/**
 * The page's front matter, as a block the draft can hold like any other.
 *
 * A page's title, icon and description are not in the article. The compiler
 * skips the `yaml` node deliberately, since it renders to no element, and the
 * route draws the title and the description out of `page.data` rather than out
 * of the tree, so nothing about them has ever reached the draft.
 *
 * Nothing about the draft requires a stamp to have come from the compiler,
 * though. A stamp is a line range and a replacement, and front matter is a line
 * range: the first line to the closing fence. So the whole of this is one more
 * stamp whose replacement is the block with one field patched, which means
 * recovery, comparison, the change count, the save and undo all carry it
 * already and none of them had to learn what a field is.
 *
 * The draft is also the only record kept. Reading a field reads it back out of
 * whatever the draft currently holds, so three fields writing one block compose
 * without anything here having to remember the other two.
 */

import { patchFrontmatterField, readFrontmatterField } from "../markdown/frontmatter";
import type { Draft } from "./draft";

export type Fields = {
  /** Whether this page has front matter at all, and so anywhere to write a field. */
  writable: boolean;
  /** What the file says for one field right now, the reader's own edits included. */
  read(key: string): string | null;
  /** Records a new value, or the value already there to leave the block alone. */
  write(key: string, value: string | null): void;
};

/**
 * The front matter block and the stamp naming it, or null for a file with none.
 *
 * The range is the one `parseMarkdown` gives that file's `yaml` node, which is
 * what `recover-edits.ts` matches a stamp against, so the two have to agree:
 * the first line to the closing fence, with no newline after it.
 *
 * @example frontmatterOf("---\ntitle: Hi\n---\n\nA.")?.stamp; // "1:1-3:4"
 */
export function frontmatterOf(source: string): { stamp: string; text: string } | null {
  const start = /^(\uFEFF)?---\r?\n/.exec(source);
  if (!start) return null;

  const lines = source.split("\n");
  const close = lines.findIndex((line, index) => index > 0 && line.replace(/\r$/, "") === "---");
  if (close === -1) return null;
  const offset = start[1]?.length ?? 0;

  return {
    stamp: `1:${offset + 1}-${close + 1}:4`,
    text: lines
      .slice(0, close + 1)
      .join("\n")
      .slice(offset)
      .replace(/\r$/, ""),
  };
}

/** @example const fields = createFields(source, draft); fields.write("title", "Hi"); */
export function createFields(source: string, draft: Draft): Fields {
  const block = frontmatterOf(source);
  const current = () => (block === null ? "" : (draft.edits().get(block.stamp) ?? block.text));

  return {
    writable: block !== null,

    read: (key) => (block === null ? null : readFrontmatterField(current(), key)),

    write(key, value) {
      if (block === null) return;

      const next = patchFrontmatterField(current(), key, value);
      draft.write(block.stamp, next === block.text ? null : next);
    },
  };
}
