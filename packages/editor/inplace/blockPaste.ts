/**
 * Whole blocks pasted where the caret is, rather than read back as text.
 *
 * Blocks copied in the studio come back as themselves, and a page copied from
 * another site, a wiki, a document or a web page, comes back as the headings,
 * lists and tables it was drawn with. A lone link pasted onto an empty line of
 * an `.mdx` page becomes an embed, a video for YouTube and a card for anything
 * else. Anything else, a link pasted into a sentence and a sentence copied out
 * of one paragraph included, goes through the editor's own paste, which keeps
 * it text.
 */

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { webAddress } from "@jotdown/core/lib/web-address";
import { youtubeId } from "@jotdown/core/components/blocks/VideoEmbed";
import { carriedBlocks, copiedMarkdown } from "./clipboard";
import type { BlockSnapshot } from "./handles";
import { blocksFrom, markdownFromHtml } from "./pasted";

/** How a line of prose makes room for what is pasted into it, which an editor holding blocks needs none of. */
type Landing = {
  place: (editor: Editor, blocks: BlockSnapshot[]) => void;
  upload: (editor: Editor, files: File[]) => void;
  /** Whether a lone link pasted here becomes an embed, which only an empty paragraph of an `.mdx` page does. */
  embeds: (editor: Editor) => boolean;
};

/**
 * Pastes copied blocks into an editor, through `landing` when the page has to make room for them.
 *
 * A line of prose cannot hold a heading, a fence or an image, so its part
 * breaks the line around them: `place` puts down blocks, and `upload` commits
 * pasted files, a screenshot or an image copied from a page, before placing
 * them. An editor whose document holds blocks, a callout's, takes them as
 * nodes of its own, and declines the paste when its schema has no room for one.
 * A link becomes an embed only on a line of prose, where `embeds` says so.
 *
 * @example blockPaste({ place, upload, embeds: (editor) => editor.isEmpty });
 */
export function blockPaste(landing?: Landing) {
  return Extension.create({
    name: "blockPaste",

    addProseMirrorPlugins() {
      const { editor } = this;

      return [
        new Plugin({
          props: {
            handlePaste: (view, event) => {
              const data = event.clipboardData;
              if (data === null || withinField(event)) return false;

              const embed = landing?.embeds(editor) ? embedOn(data) : null;
              const blocks = embed === null ? blocksOn(data) : [{ block: embed, anchor: "" }];
              const files = Array.from(data.files);

              if (blocks.length > 0) {
                if (landing === undefined) return insertNodes(view, blocks);
                landing.place(editor, blocks);
                return true;
              }

              if (files.length === 0 || landing === undefined) return false;
              landing.upload(editor, files);
              return true;
            },
          },
        }),
      ];
    },
  });
}

/**
 * The blocks a clipboard holds, studio blocks first and another site's HTML second, or none for words.
 *
 * @example blocksOn(event.clipboardData); // [{ block: heading }, { block: paragraph }]
 */
function blocksOn(data: DataTransfer): BlockSnapshot[] {
  const markdown = copiedMarkdown(data);
  if (markdown !== null) return carriedBlocks(markdown) ?? blocksFrom(markdown);

  const foreign = markdownFromHtml(data.getData("text/html"));
  return foreign === null ? [] : blocksFrom(foreign);
}

/**
 * The embed a lone pasted link becomes, a video for YouTube and a card waiting to be read for anything else.
 *
 * Blocks copied in the studio are never an embed, even when all they hold is a link.
 *
 * @example embedOn(clipboardWith("https://fumadocs.dev")); // { type: "linkEmbed", attrs: { url, unfurl: true } }
 */
function embedOn(data: DataTransfer): JSONContent | null {
  if (copiedMarkdown(data) !== null) return null;

  const text = data.getData("text/plain").trim();
  if (/\s/.test(text)) return null;
  if (youtubeId(text) !== null) return { type: "videoEmbed", attrs: { url: text } };

  const address = webAddress(text);
  return address === null ? null : { type: "linkEmbed", attrs: { url: address.href, unfurl: true } };
}

/**
 * Whether a paste landed in a field of a block's own, a link or a label, which bubbles out to the editor.
 *
 * Those fields take their own paste, and answering it again here would put a second block beside them.
 */
function withinField(event: ClipboardEvent) {
  return event.target instanceof HTMLElement && event.target.closest("input, textarea") !== null;
}

/** Puts blocks in place of the selection as nodes of this editor's own schema, if it has all of them. */
function insertNodes(view: EditorView, blocks: BlockSnapshot[]): boolean {
  try {
    const nodes = blocks.map(({ block }) => view.state.schema.nodeFromJSON(block));
    view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0)).scrollIntoView());
    return true;
  } catch {
    return false;
  }
}
