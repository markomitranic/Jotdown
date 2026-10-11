/**
 * The markdown a reader types at the start of a line, taken as the block itself.
 *
 * Typing `- ` for a list or ``` for a fence is the oldest habit anybody writing
 * markdown has, and Tiptap answers it everywhere else with input rules that
 * change the node the caret is in. Those rules cannot fire here: a line of
 * prose is its own document holding words and nothing else, so its schema has
 * no list to turn into and no fence to become. There is nothing to change the
 * node *to*.
 *
 * So the shorthand goes the way the slash menu goes, which is the only way a
 * block changes kind on this page: the whole block is replaced by a new one,
 * and the line the reader typed is the choice. That also settles when a rule
 * may fire. The menu only opens when its query is the block's entire content,
 * because replacement is literal, and the same is true here: `- ` on a line of
 * its own starts a list, and the same two characters in the middle of a
 * sentence are the two characters they look like.
 *
 * A quote or a callout needs none of this. Its editor holds whole blocks, so
 * its schema has the list and the quote in it and Tiptap's own rules already
 * do the right thing inside one.
 *
 * The replacement is left until the end of the turn. It takes the editor the
 * rule fired in off the page, and the plugin that called the rule is still
 * holding a transaction to dispatch into that same editor.
 *
 * What that transaction does is put the marker *back* rather than take it away,
 * which reads oddly until you follow what one Cmd+Z then undoes. A rule
 * consumes the character that triggered it, so by the time the handler runs the
 * document holds `-` and not `- `: the space the reader typed was never in it.
 * Leave the line as the rule found it and the only entry in the record is the
 * block being replaced, so undoing it hands back the line **with the marker
 * still on it**, exactly as it was typed. Take the marker away instead and the
 * removal is an entry of its own, which either wants a second Cmd+Z or, undone
 * together with the replacement, hands back a line one character short.
 *
 * Writing the whole marker in costs nothing, because the block is replaced a
 * turn later regardless, and it is the same step that makes Tiptap count the
 * rule as applied at all.
 */

import { Extension, InputRule, type Editor, type JSONContent } from "@tiptap/core";
import { blockFor } from "./slash";

/** Puts a block of another kind where the one the caret is in stands. */
export type Becomes = (editor: Editor, block: JSONContent) => void;

/**
 * The block each line of shorthand asks for.
 *
 * A page's level-1 heading is its front matter title, which the article draws
 * above the body and nothing in the body may have a second of, so a single
 * hash asks for the largest heading a page can actually hold.
 */
const SHORTHAND: Array<{ find: RegExp; block(): JSONContent }> = [
  { find: /^[-*+]\s$/, block: () => blockFor("bulletList") },
  { find: /^\d+[.)]\s$/, block: () => blockFor("orderedList") },
  { find: /^>\s$/, block: () => blockFor("blockquote") },
  { find: /^#{1,2}\s$/, block: () => blockFor("heading2") },
  { find: /^###\s$/, block: () => blockFor("heading3") },
  { find: /^####\s$/, block: () => blockFor("heading4") },
  { find: /^```$/, block: () => blockFor("codeBlock") },
  { find: /^(?:---|\*\*\*|___)$/, block: () => blockFor("horizontalRule") },
];

/**
 * The block one line of shorthand asks for, or null where it asks for nothing.
 *
 * @example shorthandFor("- ")?.type; // "bulletList"
 * @example shorthandFor("a - b"); // null
 */
export function shorthandFor(typed: string): JSONContent | null {
  for (const { find, block } of SHORTHAND) {
    if (find.test(typed)) return block();
  }

  return null;
}

/**
 * Adds the markdown shorthands to an inline in-place editor.
 *
 * @example const extension = inplaceShorthand((editor, block) => becomes(part, editor, null, block));
 */
export function inplaceShorthand(becomes: Becomes) {
  return Extension.create({
    name: "inplaceShorthand",
    priority: 1100,

    addInputRules() {
      const { editor } = this;

      return SHORTHAND.map(
        ({ find }) =>
          new InputRule({
            find,
            handler: ({ state, range, match }) => {
              const made = shorthandFor(match[0]);
              if (made === null || range.from !== 0 || range.to !== state.doc.content.size) {
                return null;
              }

              state.tr.insertText(match[0].slice(range.to - range.from), range.to);
              queueMicrotask(() => becomes(editor, made));
            },
          }),
      );
    },
  });
}
