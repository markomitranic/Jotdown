/**
 * The schema half of an in-place block: what one can hold, and how it takes an element.
 *
 * Everything Tiptap and everything markdown is behind this module and the one
 * beside it on purpose. A block imports them dynamically at mount, so a reader
 * on a deployment that offers no editing never downloads an editor, and a page
 * that offers one pays for it after the article is already on screen.
 */

import { Editor, Node, getSchema, type Extensions, type JSONContent } from "@tiptap/core";
import type { Node as ProseNode, Schema } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { Abbr } from "../editor/abbr";
import { listSpread, TIGHT_LIST } from "../editor/listSpread";
import { parseDocument } from "../markdown/parse";
import { MermaidBlock } from "../editor/nodes/MermaidBlock";
import { PreviewImage } from "../editor/nodes/PreviewImage";
import { tableNodes } from "../editor/tables";

/** A document of words, which is what a paragraph and a heading each are. */
export const INLINE = "inline*";

/** A document of list items, which is what both lists are. */
export const ITEMS = "listItem+";

/** A document of whole blocks, which is what a quote and a callout each hold. */
export const BLOCKS = "block+";

/**
 * Whether a node is a box of whole blocks, one a reader can write and drop blocks into.
 *
 * A callout, a quote, an accordion panel, a step and a tab are all spelled the
 * same way in the schema, which is what makes them one kind of thing here. A
 * table cell or a list item is not, because each holds a narrower run.
 *
 * @example isBox(schema.nodes.admonition.create()); // true
 */
export function isBox(node: ProseNode): boolean {
  return node.type.spec.content === BLOCKS;
}

/**
 * What each editable block holds, written as ProseMirror content expressions.
 *
 * This is the only table that knows one block type from another. Everything
 * else falls out of the parse: bullet versus ordered, heading level, callout
 * kind and every other attribute rides along in the parsed node and is printed
 * straight back, so no code here has to have heard of them.
 *
 * A node holds inline content or block content and never a choice of the two,
 * which is why the expression cannot be one shared spelling. Tiptap's
 * `listItem` is in no group, so a list needs its own rather than `block+`.
 *
 * A block type missing from this table is a block that stays as the article
 * drew it, which is also what happens to a shape the markdown bridge could not
 * map: an unmappable block parses as `mdxBlock`, and `mdxBlock` is not here.
 */
const HOLDS: Record<string, string> = {
  paragraph: INLINE,
  heading: INLINE,
  bulletList: ITEMS,
  orderedList: ITEMS,
  blockquote: BLOCKS,
  admonition: BLOCKS,
};

/**
 * What a block of this type holds, or undefined when it has no editor at all.
 *
 * @example holdsFor("paragraph"); // "inline*"
 * @example holdsFor("table"); // undefined
 */
export function holdsFor(type: string | undefined): string | undefined {
  return type === undefined ? undefined : HOLDS[type];
}

/** The elements one block's editors take over, as the component found them. */
export type BlockElements = {
  /** The element that stands in the article's flow, and so the one a new block goes after. */
  flow: HTMLElement;
  /** The element holding the block's own content, which is what the editor takes. */
  body: HTMLElement;
  /** A callout's label, which is an attribute rather than content. */
  title?: HTMLElement | null;
};

/** Everything a mount needs, worked out from the markdown alone. */
export type Plan = {
  block: JSONContent;
  anchor: string;
  holds: string;
  extensions: ReturnType<typeof bodyExtensions>;
};

/**
 * What an in-place editor would make of a slice of markdown, or null to leave it alone.
 *
 * Two things send a block back untouched, and both are the same answer: this
 * editor cannot draw it, so the article's own markup stays. Either the block
 * itself is a type with no entry in `HOLDS`, or something nested inside it is a
 * node the small schema has never heard of.
 *
 * @example planFor("Hello.")?.block.type; // "paragraph"
 * @example planFor("<Steps>…</Steps>"); // null
 */
export function planFor(markdown: string): Plan | null {
  const [text, anchor] = splitAnchor(markdown);

  const parsed = parseDocument(text).doc.content ?? [];
  const block = parsed[0] ?? (text.trim() === "" ? { type: "paragraph", content: [] } : undefined);
  const holds = holdsFor(block?.type);
  if (block === undefined || holds === undefined) return null;

  const extensions = bodyExtensions(holds);
  if (!drawable(getSchema(extensions), block.content ?? [])) return null;

  return { block, anchor, holds, extensions };
}

/**
 * Hands one element to one editor.
 *
 * `{ mount }` is ProseMirror's way of being handed an element instead of being
 * given one to append to. Tiptap passes the argument through to the view
 * untouched; only its type says HTMLElement.
 *
 * `adopt` runs in the one window where anything about the drawing can still be
 * arranged: the view asks every extension for a node view as it builds, and
 * after the mount it is too late.
 */
export function mount(
  element: HTMLElement,
  extensions: Extensions,
  content: JSONContent[],
  onUpdate: (editor: Editor) => void,
  adopt: (editor: Editor) => void = () => {},
): Editor {
  const editor = new Editor({ extensions, content: { type: "doc", content } });
  editor.on("update", () => onUpdate(editor));
  adopt(editor);
  editor.mount({ mount: element } as unknown as HTMLElement);
  return editor;
}

/**
 * Puts on the element what the schema would have drawn, had it drawn it.
 *
 * A document's top node is the element the article already made, and
 * ProseMirror never redraws that one, so neither a class nor an attribute the
 * schema renders onto a block ever reaches the outermost one. Only the lists
 * care, about two things.
 *
 * Their items are about to be wrapped in paragraphs, so the stylesheet needs to
 * know whether the author wrote the list tight. And an ordered list carries the
 * number it starts at, which matters for a list this editor made itself: the
 * second half of a list broken in the middle has to carry on counting rather
 * than start again at one.
 *
 * A list nested inside a quote or a callout is drawn by the schema and gets
 * both from there.
 */
export function dress(element: HTMLElement, block: JSONContent) {
  if (block.type !== "bulletList" && block.type !== "orderedList") return;

  element.classList.toggle(TIGHT_LIST, block.attrs?.spread !== true);

  const start = block.attrs?.start;
  if (block.type === "orderedList" && typeof start === "number" && start > 1) {
    element.setAttribute("start", String(start));
  }
}

/**
 * Whether this editor's small schema can hold what the parse produced.
 *
 * A quote or a callout can hold things a line of prose cannot: a fence, a
 * heading, a table, an image, a nested callout, a block the bridge kept inert
 * because it could not map it. Handed one of those, Tiptap does not fail
 * loudly: it warns to the console and mounts an empty editor, which would wipe
 * the block off the page. Asking the schema the same question first is what
 * turns that into the block staying exactly as the article drew it.
 *
 * The schema is asked rather than a list being kept beside it, so adding an
 * extension is the only edit that adding a node type takes.
 */
export function drawable(schema: Schema, content: readonly JSONContent[]): boolean {
  try {
    schema.nodeFromJSON({ type: "doc", content }).check();
    return true;
  } catch {
    return false;
  }
}

/**
 * A document that is one block's children and nothing else.
 *
 * This is what lets the editor take over the very element the article drew,
 * rather than a wrapper around it. ProseMirror renders the top node as the
 * element it is mounted on, so a doc holding `inline*` mounted on a `<p>` puts
 * the text straight back inside that `<p>`: same tag, same classes, same place
 * in the tree, now editable. A doc holding blocks would render a `<p>` inside
 * the `<p>` instead.
 */
function docNode(holds: string) {
  return Node.create({ name: "doc", topNode: true, content: holds });
}

/**
 * Builds a schema for inline text, list items or a container's Markdown blocks.
 *
 * Containers support headings, fences, images and tables alongside prose.
 * Formatting without a Markdown spelling and automatic trailing paragraphs are
 * disabled. Undo belongs to the page so edits spanning blocks remain one operation.
 *
 * @example getSchema(bodyExtensions(BLOCKS)).nodes.heading; // heading node type
 */
export function bodyExtensions(holds: string) {
  const inline = holds === INLINE;

  return [
    docNode(holds),
    StarterKit.configure({
      document: false,
      heading: inline ? false : {},
      codeBlock: false,
      underline: false,
      trailingNode: false,
      undoRedo: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: true },
      ...(inline
        ? {
            paragraph: false as const,
            blockquote: false as const,
            bulletList: false as const,
            orderedList: false as const,
            listItem: false as const,
            listKeymap: false as const,
            horizontalRule: false as const,
            gapcursor: false as const,
            dropcursor: false as const,
          }
        : {}),
    }),
    ...(inline ? [] : [MermaidBlock, PreviewImage.configure({ inline: false }), ...tableNodes]),
    Abbr,
    listSpread,
  ];
}

/**
 * The callout label's editor: one line of plain text, and no way to format it.
 *
 * The label is a string attribute on the directive, `:::tip[Read this first]`,
 * with nowhere to keep a mark. Every mark is therefore off rather than merely
 * discouraged, so a Cmd+B in the label cannot produce something the file has no
 * spelling for. Undo is the page's, as it is for every other editor here.
 */
export const TITLE_EXTENSIONS = [
  Node.create({ name: "doc", topNode: true, content: "text*" }),
  StarterKit.configure({
    document: false,
    paragraph: false,
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    codeBlock: false,
    horizontalRule: false,
    hardBreak: false,
    bold: false,
    italic: false,
    strike: false,
    code: false,
    underline: false,
    link: false,
    trailingNode: false,
    undoRedo: false,
    gapcursor: false,
    dropcursor: false,
  }),
];

/**
 * A heading's explicit anchor, which the rendered heading does not show.
 *
 * The character class and the anchoring at the end are `remarkHeading`'s own,
 * so what is held aside here is exactly what upstream turned into the `id`.
 * `## Not an id [#a] and more words` is not one, and neither side treats it as
 * one.
 */
const ANCHOR = /[ \t]*\[#[^\]]+?\][ \t]*$/;

/**
 * Splits a heading's `[#custom-id]` off its text, so the editor never shows it.
 *
 * `remarkHeading` turns that suffix into the heading's `id` and strips it from
 * what the reader sees, while the source slice a stamp cuts still carries it.
 * Seeding an editor from the slice would therefore make the suffix appear as
 * text the moment the block mounted. It is held aside instead and printed back
 * on the end, which also keeps the anchor alive across an edit.
 *
 * @example splitAnchor("## Hi [#greeting]"); // ["## Hi", " [#greeting]"]
 */
function splitAnchor(markdown: string): [text: string, anchor: string] {
  if (!/^#{1,6}[ \t]/.test(markdown)) return [markdown, ""];
  const anchor = ANCHOR.exec(markdown)?.[0];
  return anchor === undefined ? [markdown, ""] : [markdown.slice(0, -anchor.length), anchor];
}
