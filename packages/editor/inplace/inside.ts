/**
 * Grips for the blocks standing inside another block: a callout, a quote, a panel, a step.
 *
 * Everywhere else on the page a block is a part: its own editor, its own place
 * in the stamp's list, its own entry in the registry. The blocks inside a
 * callout are not, and cannot be, because a callout is one editor holding one
 * document and its paragraphs are nodes in that document rather than elements
 * anything else owns. That is why a paragraph would not drop into a note and
 * why a fence inside one had no grip.
 *
 * So they are registered as blocks without being made into parts. The registry
 * asks four things of a block — what it reads as, how to copy it, how to take
 * it away, and where to put one arriving — and every one of those is a
 * transaction on the editor that already holds it. A drag between a callout and
 * the article is then two ordinary operations on two different surfaces, folded
 * into the one entry the page's record already folds a move into, and undoing
 * it is undoing both.
 *
 * A position is never held on to. The registry is keyed by element, and an
 * element inside a ProseMirror document outlives any position in it, so every
 * operation asks where its block currently stands at the moment it runs rather
 * than remembering where it stood when the pointer arrived.
 */

import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, type Node } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import { printBlock } from "../markdown/fromProseMirror";
import { isBox, ITEMS } from "./editor";
import type { BlockOps, BlockSnapshot, Handles } from "./handles";
import { kindOf, turnInto, type TurnKind } from "./turn";

type Standing = { node: Node; pos: number };

/**
 * Registers every block standing in a box inside one editor, and keeps the registration current.
 *
 * A box is found wherever it sits, so a callout's paragraphs, an accordion
 * panel's paragraphs and the blocks of a callout inside that panel all get
 * grips of their own.
 *
 * @example part.leave.push(insideHandles(editor, page.handles));
 */
export function insideHandles(editor: Editor, handles: Handles): () => void {
  const joined = new Map<HTMLElement, () => void>();

  const sync = () => {
    const standing = new Set<HTMLElement>();

    for (const { pos } of inside(editor)) {
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) standing.add(dom);
    }

    for (const [dom, leave] of joined) {
      if (standing.has(dom)) continue;
      leave();
      joined.delete(dom);
    }

    for (const dom of standing) {
      if (!joined.has(dom)) joined.set(dom, handles.join(opsFor(editor, dom)));
    }
  };

  sync();
  editor.on("transaction", sync);

  return () => {
    editor.off("transaction", sync);
    joined.forEach((leave) => leave());
    joined.clear();
  };
}

/**
 * Blocks that only mean anything inside their own container, and are grabbed there all the same.
 *
 * A step outside a `<Steps>` is nothing, but inside one it is what a reader reorders.
 */
const ROWS = new Set(["step"]);

/**
 * Whether a block can stand in the article on its own, rather than only inside its container.
 *
 * @example standsAlone({ type: "step" }); // false
 */
export function standsAlone(block: JSONContent): boolean {
  return !ROWS.has(block.type ?? "");
}

/**
 * Every block whose parent is a box, and every step, each with the position it currently stands at.
 *
 * A step's first block is left to the step, whose grip is drawn on the number beside that block's
 * first line, the same spot the block's own grip would take.
 */
function inside(editor: Editor): Standing[] {
  const found: Standing[] = [];

  editor.state.doc.descendants((node, pos, parent, index) => {
    const grabbed = parent !== null && (isBox(parent) || ROWS.has(node.type.name));
    const leads = parent?.type.name === "step" && index === 0;
    if (grabbed && !leads) found.push({ node, pos });
    return !node.isTextblock;
  });

  return found;
}

function opsFor(editor: Editor, dom: HTMLElement): BlockOps {
  const here = (): Standing | null => inside(editor).find((block) => editor.view.nodeDOM(block.pos) === dom) ?? null;

  const put = (moved: BlockSnapshot, edge: "before" | "after") => {
    const block = here();
    if (block === null) return;

    const at = block.pos + (edge === "before" ? 0 : block.node.nodeSize);
    const arriving = fits(editor, at, moved);
    if (arriving !== null) write(editor, at, arriving);
  };

  return {
    dom,
    box: dom,
    markdown: () => {
      const block = here();
      return block === null ? "" : printBlock(block.node.toJSON());
    },
    snapshot: () => ({ block: here()?.node.toJSON() ?? {}, anchor: "" }),
    kind: () => {
      const block = here();
      return block === null ? null : kindOf(block.node.toJSON());
    },
    turnInto: (kind) => {
      const block = here();
      if (block !== null) turn(editor, block, kind);
    },
    accepts: (moved) => {
      const block = here();
      return block !== null && fits(editor, block.pos, moved) !== null;
    },
    adopt: (moved) => {
      const block = here();
      return block !== null && adoptInto(editor, block.pos, moved);
    },
    duplicate: () => {
      const block = here();
      if (block === null) return;

      const { node, pos } = block;
      write(editor, pos + node.nodeSize, node.copy(node.content));
    },
    insertLine: (edge) => {
      const block = here();
      if (block === null) return;

      const at = block.pos + (edge === "before" ? 0 : block.node.nodeSize);
      const { view } = editor;
      const tr = view.state.tr.insert(at, view.state.schema.node("paragraph"));

      view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(at + 1))));
      view.focus();
    },
    remove: () => {
      const block = here();
      if (block === null) return;

      const { view } = editor;
      view.dispatch(view.state.tr.delete(block.pos, block.pos + block.node.nodeSize));
    },
    dropAfter: (moved) => put(moved, "after"),
    dropBefore: (moved) => put(moved, "before"),
  };
}

/**
 * Rewrites one block of a box as another kind, in one transaction, where the box can hold it.
 *
 * The caret is left at the end of what it became, so the next Cmd+Z reaches this editor.
 *
 * @example turn(editor, block, "heading2");
 */
function turn(editor: Editor, { node, pos }: Standing, kind: TurnKind) {
  if (kindOf(node.toJSON()) === kind) return;

  const { state, view } = editor;
  const $at = state.doc.resolve(pos);
  const made = fragmentOf(editor, turnInto(node.toJSON(), kind));

  if (made === null || !$at.parent.canReplace($at.index(), $at.index() + 1, made)) return;

  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, made);
  tr.setSelection(Selection.near(tr.doc.resolve(pos + made.size), -1));
  view.dispatch(tr);
  view.focus();
}

/**
 * Puts blocks at the end of a box, or of a list's last item, reporting whether every one fitted.
 *
 * `at` is where the box or the list stands in the editor's document, or null
 * where the document itself is the box or the list, as it is for a callout or
 * a list the article drew. Nothing is written unless all of them fit.
 *
 * @example adoptInto(editor, null, [paragraph]); // true, and the list's last item has a second paragraph
 */
export function adoptInto(editor: Editor, at: number | null, moved: BlockSnapshot[]): boolean {
  const { state, view } = editor;
  const holder = at === null ? state.doc : state.doc.nodeAt(at);
  if (holder === null) return false;

  const list = holder.type.spec.content === ITEMS || LISTS.has(holder.type.name);
  if (!list && !isBox(holder)) return false;
  if (list && holder.lastChild === null) return false;

  const end = (at === null ? 0 : at + 1) + holder.content.size - (list ? 1 : 0);
  const made = fragmentOf(
    editor,
    moved.map(({ block }) => block),
  );
  const $end = state.doc.resolve(end);
  if (made === null || !$end.parent.canReplace($end.index(), $end.index(), made)) return false;

  view.dispatch(state.tr.insert(end, made));
  return true;
}

const LISTS = new Set(["bulletList", "orderedList"]);

/** The blocks as nodes of this editor's schema, or null where it has never heard of one. */
function fragmentOf(editor: Editor, blocks: JSONContent[]): Fragment | null {
  try {
    return Fragment.from(blocks.map((block) => editor.schema.nodeFromJSON(block)));
  } catch {
    return null;
  }
}

/**
 * Returns the arriving node if the box around a position can hold it there, otherwise null.
 *
 * Validation happens before removing the source block so unsupported content
 * cannot disappear during a move.
 *
 * @example fits(editor, block.pos, moved); // a compatible node, or null
 */
function fits(editor: Editor, at: number, moved: BlockSnapshot): Node | null {
  const $at = editor.state.doc.resolve(at);

  try {
    const node = editor.schema.nodeFromJSON(moved.block);
    node.check();
    return $at.parent.canReplaceWith($at.index(), $at.index(), node.type) ? node : null;
  } catch {
    return null;
  }
}

/**
 * Puts a node into the document, as a node of its own.
 *
 * Whatever arrives here has to be a node this document has not seen before.
 * ProseMirror matches an old child to a new one by object identity first, so
 * handing it the very node that is already standing somewhere would let the
 * copy take the original's element and leave the original with a fresh one,
 * and a move that then removed "the original" would remove the copy instead.
 */
function write(editor: Editor, at: number, node: Node) {
  const { view } = editor;
  view.dispatch(view.state.tr.insert(at, node));
}
