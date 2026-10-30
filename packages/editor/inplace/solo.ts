/**
 * The schema for a block this plugin drew itself, rather than one the article drew.
 *
 * Every editable block on a page starts as markup the build already rendered,
 * which is why the editors beside this one hold a block's *children* and mount
 * on the element the core made. A block somebody inserts from the slash menu
 * has no such element and no such markup: the page was built before it existed.
 * So its editor holds the block itself, and ProseMirror draws the whole thing,
 * node view and all.
 *
 * That is what makes the old editor's node views worth keeping rather than
 * rewriting. A `<Steps>` inserted here is drawn by the same `StepsView` the
 * full editor used, with the same button for the next step and the same `jd-steps` class
 * the reader's page paints from, so there is one implementation of each block
 * and no lookalike to keep in step. Their stylesheet comes along for the same
 * reason: a table's cells, a plain fence and an empty block's prompt are DOM
 * ProseMirror owns, which no utility class can reach.
 */

import { getSchema, Node, type Extensions, type JSONContent } from "@tiptap/core";
import "../editor/prosemirror.css";
import { Placeholder } from "@tiptap/extensions";
import { parseDocument } from "../markdown/parse";
import { drawable } from "./editor";
import StarterKit from "@tiptap/starter-kit";
import { Abbr } from "../editor/abbr";
import { listSpread } from "../editor/listSpread";
import { taskItem } from "../editor/taskItem";
import { Accordion, Accordions } from "../editor/nodes/Accordions";
import { Admonition } from "../editor/nodes/Admonition";
import { Card, Cards } from "../editor/nodes/Cards";
import { FileAttachment } from "../editor/nodes/FileAttachment";
import { FileEntry, Files, Folder } from "../editor/nodes/Files";
import { WhiteboardNode } from "../editor/nodes/Whiteboard";
import { MdxBlock } from "../editor/nodes/MdxBlock";
import { MermaidBlock } from "../editor/nodes/MermaidBlock";
import { PreviewImage } from "../editor/nodes/PreviewImage";
import { Step, Steps } from "../editor/nodes/Steps";
import { Tab, Tabs } from "../editor/nodes/Tabs";
import { VideoEmbed } from "../editor/nodes/VideoEmbed";
import { LinkEmbed } from "../editor/nodes/LinkEmbed";
import { insideTable, tableNodesFor } from "../editor/tables";
import { InFrame } from "../editor/nodes/inFrame";
import { uploads } from "../editor/uploads";
import type { Uploading } from "../editor/uploads";

/**
 * Block types drawn by an editor of their own rather than by the build.
 *
 * Everything here is a block the build pipeline draws for a reader and the
 * browser cannot: a fence goes through Shiki, a table through the typography
 * plugin, a `<Steps>` through the core. A new one therefore renders as the
 * editor's own view until the page is saved and the site rebuilds, at which
 * point the reader's version takes over and this editor mounts on it instead.
 *
 * `admonition` is here for a different reason than the rest. A callout the
 * article drew is taken over where it stands, label and body as two editors,
 * because that is what leaves the core's box exactly as the reader sees it. One
 * inserted here has no box to take over, so it is drawn by `AdmonitionView`
 * instead — which is the old editor's own, and brings its kind picker, its
 * title field and a body of real blocks along with it.
 *
 * `mdxBlock` is the last resort rather than a block anybody inserts: it is
 * what a block with no editor and no markup of its own falls back to, which
 * happens when a recovered draft holds one that was dragged here from a part
 * of the page this stamp never saw. It shows its own source, greyed out and
 * uneditable, which is honest about what it is and prints back byte for byte.
 */
export const SOLO = new Set([
  "whiteboard",
  "admonition",
  "codeBlock",
  "mdxBlock",
  "table",
  "image",
  "videoEmbed",
  "linkEmbed",
  "fileAttachment",
  "accordions",
  "steps",
  "tabs",
  "cards",
  "files",
]);

/** Whether a block of this type is one this plugin has to draw for itself. */
export function isSolo(type: string | undefined): boolean {
  return type !== undefined && SOLO.has(type);
}

/**
 * What one inserted block's editor may contain: that block, and prose inside it.
 *
 * The top node is the block itself, so the document is exactly one `<Steps>` or
 * one table and there is no way to type a second one beside it. What a step or
 * a tab *holds* is the ordinary run of prose nodes, which is why the whole node
 * list is here rather than the narrow one the article's own blocks get.
 *
 * Undo is off here as it is in every editor on the page, because the block this
 * one draws was put there by a move that also took another block away, and only
 * the page's own record holds both halves.
 *
 * `inFrame` says the editor is mounted inside the markup the build drew for
 * this block, so no view draws a frame the page already has.
 *
 * @example const editor = mount(el, soloExtensions("steps"), [block], report);
 */
export function soloExtensions(type: string, uploading?: Uploading, inFrame = false): Extensions {
  return [
    Node.create({ name: "doc", topNode: true, content: type }),
    InFrame.configure({ inFrame }),
    StarterKit.configure({
      document: false,
      codeBlock: false,
      underline: false,
      trailingNode: false,
      undoRedo: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: true },
      dropcursor: { color: "var(--color-primary)", width: 2 },
    }),
    PreviewImage.configure({ inline: false }),
    uploads.configure(uploading),
    ...tableNodesFor(inFrame),
    MdxBlock,
    WhiteboardNode,
    MermaidBlock,
    Admonition,
    Accordions,
    Accordion,
    Steps,
    Step,
    Tabs,
    Tab,
    Cards,
    Card,
    Files,
    Folder,
    FileEntry,
    VideoEmbed,
    LinkEmbed,
    FileAttachment,
    Abbr,
    listSpread,
    taskItem,
    Placeholder.configure({
      showOnlyCurrent: true,
      placeholder: ({ editor, node, pos }) => {
        if (node.type.name === "heading") return "Section heading";
        if (insideTable(editor.state.doc.resolve(pos))) return "";
        return "Write something";
      },
    }),
  ];
}

/**
 * The block a slice of the file would be if its own editor drew it, or null to leave it alone.
 *
 * A fence, a table, a `<Steps>` from the file used to stay exactly as the build
 * drew it, editable nowhere, while the same block inserted from the slash menu
 * got an editor of its own. This is what closes that gap: a slice whose block
 * is one the slash menu could have inserted, and whose content that editor's
 * schema can hold, is drawn by that editor instead. What the schema cannot
 * hold, a fence carrying a meta string say, still comes back null.
 *
 * @example soloFor("```ts\nconst x = 1;\n```")?.type; // "codeBlock"
 * @example soloFor("<Weird />"); // null
 */
export function soloFor(markdown: string): JSONContent | null {
  const [block] = parseDocument(markdown).doc.content ?? [];
  const type = block?.type;
  if (block === undefined || type === undefined || type === "mdxBlock" || !isSolo(type)) return null;

  return drawable(getSchema(soloExtensions(type)), [block]) ? block : null;
}
