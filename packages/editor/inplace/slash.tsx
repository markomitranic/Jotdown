import { Extension, type Editor, type JSONContent, type Range } from "@tiptap/core";
import { PluginKey, type EditorState } from "@tiptap/pm/state";
import Suggestion, { exitSuggestion } from "@tiptap/suggestion";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { SlashList, type SlashChoice } from "./SlashList";
import { SizeGrid } from "../editor/menus/SizeGrid";
import { DIAGRAM_TEMPLATES } from "../editor/nodes/mermaidTemplates";
import { clampSize, type GridSize } from "../editor/tables";
import type { PreviewKind } from "./previews";

/** A block the menu builds out of nothing, named as the reader thinks of it. */
export type InplaceBlock =
  | "paragraph"
  | "heading2"
  | "heading3"
  | "heading4"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "horizontalRule"
  | "note"
  | "tip"
  | "info"
  | "warning"
  | "caution"
  | "danger"
  | "source"
  | "codeBlock"
  | "whiteboard"
  | "mermaid"
  | "table"
  | "videoEmbed"
  | "linkEmbed"
  | "accordions"
  | "steps"
  | "tabs"
  | "cards"
  | "files";

/**
 * One choice, once the reader has answered whatever it asked them.
 *
 * Three shapes, because three things can happen. Most items are a block and
 * the insertion is immediate. A picture and an attachment are a file first: the
 * upload has to be committed before there is anything to draw, so the block
 * comes back from the picker rather than from this module. Pasting markdown is
 * the clipboard first, and its blocks come back from reading it.
 */
export type Chosen =
  | { block: InplaceBlock; size?: GridSize }
  | { picks: "image" | "file" }
  | { pastes: "markdown" }
  | { writes: string };

/** A block of the project's own the menu offers, written as the source it starts out as. */
export type SlashInsert = { name: string; title: string; hint: string; source: string };

type Item = SlashChoice &
  Chosen & {
    keywords: string[];
    /** Writes a JSX tag, so the item is withheld from a `.md` page. */
    jsx?: true;
    /** Choosing this opens the size grid, which asks for the block for real. */
    sized?: true;
  };

/**
 * What the menu is allowed to offer where it was opened.
 *
 * `mdx` is the file: a `.md` page compiles no JSX, so an item that writes a tag
 * is withheld from one. `holds` is the place, asked about the caret as it
 * stands: a paragraph of the article can be replaced by any block there is,
 * and a paragraph inside a box can only become something that box can hold, so
 * the menu inside one is shorter than the menu beside it, and does not open at
 * all where nothing fits.
 */
export type SlashOptions = {
  mdx: boolean;
  /** The project's own blocks, offered after the framework's. */
  inserts?: SlashInsert[];
  holds?: (chosen: Chosen, state: EditorState) => boolean;
};

type Replace = (editor: Editor, range: Range, chosen: Chosen) => void;

const slashPluginKey = new PluginKey("inplaceSlash");

const ITEMS: Item[] = [
  {
    pastes: "markdown",
    title: "Paste markdown",
    hint: "Copied markdown, as blocks",
    glyph: "M↓",
    keywords: ["paste", "markdown", "md", "clipboard", "import"],
  },
  {
    block: "paragraph",
    title: "Text",
    hint: "Plain paragraph",
    glyph: "P",
    keywords: ["paragraph", "body", "plain"],
  },
  {
    block: "heading2",
    title: "Heading 2",
    hint: "Section heading",
    glyph: "H2",
    keywords: ["heading", "h2", "section"],
  },
  {
    block: "heading3",
    title: "Heading 3",
    hint: "Sub-section heading",
    glyph: "H3",
    keywords: ["heading", "h3", "subsection"],
  },
  {
    block: "heading4",
    title: "Heading 4",
    hint: "Small section heading",
    glyph: "H4",
    keywords: ["heading", "h4", "subsection"],
  },
  {
    block: "bulletList",
    title: "Bulleted list",
    hint: "Unordered items",
    glyph: "•",
    keywords: ["list", "bullet", "unordered", "ul"],
  },
  {
    block: "orderedList",
    title: "Numbered list",
    hint: "Ordered steps",
    glyph: "1.",
    keywords: ["list", "ordered", "number", "ol"],
  },
  {
    block: "taskList",
    title: "To-do list",
    hint: "Items to tick off",
    glyph: "☐",
    keywords: ["list", "todo", "to-do", "task", "checkbox", "check"],
  },
  {
    block: "blockquote",
    title: "Quote",
    hint: "Set apart a passage",
    glyph: "“",
    keywords: ["quote", "blockquote", "citation"],
  },
  {
    block: "codeBlock",
    title: "Code block",
    hint: "Fenced, monospaced",
    glyph: "{ }",
    keywords: ["code", "fence", "snippet", "pre"],
  },
  {
    block: "mermaid",
    title: "Diagram",
    hint: "Flowchart, drawn not typed",
    glyph: "◇",
    keywords: ["diagram", "mermaid", "flowchart", "graph", "sequence", "chart"],
  },
  {
    block: "whiteboard",
    title: "Whiteboard",
    hint: "Draw with Excalidraw",
    glyph: "▱",
    keywords: ["whiteboard", "excalidraw", "drawing", "sketch", "canvas"],
    jsx: true,
  },
  {
    picks: "image",
    title: "Image",
    hint: "Upload a picture",
    glyph: "▣",
    keywords: ["image", "picture", "photo", "screenshot", "figure", "upload"],
  },
  {
    block: "videoEmbed",
    title: "Video embed",
    hint: "Paste a YouTube link",
    glyph: "▶",
    keywords: ["video", "youtube", "embed", "clip", "recording", "watch"],
    jsx: true,
  },
  {
    block: "linkEmbed",
    title: "Link embed",
    hint: "A card with the page's title and picture",
    glyph: "↗",
    keywords: ["link", "bookmark", "embed", "card", "preview", "url", "web"],
    jsx: true,
  },
  {
    picks: "file",
    title: "File attachment",
    hint: "Upload a PDF, zip or spreadsheet",
    glyph: "⤓",
    keywords: ["file", "attachment", "download", "upload", "pdf", "zip", "attach"],
    jsx: true,
  },
  {
    block: "table",
    title: "Table",
    hint: "Pick a size",
    glyph: "▦",
    keywords: ["table", "grid", "row", "column"],
    sized: true,
  },
  {
    block: "horizontalRule",
    title: "Divider",
    hint: "Horizontal rule",
    glyph: "─",
    keywords: ["divider", "rule", "hr", "separator"],
  },
  {
    block: "note",
    title: "Note",
    hint: "Admonition",
    glyph: "i",
    keywords: ["note", "admonition", "callout", "aside"],
  },
  {
    block: "tip",
    title: "Tip",
    hint: "Admonition",
    glyph: "✓",
    keywords: ["tip", "admonition", "callout", "hint"],
  },
  {
    block: "info",
    title: "Info",
    hint: "Admonition",
    glyph: "i",
    keywords: ["info", "admonition", "callout"],
  },
  {
    block: "warning",
    title: "Warning",
    hint: "Admonition",
    glyph: "!",
    keywords: ["warning", "admonition", "callout"],
  },
  {
    block: "caution",
    title: "Caution",
    hint: "Admonition",
    glyph: "!",
    keywords: ["caution", "admonition", "callout"],
  },
  {
    block: "danger",
    title: "Danger",
    hint: "Admonition",
    glyph: "✕",
    keywords: ["danger", "admonition", "callout", "error"],
  },
  {
    block: "source",
    title: "Source",
    hint: "Cite where this comes from",
    glyph: "§",
    keywords: ["source", "citation", "reference", "credit", "book"],
  },
  {
    block: "accordions",
    title: "Accordion",
    hint: "Panels a reader unfolds",
    glyph: "⌄",
    keywords: ["accordion", "panel", "collapse", "expand", "faq", "details"],
    jsx: true,
  },
  {
    block: "steps",
    title: "Steps",
    hint: "A numbered procedure",
    glyph: "①",
    keywords: ["steps", "step", "procedure", "walkthrough", "numbered", "guide"],
    jsx: true,
  },
  {
    block: "tabs",
    title: "Tabs",
    hint: "One thing, several ways",
    glyph: "◫",
    keywords: ["tabs", "tab", "switch", "variant", "alternative", "npm"],
    jsx: true,
  },
  {
    block: "cards",
    title: "Cards",
    hint: "A hand-picked set of links",
    glyph: "⊞",
    keywords: ["cards", "card", "links", "grid", "tiles", "navigation"],
    jsx: true,
  },
  {
    block: "files",
    title: "File tree",
    hint: "A directory, drawn as rows",
    glyph: "└",
    keywords: ["files", "folder", "tree", "directory", "structure"],
    jsx: true,
  },
];

/**
 * Which block a choice makes, for the preview beside the menu.
 *
 * @example previewOf({ picks: "image", … }); // "image"
 * @example previewOf(undefined); // null, for an empty list
 */
function previewOf(item: Item | undefined): PreviewKind | null {
  if (item === undefined) return null;
  if ("block" in item) return item.block;
  if ("picks" in item) return item.picks;
  if ("writes" in item) return null;
  return "markdown";
}

/** An item the reader answers a size for before it is inserted. */
type Sizeable = Extract<Item, { block: InplaceBlock }>;

const DEFAULT_TABLE: GridSize = { rows: 3, cols: 3 };

/**
 * Returns the block one slash-menu choice inserts.
 *
 * The menu only opens in an otherwise empty inline block, so every structural
 * choice starts with the smallest shape its schema accepts and whatever a
 * reader needs in order to see what they just made: two tabs, because a block
 * holding one has nothing to switch between, and a diagram already drawn rather
 * than an empty canvas.
 *
 * @example blockFor("heading2"); // { type: "heading", attrs: { level: 2 } }
 */
export function blockFor(kind: InplaceBlock, size = DEFAULT_TABLE): JSONContent {
  switch (kind) {
    case "paragraph":
      return { type: "paragraph" };

    case "heading2":
    case "heading3":
    case "heading4":
      return { type: "heading", attrs: { level: Number(kind.at(-1)) } };

    case "bulletList":
    case "orderedList":
      return { type: kind, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] };

    case "taskList":
      return {
        type: "bulletList",
        content: [{ type: "listItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }],
      };

    case "blockquote":
      return { type: "blockquote", content: [{ type: "paragraph" }] };

    case "horizontalRule":
      return { type: "horizontalRule" };

    case "codeBlock":
      return { type: "codeBlock", attrs: { language: null } };

    case "whiteboard":
      return { type: "whiteboard", attrs: { src: "", preview: "", scene: "" } };

    case "mermaid":
      return {
        type: "codeBlock",
        attrs: { language: "mermaid" },
        content: [{ type: "text", text: DIAGRAM_TEMPLATES[0].code }],
      };

    case "table":
      return tableOf(size);

    case "videoEmbed":
      return { type: "videoEmbed", attrs: { url: "" } };

    case "linkEmbed":
      return { type: "linkEmbed", attrs: { url: "" } };

    case "accordions":
      return {
        type: "accordions",
        content: [{ type: "accordion", content: [{ type: "paragraph" }] }],
      };

    case "steps":
      return { type: "steps", content: [{ type: "step", content: [{ type: "paragraph" }] }] };

    case "tabs":
      return {
        type: "tabs",
        content: [newTab(), newTab()],
      };

    case "cards":
      return { type: "cards", content: [{ type: "card" }, { type: "card" }] };

    case "files":
      return {
        type: "files",
        content: [{ type: "folder", attrs: { name: "", open: true }, content: [{ type: "file" }] }],
      };

    default:
      return {
        type: "admonition",
        attrs: { kind, title: null },
        content: [{ type: "paragraph" }],
      };
  }
}

function newTab(): JSONContent {
  return { type: "tab", attrs: { label: "" }, content: [{ type: "paragraph" }] };
}

/** An empty table of the chosen size, its first row the header markdown requires. */
function tableOf({ rows, cols }: GridSize): JSONContent {
  const row = (cell: "tableHeader" | "tableCell") => ({
    type: "tableRow",
    content: Array.from({ length: cols }, () => ({
      type: cell,
      content: [{ type: "paragraph" }],
    })),
  });

  return {
    type: "table",
    content: [row("tableHeader"), ...Array.from({ length: rows - 1 }, () => row("tableCell"))],
  };
}

/**
 * Whether the slash and its query are the whole of the line they were typed on.
 *
 * A menu that opened mid-sentence would replace the sentence, so it only opens
 * on a line with nothing else on it. Which line that is depends on the editor:
 * a paragraph of the article is a document of inline content, where the line is
 * the document, and a paragraph inside a callout is one child of a document of
 * blocks, where the line is that child. Asking the caret for its own textblock
 * is the one question that answers both.
 */
function onlyThingOnTheLine(state: EditorState, range: { from: number; to: number }): boolean {
  const { $from } = state.selection;
  const start = $from.depth === 0 ? 0 : $from.start();
  const end = $from.depth === 0 ? state.doc.content.size : $from.end();

  return range.from === start && range.to === end;
}

/**
 * The visible choices matching a slash query, narrowed by what the file can render.
 *
 * A `.md` page compiles without JSX parsing, so an item that writes a tag is
 * dropped rather than shown and left to produce literal angle brackets.
 *
 * @example inplaceChoices({ mdx: true }, "h2").map((item) => item.title); // ["Heading 2"]
 */
export function inplaceChoices({ mdx, inserts = [] }: SlashOptions, query: string): Item[] {
  const needle = query.trim().toLowerCase();
  const own = inserts.map(
    (insert): Item => ({
      writes: insert.source,
      title: insert.title,
      hint: insert.hint,
      glyph: insert.title.slice(0, 1).toUpperCase(),
      keywords: [insert.name.toLowerCase(), "block", "component"],
      jsx: true,
    }),
  );

  return [...ITEMS, ...own].filter(
    (item) =>
      (mdx || !item.jsx) &&
      (needle === "" ||
        item.title.toLowerCase().includes(needle) ||
        item.keywords.some((keyword) => keyword.startsWith(needle))),
  );
}

/** Which way each arrow key nudges the size grid. */
const GRID_STEPS: Record<string, GridSize> = {
  ArrowRight: { rows: 0, cols: 1 },
  ArrowLeft: { rows: 0, cols: -1 },
  ArrowDown: { rows: 1, cols: 0 },
  ArrowUp: { rows: -1, cols: 0 },
};

/**
 * Mounts the menu and owns its keyboard state.
 *
 * The selected index lives in this closure rather than in React, because arrow
 * keys never reach React at all: ProseMirror sees them first and `onKeyDown`
 * swallows them. The table size grid lives here too, as a second face on the
 * same panel rather than a popup of its own, so it inherits the panel's
 * position and its arrow keys are handled in the same place.
 *
 * The panel gets a React root of its own rather than Tiptap's `ReactRenderer`,
 * which registers with an `<EditorContent>` that a directly mounted editor does
 * not have and so draws nothing at all.
 */
function renderMenu() {
  let root: Root | null = null;
  let unmount: (() => void) | null = null;
  let items: Item[] = [];
  let query = "";
  let selected = 0;
  let apply: ((item: Item) => void) | null = null;
  let grid: GridSize | null = null;
  let sizing: Sizeable | null = null;

  const closeGrid = () => {
    grid = null;
    sizing = null;
  };

  const paint = () =>
    flushSync(() =>
      root?.render(
        grid !== null ? (
          <SizeGrid size={grid} onHover={onHover} onCommit={onCommit} />
        ) : (
          <SlashList<Item>
            items={items}
            selected={selected}
            query={query}
            preview={previewOf(items[selected])}
            onSelect={onSelect}
            onPoint={onPoint}
          />
        ),
      ),
    );

  const onSelect = (item: Item) => {
    if (!item.sized || !("block" in item)) {
      apply?.(item);
      return;
    }

    sizing = item;
    grid = DEFAULT_TABLE;
    paint();
  };

  const onPoint = (index: number) => {
    selected = index;
    paint();
  };

  const onHover = (size: GridSize) => {
    grid = size;
    paint();
  };

  const onCommit = (size: GridSize) => {
    if (sizing !== null) apply?.({ ...sizing, size });
  };

  /** Escape here steps back to the list rather than closing the whole menu. */
  const onGridKey = (event: KeyboardEvent) => {
    if (grid === null) return false;

    if (event.key === "Escape") {
      closeGrid();
      paint();
      return true;
    }

    if (event.key === "Enter") {
      onCommit(grid);
      return true;
    }

    const step = GRID_STEPS[event.key];
    if (step === undefined) return false;

    grid = clampSize({ rows: grid.rows + step.rows, cols: grid.cols + step.cols });
    paint();
    return true;
  };

  const absorb = (incoming: SuggestionProps<Item, Item>) => {
    if (incoming.query !== query) closeGrid();
    items = incoming.items;
    query = incoming.query;
    apply = incoming.command;
    selected = Math.min(selected, Math.max(items.length - 1, 0));
  };

  return {
    onStart(incoming: SuggestionProps<Item, Item>) {
      selected = 0;
      closeGrid();
      absorb(incoming);

      const element = document.createElement("div");
      element.className = "z-50";
      root = createRoot(element);
      paint();
      unmount = incoming.mount(element);
    },

    onUpdate(incoming: SuggestionProps<Item, Item>) {
      absorb(incoming);
      paint();
    },

    onKeyDown({ event, view }: SuggestionKeyDownProps) {
      if (grid !== null) return onGridKey(event);

      if (event.key === "Escape") {
        exitSuggestion(view, slashPluginKey);
        return true;
      }
      if (items.length === 0) return false;

      if (event.key === "ArrowDown") {
        selected = (selected + 1) % items.length;
        paint();
        return true;
      }
      if (event.key === "ArrowUp") {
        selected = (selected + items.length - 1) % items.length;
        paint();
        return true;
      }
      const item = items[selected];
      if (event.key === "Enter" && item !== undefined) {
        onSelect(item);
        return true;
      }
      return false;
    },

    onExit() {
      closeGrid();
      root?.unmount();
      root = null;
      unmount?.();
      unmount = null;
    },
  };
}

/**
 * Adds block replacement to an inline in-place editor.
 *
 * The menu opens only when the slash query is the block's whole content, and
 * only where at least one choice fits. This makes replacement literal and keeps
 * a slash in prose, a URL or a table cell ordinary text.
 *
 * @example const extension = inplaceSlash({ mdx: true }, (editor, range, chosen) => …);
 */
export function inplaceSlash(options: SlashOptions, replace: Replace) {
  const fitting = (state: EditorState) => (item: Item) => options.holds?.(item, state) ?? true;

  return Extension.create({
    name: "inplaceSlash",
    priority: 1100,

    addProseMirrorPlugins() {
      return [
        Suggestion<Item, Item>({
          editor: this.editor,
          pluginKey: slashPluginKey,
          char: "/",
          decorationClass: "text-primary",
          items: ({ query, editor }) => inplaceChoices(options, query).filter(fitting(editor.state)),
          command: ({ editor, range, props: item }) => replace(editor, range, item),
          render: renderMenu,
          allow: ({ state, range }) =>
            onlyThingOnTheLine(state, range) && inplaceChoices(options, "").some(fitting(state)),
        }),
      ];
    },
  });
}
