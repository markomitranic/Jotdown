"use client";

/**
 * A selection that runs out of one block and into the next, made into a selection of whole blocks.
 *
 * Every block is its own editor, and a browser never lets a selection that
 * started inside one leave it. So the moment a drag leaves the block it started
 * in, the browser's selection is let go and the blocks the drag has passed are
 * selected instead, whole. Dragging back into the first block hands the drag
 * back to the browser, which picks its own selection up again from where it was
 * anchored. Shift with a click does the same from anywhere on the page.
 *
 * A run of blocks answers the keys a run of blocks should: copy, cut and paste
 * carry the blocks themselves, Delete takes them away, Tab nests them in the
 * block above and Shift-Tab takes them back out, the arrows move and grow the
 * run, Enter puts a caret back in it and Escape lets it go.
 */

import type { Editor } from "@tiptap/core";
import type { Inplace } from "./context";
import { blockAt, type BlockOps, type BlockSnapshot } from "./handles";
import { boxOf, handleAt } from "./handleGeometry";
import { blockOf, childrenOf, meant, parentOf, siblingsOf, standing } from "./blockSelection";
import { carriedBlocks, copiedMarkdown, writeBlocks } from "./clipboard";

const EDITABLE = '[contenteditable="true"]';

/** A drag that started inside one block, and whether it has left it yet. */
type Sweep = {
  from: BlockOps;
  /** The editor the drag started in, if it started in one. */
  host: HTMLElement | null;
  /** What the browser's own selection can cover: the editor, or the block it started in. */
  within: HTMLElement;
  crossed: boolean;
  /** Where the pointer last was, for the page scrolling under a pointer that is holding still. */
  x: number;
  y: number;
};

/**
 * Turns selections that cross blocks into block selections, and answers the keys a block selection takes.
 *
 * @example const stop = selectBlocks(articleElement, page);
 */
export function selectBlocks(container: HTMLElement, page: Inplace): () => void {
  const { blocks, handles, history } = page;
  let sweep: Sweep | null = null;
  let swallowClick = false;

  const press = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;

    blocks.clear();

    const from = blockAt(handles, container, event.target);
    if (from === null) return;

    const host = editingHost(event.target);
    sweep = { from, host, within: host ?? from.dom, crossed: false, x: event.clientX, y: event.clientY };

    document.addEventListener("pointermove", drag);
    document.addEventListener("scroll", follow, true);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
  };

  const drag = (move: PointerEvent) => {
    if (sweep === null) return;
    if ((move.buttons & 1) === 0) return release();

    sweep.x = move.clientX;
    sweep.y = move.clientY;
    reach(sweep);
  };

  /** A drag held at the window's edge scrolls the page, and the run keeps growing with it. */
  const follow = () => {
    if (sweep?.crossed) reach(sweep);
  };

  /** Selects every block from where the drag started to the one under the pointer, once it has left the first. */
  const reach = (held: Sweep) => {
    const under = document.elementFromPoint(held.x, held.y);

    if (under !== null && held.within.contains(under)) {
      if (held.crossed) blocks.clear();
      held.crossed = false;
      return;
    }

    if (!held.crossed) page.selection.clear();
    held.crossed = true;
    window.getSelection()?.removeAllRanges();

    const head = (under === null ? null : blockAt(handles, container, under)) ?? nearestTo(held.y);
    if (head !== null) blocks.select(held.from, head);
  };

  const release = () => {
    document.removeEventListener("pointermove", drag);
    document.removeEventListener("scroll", follow, true);
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", release);

    const ended = sweep;
    sweep = null;
    if (ended === null || !ended.crossed) return;

    letGo(ended.host === null ? null : page.editors.owning(ended.host));
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
  };

  /** The article block drawn nearest a window y, for a drag over the gap between two. */
  const nearestTo = (y: number) => {
    let nearest: { ops: BlockOps; gap: number } | null = null;

    for (const ops of siblingsOf(handles, null)) {
      const box = boxOf(ops.box);
      const gap = y < box.top ? box.top - y : Math.max(y - box.bottom, 0);
      if (nearest === null || gap < nearest.gap) nearest = { ops, gap };
    }

    return nearest?.ops ?? null;
  };

  const extend = (event: MouseEvent) => {
    if (!event.shiftKey || event.button !== 0 || !(event.target instanceof Element)) return;

    const clicked = blockAt(handles, container, event.target);
    const caret = caretEditor(container, page);
    const typed = caret === null ? null : blockOf(handles, caretElement(caret));
    const anchor = blocks.anchor() ?? (typed === null ? null : meant(handles, typed));
    if (clicked === null || anchor === null) return;

    const head = meant(handles, clicked);
    if (blocks.get().length === 0 && caret?.view.dom.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    blocks.select(anchor, head);
    letGo(caret);
  };

  /** The click that ends a drag across blocks lands on whatever holds both ends, and must do nothing. */
  const swallow = (event: MouseEvent) => {
    if (!swallowClick) return;

    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const pick = (event: MouseEvent) => {
    if (event.shiftKey || !(event.target instanceof Element)) return;

    const ops = blockAt(handles, container, event.target) ?? handleAt(handles, event.clientX, event.clientY);
    if (ops === null || typeable(ops) || !onFrame(ops, event.target, event.clientX, event.clientY)) return;

    blocks.select(ops);
    letGo(null);
  };

  const key = (event: KeyboardEvent) => {
    if (typing(event.target)) return;

    const command = event.metaKey || event.ctrlKey;
    const letter = event.key.toLowerCase();
    const outside =
      event.target !== document.body && !(event.target instanceof Node && container.contains(event.target));

    if (command && (letter === "z" || letter === "y")) {
      if (outside) return;

      event.preventDefault();
      blocks.clear();
      if (letter === "y" || event.shiftKey) history.redo();
      else history.undo();
      return;
    }

    const selected = blocks.get().filter(standing);
    if (selected.length === 0) return;

    if (command && letter === "a") {
      event.preventDefault();
      blocks.all();
      return;
    }

    if (command || event.altKey) return;

    switch (event.key) {
      case "Escape":
        blocks.clear();
        break;
      case "Backspace":
      case "Delete":
        history.batch(() => selected.forEach((block) => block.remove()));
        blocks.clear();
        break;
      case "ArrowUp":
      case "ArrowDown":
        if (event.shiftKey) blocks.extend(event.key === "ArrowUp" ? -1 : 1);
        else blocks.step(event.key === "ArrowUp" ? -1 : 1);
        reveal(event.key === "ArrowUp" ? blocks.get()[0] : blocks.get().at(-1));
        break;
      case "Enter":
        blocks.clear();
        enter(page, selected.at(-1));
        break;
      case "Tab":
        if (event.shiftKey) outdent(selected);
        else nest(selected);
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  /** Tab: the blocks go into the block above them, at its end, when it is a list or a box. */
  const nest = (selected: BlockOps[]) => {
    const [first] = selected;
    if (first === undefined) return;

    const siblings = siblingsOf(handles, first);
    const above = siblings[siblings.indexOf(first) - 1];
    if (above?.adopt === undefined) return;

    const moved = selected.map((block) => block.snapshot());
    const nested = history.batch(() => {
      if (!above.adopt?.(moved)) return false;

      selected.forEach((block) => block.remove());
      return true;
    });
    if (!nested) return;

    const landed = childrenOf(handles, above).slice(-moved.length);
    const [top] = landed;
    if (top !== undefined && landed.length === moved.length) blocks.select(top, landed.at(-1));
    else blocks.select(above);
  };

  /** Shift-Tab: the first or last blocks of a box come out of it, to stand just before or after it. */
  const outdent = (selected: BlockOps[]) => {
    const [first] = selected;
    if (first === undefined) return;

    const parent = parentOf(handles, first);
    if (parent === null) return;

    const siblings = siblingsOf(handles, first);
    const last = siblings.at(-1) === selected.at(-1);
    if (!last && siblings[0] !== first) return;

    const moved = selected.map((block) => block.snapshot());
    if (moved.some((block) => parent.accepts?.(block) === false)) return;

    history.batch(() => {
      if (last) [...moved].reverse().forEach((block) => parent.dropAfter(block));
      else moved.forEach((block) => parent.dropBefore(block));
      selected.forEach((block) => block.remove());
    });

    const around = siblingsOf(handles, parent);
    const at = around.indexOf(parent);
    const landed = last ? around.slice(at + 1, at + 1 + moved.length) : around.slice(at - moved.length, at);
    const [top] = landed;
    if (top !== undefined) blocks.select(top, landed.at(-1));
    else blocks.clear();
  };

  const copy = (event: ClipboardEvent) => {
    const selected = blocks.get().filter(standing);
    if (selected.length === 0 || typing(event.target) || event.clipboardData === null) return;

    event.preventDefault();
    writeBlocks(event.clipboardData, selected);
    if (event.type !== "cut") return;

    history.batch(() => selected.forEach((block) => block.remove()));
    blocks.clear();
  };

  const paste = (event: ClipboardEvent) => {
    const selected = blocks.get().filter(standing);
    if (selected.length === 0 || typing(event.target) || event.clipboardData === null) return;

    event.preventDefault();
    const copied = copiedMarkdown(event.clipboardData);
    const carried = copied === null ? null : carriedBlocks(copied);
    if (carried !== null) return replace(selected, carried);

    const markdown = copied ?? event.clipboardData.getData("text/plain");
    void import("./pasted").then(({ blocksFrom }) => replace(selected, blocksFrom(markdown)));
  };

  /** Pasting over a block selection: what arrives takes the selected blocks' place. */
  const replace = (selected: BlockOps[], arriving: BlockSnapshot[]) => {
    const last = selected.at(-1);
    if (last === undefined || arriving.length === 0) return;

    if (arriving.some((block) => last.accepts?.(block) === false)) {
      page.uploading.onStatus({ busy: 0, total: 0, error: "Those blocks cannot go here." });
      return;
    }

    history.batch(() => {
      [...arriving].reverse().forEach((block) => last.dropAfter(block));
      selected.forEach((block) => block.remove());
    });
    blocks.clear();
  };

  container.addEventListener("pointerdown", press, true);
  container.addEventListener("mousedown", extend, true);
  container.addEventListener("click", pick, true);
  window.addEventListener("click", swallow, true);
  document.addEventListener("keydown", key, true);
  document.addEventListener("copy", copy, true);
  document.addEventListener("cut", copy, true);
  document.addEventListener("paste", paste, true);

  return () => {
    container.removeEventListener("pointerdown", press, true);
    container.removeEventListener("mousedown", extend, true);
    container.removeEventListener("click", pick, true);
    window.removeEventListener("click", swallow, true);
    document.removeEventListener("keydown", key, true);
    document.removeEventListener("copy", copy, true);
    document.removeEventListener("cut", copy, true);
    document.removeEventListener("paste", paste, true);
    release();
    blocks.clear();
  };
}

/**
 * Takes the caret out of an editor, so the keys a block selection answers reach the page instead.
 *
 * The editor's own selection is collapsed as well, or the formatting bubble
 * would come back over text that is no longer selected the next time the
 * editor reports.
 *
 * @example letGo(editor);
 */
export function letGo(editor: Editor | null) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.isContentEditable) active.blur();

  window.getSelection()?.removeAllRanges();
  if (editor !== null && !editor.isDestroyed) editor.commands.setTextSelection(editor.state.selection.head);
}

/**
 * The element the caret stands in, inside an editor.
 *
 * @example caretElement(editor); // the <p> being typed in
 */
export function caretElement(editor: Editor): Element | null {
  const { node } = editor.view.domAtPos(editor.state.selection.anchor);
  return node instanceof Element ? node : node.parentElement;
}

/** The editor holding the caret, if the caret is in the article. */
function caretEditor(container: HTMLElement, page: Inplace): Editor | null {
  const active = document.activeElement;
  return active !== null && container.contains(active) ? page.editors.owning(active) : null;
}

/** Puts a caret at the end of a block, back in the editor that holds it. */
function enter(page: Inplace, block: BlockOps | undefined) {
  if (block === undefined) return;

  const host = block.dom.closest(EDITABLE) ?? block.dom.querySelector(EDITABLE);
  const editor = host === null ? null : page.editors.owning(host);
  if (editor === null) return;

  const inside = host !== block.dom && host?.contains(block.dom);
  editor.commands.focus(inside ? editor.view.posAtDOM(block.dom, block.dom.childNodes.length) : "end");
}

/** Scrolls a block into view, as little as it takes. */
function reveal(block: BlockOps | undefined) {
  block?.box.scrollIntoView({ block: "nearest" });
}

/** Whether a key or a clipboard event belongs to something being typed in, which keeps it. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

/** The outermost editable element an event landed in, which is one block's editor. */
function editingHost(target: Element): HTMLElement | null {
  let host = target.closest<HTMLElement>(EDITABLE);
  while (host?.parentElement?.closest(EDITABLE)) host = host.parentElement.closest<HTMLElement>(EDITABLE);

  return host;
}

/**
 * Whether this block has somewhere to put a caret, and so answers a key itself.
 *
 * What is left over are the blocks nobody can type in — a divider above all —
 * which is exactly the set that needs picking out with a click before Delete
 * means anything, because a caret is how every other block says "this one".
 */
function typeable(ops: BlockOps): boolean {
  return ops.dom.isContentEditable || ops.dom.querySelector(EDITABLE) !== null;
}

/** How far in from a block's edge a click still counts as taking hold of the frame. */
const FRAME = 8;

/** A block this thin is all frame, a divider being the one. */
const THIN = 12;

/**
 * Whether a click on a block nobody can type in was aimed at the block itself.
 *
 * A fence, a table or a figure is full of things a reader clicks for their own
 * sake: a copy button, a word to select, a link. Picking the whole block on any
 * of those made every one of them dead. So a click picks the block only where
 * the frame is what was clicked: the block's own element rather than something
 * inside it, or a band along its edge.
 *
 * @example onFrame(ops, ops.dom, x, y); // true
 */
function onFrame(ops: BlockOps, target: EventTarget | null, x: number, y: number): boolean {
  if (target === ops.dom || target === ops.box) return true;

  const box = boxOf(ops.box);
  if (box.height <= THIN) return true;

  const inset = x >= box.left + FRAME && x <= box.right - FRAME && y >= box.top + FRAME && y <= box.bottom - FRAME;

  return !inset;
}
