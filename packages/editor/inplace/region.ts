/**
 * One stamped block of the article, and whatever stands in its place as it is edited.
 *
 * A stamp names a slice of the file, and when the page loads exactly one block
 * fills that slice. Pressing Enter puts a second one there and Backspace on a
 * first line takes one away again, so what a stamp owns is a list of blocks
 * rather than a block. The list is printed back joined by blank lines and
 * spliced into the slice whole, which is why nothing here needs a way to name a
 * block the file has never seen: a new block belongs to the stamp above it.
 *
 * A block is never destroyed outright, only retired: its elements stay on the
 * page, hidden, and everything needed to open an editor on them again stays
 * with them. That is what lets one Cmd+Z put back a block the reader merged
 * away, and it is why a move here is written as a pair of opposites rather than
 * as a one-way edit.
 */

import type { Editor, JSONContent, Range } from "@tiptap/core";
import { Selection, type EditorState } from "@tiptap/pm/state";
import { parseDocument } from "../markdown/parse";
import { printBlock } from "../markdown/fromProseMirror";
import { fillable, rewrap } from "../markdown/wrap";
import {
  BLOCKS,
  bodyExtensions,
  dress,
  holdsFor,
  INLINE,
  isBox,
  ITEMS,
  mount,
  planFor,
  TITLE_EXTENSIONS,
  type BlockElements,
} from "./editor";
import { crossBlock, pickKeys, type Moves } from "./keys";
import { listIndent } from "./indent";
import { pageHistory, seat, sit, type Seat } from "./seats";
import { drawBlock, drawSolo, drawStill, type DrawnBlock } from "./drawn";
import { acceptNodeViews, type Portals } from "./portals";
import { isSolo, soloExtensions, soloFor } from "./solo";
import { adoptInto, insideHandles, standsAlone } from "./inside";
import { keepDrawnImages, pickFiles, placeFiles } from "../editor/uploads";
import type { Inplace } from "./context";
import { blockFor, inplaceSlash, type Chosen } from "./slash";
import { inplaceShorthand } from "./shorthand";
import type { BlockOps, BlockSnapshot } from "./handles";
import { blockPaste } from "./blockPaste";
import { applyDraft } from "./draft";
import { rangeIn } from "@jotdown/core/lib/source-range";
import { blocksFrom } from "./pasted";
import { downloadImage, isRemoteImage, landedImage } from "./pastedImages";
import { drawGhosts } from "../editor/ghosts";
import { isEmbed, kindOf, turnInto, type TurnKind } from "./turn";
import { peelWidth, WIDTH, wrapWidth, type BlockWidth } from "@jotdown/core/lib/block-width";

/**
 * One block standing in the stamp's slice, on the page or waiting to come back.
 *
 * Everything here outlives the editor, because a block an undo revives is a new
 * editor on the same elements. What the reader typed is in `content`, where the
 * block stands is in `elements` and `after`, and the chairs are how a change
 * recorded against the old editor reaches the new one.
 */
type Part = {
  /** The parsed node, kept for every attribute nothing here has heard of. */
  block: JSONContent;
  /** A block from the file drawn by its own editor inside the build's markup, so its views draw no frame. */
  inFrame: boolean;
  content: JSONContent[];
  /** A heading's `[#custom-id]`, held aside so the editor never shows it. */
  anchor: string;
  /** A callout's label, which is an attribute rather than content. */
  title: string | null;
  /** What its editor holds, or "" for a block with no editor, a divider being the one. */
  holds: string;
  /** True for a block this plugin drew, whose editor holds the block itself. */
  solo: boolean;
  /**
   * The markup standing for a block no editor here can draw, so a copy of it
   * can be a copy of that markup rather than an approximation of one.
   */
  markup: HTMLElement | null;
  /** We drew its elements, so a teardown takes them off the page again. */
  drawn: boolean;
  /** The part it stands after, which is where an undo puts it back. */
  after: Part | null;
  elements: BlockElements;
  /** The element's own `display`, so hiding and showing it again keeps `contents`. */
  display: string;
  /** How wide it stands, which only a table or an image at the article's top level carries. */
  width: BlockWidth;
  body: Seat;
  /** A callout's second editor, which is a second chair under the one stamp. */
  label: Seat | null;
  leave: Array<() => void>;
  portals: Portals | null;
  /** Gives back the React root a drawn heading or callout renders from. */
  release(): void;
  gone: boolean;
  /** Forgets this part's grip. Outlives every retire, unlike `leave`, so only teardown calls it. */
  leaveHandle(): void;
};

/**
 * Takes over one block's elements, and reports its markdown as it is typed.
 *
 * A block with no in-place editor but an editor of its own, a fence, a table,
 * a `<Steps>`, is drawn by that editor, the same one the slash menu would have
 * given it, inside the frame the build drew, so the page does not move.
 *
 * A block no editor here can draw — a figure, a fence carrying meta — is taken
 * over all the same, just with nothing to type into. Its markup is left
 * exactly as the article drew it and its bytes are what it prints back, so it
 * costs the file nothing; what it gains is a place in the page's registry,
 * which is what lets the grip copy it, duplicate it, delete it and drag it
 * somewhere else like any other block.
 *
 * A `title` element is the callout's label, which is an attribute rather than
 * content and so gets a second, plain-text editor of its own. Both report into
 * the same markdown, because both are parts of the one block the stamp names.
 *
 * A slice written inside `:::wide` or `:::full` is the block inside it, with
 * the width held on its part and put back around it when it prints. No editor
 * ever sees the wrapper.
 *
 * @example const stop = mountBlock({ flow: el, body: el }, "Hi.", console.log, page, "1:1-1:4");
 */
export function mountBlock(
  elements: BlockElements,
  slice: string,
  onChange: (markdown: string | null) => void,
  page: Inplace,
  stamp: string,
  inFrame = true,
): () => void {
  const { width: opening, inner: markdown } = peelWidth(slice);
  const candidate = planFor(markdown);
  const plan = !inFrame && isSolo(candidate?.block.type) ? null : candidate;

  /**
   * A block with no in-place plan whose own editor can draw it all the same.
   *
   * The editor is mounted on the element the block's component handed over,
   * inside the frame the build drew, and its views draw no frame of their own,
   * so the page reads the same before and after the editor arrives.
   */
  const solo = plan === null ? soloFor(markdown) : null;

  /**
   * The block as the deployment drew it, held for the comparison view to show.
   *
   * Only a block with an editor needs one, and it has to be taken before that
   * editor exists, because ProseMirror rewrites the element it was handed. A
   * block with no editor is never rewritten at all, so it is already its own
   * deployed copy and cloning every figure on the page would buy nothing.
   */
  const deployed = plan === null && solo === null ? null : (elements.flow.cloneNode(true) as HTMLElement);
  deployed?.removeAttribute("data-src-range");
  if (deployed !== null) keepDrawnImages(elements.flow, markdown);

  const { roster, history } = page;
  const parts: Part[] = [];
  const inFlight = { busy: 0, total: 0 };
  let closing = false;

  /**
   * Tells the draft what the whole slice reads as now, once per turn.
   *
   * One Cmd+Z can take a block off the page, put another back and rewrite a
   * third, and every one of those says so. Reporting each in turn would walk
   * the draft through states the reader never had, an empty slice among them,
   * so the telling waits for the end of the turn and the draft only ever sees
   * where things landed.
   *
   * What counts as changed is measured against what the slice printed as when
   * it opened, not against the bytes it was cut from. Printing a block back is
   * not the identity it looks like, even with the fill putting the wrapping
   * back: a soft break is a space, the printer writes the space, and the fill
   * lays the words out greedily from the first word rather than the way the
   * author's hand did. Where the author wrapped greedily at the same column,
   * which is most of `docs/`, the lines come back where they were. Where they
   * did not, they move. Against the file a page would therefore arrive with
   * paragraphs already in the draft and the first save would rewrite them;
   * against the opening print it reads as what it is, nothing yet, and a reader
   * who undoes their way back to it gets a clean page again.
   *
   * Nothing is told until that opening print has been taken.
   */
  let telling = false;
  let atOpen: string | null = null;
  const printed = () =>
    parts
      .filter((part) => !part.gone)
      .map((part) => print(settled(part), page.wrap))
      .filter((markdown) => markdown !== "")
      .join("\n\n");

  const report = () => {
    if (atOpen === null || closing || telling) return;
    telling = true;

    queueMicrotask(() => {
      telling = false;
      if (closing) return;

      const now = printed();
      const untouched =
        now === atOpen || (holdsEdits(first) && !first.gone && now === print(settled(first), page.wrap));
      onChange(untouched ? null : now);
    });
  };

  /**
   * Whether this is a project's block as the file wrote it, edited from inside rather than by an editor here.
   *
   * A project's block is drawn by the site. Its props are written into its
   * opening tag and the prose between its tags by editors of their own, each
   * under a stamp inside this one, so its markdown is the slice with those
   * edits laid over it, until its source is rewritten whole.
   */
  let rewritten = false;
  const holdsEdits = (part: Part) =>
    part.after === null && part.markup !== null && part.block.type === "mdxBlock" && !rewritten;

  /**
   * The part with every edit made inside it, which is what printing it or carrying it elsewhere has to take along.
   *
   * @example print(settled(first), page.wrap); // "<Hero title=\"New\" />"
   */
  function settled(part: Part): Part {
    if (!holdsEdits(part)) return part;
    const edited = editedWithin(page, stamp);
    return edited === null ? part : { ...part, block: stillBlock(peelWidth(edited).inner) };
  }

  /**
   * Replaces a project block's whole source, which every edit made inside it gives way to.
   *
   * Recorded, so one Cmd+Z puts the block back as it was, and the edits inside with it.
   */
  function rewrite(part: Part, source: string) {
    const was = { block: part.block, inside: editsWithin(page, stamp) };
    const swap = (block: JSONContent, inside: Map<string, string | null>, whole: boolean) => {
      for (const [inner, markdown] of inside) page.draft.write(inner, markdown);
      part.block = block;
      rewritten = whole;
      report();
    };
    const cleared = new Map([...was.inside.keys()].map((inner) => [inner, null]));

    swap(stillBlock(source), cleared, true);
    history.did({
      undo: () => swap(was.block, was.inside, false),
      redo: () => swap(stillBlock(source), cleared, true),
    });
  }

  const partOf = (editor: Editor) =>
    parts.find((part) => !part.gone && (part.body.editor === editor || part.label?.editor === editor));

  /**
   * The moves the cross-block keys ask for, each undoing as one thing.
   *
   * Stepping the caret is the one that records nothing, because it changes no
   * document. The other three each write to two editors or take a block off the
   * page, which is exactly what the batch is for.
   */
  const moves: Moves = {
    step(editor, direction, keepColumn) {
      const next = roster.beside(editor.view.dom, direction);
      if (next === null) return false;

      next.enter(direction === 1 ? "start" : "end", keepColumn ? caretX(editor) : null);
      return true;
    },

    split: (editor) => history.batch(() => split(editor)),
    merge: (editor) => history.batch(() => mergeBack(editor)),
    unlist: (editor) => history.batch(() => unlist(editor)),
  };

  /**
   * A part as it stands before any of it is placed among its neighbours.
   *
   * The block the stamp arrived with is the only one that stands in elements
   * somebody else drew, which is the whole of what `after` being null means:
   * everything below it in the slice was put there by this module and can be
   * taken away again.
   *
   * That is also what decides whether a block is drawn by its own editor. A
   * callout the article drew is taken over where it stands, so its box stays
   * the reader's; one inserted here has no box to take over and is drawn by
   * the editor's own view. Same type, same markdown, two different jobs.
   */
  function bareParts(
    block: JSONContent,
    after: Part | null,
    drawn: DrawnBlock,
    anchor: string,
    markup: HTMLElement | null = null,
  ): Part {
    const ours = after !== null;
    const solo = markup === null && isSolo(block.type) && (ours || plan === null);
    const framed = solo && !ours && inFrame;

    return {
      block,
      inFrame: framed,
      markup,
      content: solo ? [block] : (block.content ?? []),
      anchor,
      title: stringOrNull(block.attrs?.title),
      holds: solo ? (block.type as string) : (holdsFor(block.type) ?? ""),
      solo,
      drawn: ours,
      after,
      elements: drawn.elements,
      display: drawn.elements.flow.style.display,
      width: "normal",
      body: seat(),
      label: drawn.elements.title ? seat() : null,
      leave: [],
      portals: null,
      release: drawn.release,
      gone: true,
      leaveHandle: () => {},
    };
  }

  /**
   * Puts a part into the article, right after another, and gives it a grip.
   *
   * Putting it into the article is this function's job and happens once, here,
   * rather than in `materialise`: a part that comes back from an undo is still
   * where it always was, only hidden.
   */
  function partFor(
    block: JSONContent,
    after: Part | null,
    drawn: DrawnBlock,
    anchor = "",
    markup: HTMLElement | null = null,
  ): Part {
    const part = bareParts(block, after, drawn, anchor, markup);

    if (after !== null) after.elements.flow.after(drawn.elements.flow);
    parts.splice(after === null ? parts.length : parts.indexOf(after) + 1, 0, part);
    part.leaveHandle = page.handles.join(handleOpsFor(part));
    return part;
  }

  /** The mirror of `partFor`, for the one thing dropping a block above its neighbour needs. */
  function partForBefore(
    block: JSONContent,
    before: Part,
    drawn: DrawnBlock,
    anchor = "",
    markup: HTMLElement | null = null,
  ): Part {
    const part = bareParts(block, before, drawn, anchor, markup);

    before.elements.flow.before(drawn.elements.flow);
    parts.splice(parts.indexOf(before), 0, part);
    part.leaveHandle = page.handles.join(handleOpsFor(part));
    return part;
  }

  /** What this part's grip can do to it, reaching none of this closure's other state directly. */
  function handleOpsFor(part: Part): BlockOps {
    return {
      dom: part.elements.flow,
      box: part.solo && !part.inFrame ? part.elements.body : part.elements.flow,
      markdown: () => print(settled(part), page.wrap),
      accepts: (moved) => standsAlone(moved.block),
      snapshot: () => ({
        block: structuredClone(currentBlock(settled(part))),
        anchor: part.anchor,
        markup: part.markup ?? undefined,
        width: part.width,
      }),
      kind: () => (part.markup === null ? kindOf(currentBlock(part)) : null),
      width: () => (widens(currentBlock(part)) ? part.width : null),
      widen: (width) => widen(part, width),
      adopt: (moved) => adopt(part, moved),
      turnInto: (kind) => turn(part, kind),
      unembed: isEmbed(part.block) ? () => turn(part, "paragraph") : undefined,
      duplicate: () =>
        stand(insert(part, structuredClone(currentBlock(settled(part))), part.anchor, part.markup), part.width),
      rewrite: holdsEdits(part) ? (source) => rewrite(part, source) : undefined,
      insertLine: (edge) => {
        const empty = { type: "paragraph" };
        const line = edge === "before" ? insertBefore(part, empty) : insert(part, empty);

        place(line.body.editor, "start", null);
      },
      remove: () => remove(part),
      dropAfter: (moved) => stand(insert(part, structuredClone(moved.block), moved.anchor, moved.markup), moved.width),
      dropBefore: (moved) =>
        stand(insertBefore(part, structuredClone(moved.block), moved.anchor, moved.markup), moved.width),
    };
  }

  /**
   * Puts a part on the page: shows its elements and opens an editor on them.
   *
   * Runs once when the part is made and again every time an undo brings it
   * back, so nothing here may consume the part. The editor is new each time and
   * carries a schema of its own, which is why the page's record keeps chairs
   * rather than editors.
   */
  function materialise(part: Part) {
    if (!part.gone) return;

    part.gone = false;
    part.elements.flow.style.display = displayFor(part);
    dressWidth(part);

    if (part.holds !== "") {
      openBody(part);
      if (part.elements.title && part.label) openLabel(part, part.label, part.elements.title);
    }

    report();
  }

  /**
   * Takes a part off the page, leaving everything needed to put it back.
   *
   * The elements are hidden rather than removed, whoever drew them. A block the
   * file has was drawn by React, and pulling one of its nodes out would leave
   * React reconciling against a tree that no longer matches; a block this
   * module drew is kept for the undo that may want it. Both are taken away for
   * real at teardown.
   *
   * A caret that was in this block has to go somewhere, and the block above is
   * where a reader who just pressed Backspace or Cmd+Z is looking. A move that
   * knows better, a merge or a slash replacement, places the caret itself
   * afterwards and this one never notices.
   */
  function retire(part: Part) {
    if (part.gone) return;
    part.gone = true;

    const held = [part.body, part.label].some((chair) => chair?.editor?.isFocused);

    part.leave.forEach((leave) => leave());
    part.leave = [];

    for (const chair of [part.body, part.label]) {
      if (chair === null) continue;
      chair.editor?.destroy();
      chair.editor = null;
    }

    part.portals?.release();
    part.portals = null;
    part.elements.flow.style.display = "none";

    if (held && !closing) {
      const back = roster.beside(part.elements.body, -1);
      if (back === null) roster.beside(part.elements.body, 1)?.enter("start", null);
      else back.enter("end", null);
    }

    report();
  }

  /** Opens the editor on the block's own content, which is what a reader types into. */
  function openBody(part: Part) {
    dress(part.elements.body, part.block);

    const extensions = [
      ...(part.solo ? soloExtensions(part.holds, page.uploading, part.inFrame) : bodyExtensions(part.holds)),
      crossBlock(moves),
      ...pickKeys(page),
      pageHistory(history),
      ...(part.block.type === "bulletList" || part.block.type === "orderedList" ? [listIndent(part.block.type)] : []),
      ...(!part.solo && part.holds === INLINE
        ? [
            inplaceSlash({ mdx: page.mdx, inserts: page.inserts }, (editor, range, chosen) =>
              replace(part, editor, range, chosen),
            ),
            inplaceShorthand((editor, block) => becomes(part, editor, null, block)),
            blockPaste({
              place: (editor, blocks) => void pasteArriving(part, editor, blocks),
              upload: (editor, files) => void pasteFiles(part, editor, files),
              embeds: (editor) => page.mdx && part.block.type === "paragraph" && editor.isEmpty,
            }),
          ]
        : [blockPaste()]),
      ...(part.solo || part.holds !== INLINE
        ? [
            inplaceSlash({ mdx: page.mdx, holds: fitsInside }, (editor, _range, chosen) =>
              replaceInside(editor, chosen),
            ),
          ]
        : []),
    ];

    const editor = mount(
      part.elements.body,
      extensions,
      part.content,
      () => {
        part.content = editor.getJSON().content ?? [];
        report();
      },
      (opening) => {
        if (part.holds !== INLINE) {
          part.portals = acceptNodeViews(opening);
          part.elements.flow.append(part.portals.element);
        }
      },
    );

    sit(part.body, editor, history);
    part.leave.push(
      roster.join({
        dom: part.elements.body,
        enter: (edge, x) => place(editor, edge, x),
        absorb: (arriving) => !part.solo && take(editor, arriving),
      }),
      page.selection.join(editor),
      page.editors.join(editor),
    );

    if (part.solo || part.holds !== INLINE) part.leave.push(insideHandles(editor, page.handles));
  }

  /** Adds the plain-text label editor that belongs to a callout. */
  function openLabel(part: Part, chair: Seat, element: HTMLElement) {
    const written = part.title ?? element.textContent ?? "";
    const editor = mount(
      element,
      [...TITLE_EXTENSIONS, pageHistory(history)],
      written === "" ? [] : [{ type: "text", text: written }],
      () => {
        part.title = editor.getText().trim() || null;
        report();
      },
    );

    sit(chair, editor, history);
    part.leave.push(
      roster.join({
        dom: element,
        enter: (edge, x) => place(editor, edge, x),
        absorb: () => false,
      }),
    );
  }

  /**
   * Puts a block the file has never seen into the article, right below another.
   *
   * It joins the same stamp's list rather than getting one of its own, so the
   * whole slice is still printed and spliced as one piece. The reader's own
   * component draws headings and callouts before their editors take them over,
   * and a block the build pipeline would have drawn — a fence, a table, a
   * `<Steps>` — is drawn by its own editor instead until the site is rebuilt.
   */
  function grow(after: Part, block: JSONContent, anchor = "", markup: HTMLElement | null = null): Part {
    const part = partFor(block, after, drawnFor(block, markup), anchor, markup);

    materialise(part);
    return part;
  }

  /** The same, recorded, which is what every move but a file upload wants. */
  function insert(after: Part, block: JSONContent, anchor = "", markup: HTMLElement | null = null): Part {
    const part = grow(after, block, anchor, markup);
    history.did({ undo: () => retire(part), redo: () => materialise(part) });
    return part;
  }

  /** The mirror of `grow`, one position earlier: what a block dropped above its neighbour needs. */
  function growBefore(before: Part, block: JSONContent, anchor = "", markup: HTMLElement | null = null): Part {
    const part = partForBefore(block, before, drawnFor(block, markup), anchor, markup);

    materialise(part);
    return part;
  }

  /** The mirror of `insert`, one position earlier. */
  function insertBefore(before: Part, block: JSONContent, anchor = "", markup: HTMLElement | null = null): Part {
    const part = growBefore(before, block, anchor, markup);
    history.did({ undo: () => retire(part), redo: () => materialise(part) });
    return part;
  }

  /** Takes a part off the page, recorded so one Cmd+Z brings it back. */
  function remove(part: Part) {
    retire(part);
    history.did({ undo: () => materialise(part), redo: () => retire(part) });
  }

  /**
   * Gives a part the width it stood at somewhere else, as part of the move that brought it.
   *
   * Not recorded on its own: the move's undo takes the whole part away, and its
   * redo brings it back still standing at this width.
   */
  function stand(part: Part, width: BlockWidth | undefined) {
    part.width = width ?? "normal";
    dressWidth(part);
    report();
  }

  /** The grip's width, recorded so one Cmd+Z puts the old one back. */
  function widen(part: Part, width: BlockWidth) {
    const was = part.width;
    if (was === width) return;

    stand(part, width);
    history.did({ undo: () => stand(part, was), redo: () => stand(part, width) });
  }

  /**
   * Enter, which either breaks a block in two or leaves a list the reader is in.
   *
   * A document of words carries whatever follows the caret into a new block. A
   * document of list items has its own answer, because a list is left rather
   * than split.
   */
  function split(editor: Editor): boolean {
    const part = partOf(editor);
    if (part === undefined) return false;
    if (part.holds === INLINE) return splitInline(part, editor);
    if (part.holds === ITEMS) return leaveEmptyItem(part, editor);

    const nest = nestOf(part);
    return nest === null ? false : leaveEmptyBlock(part, nest, editor);
  }

  /**
   * Backspace on the first character, which takes this block off the one above.
   *
   * What that means depends on what the block is. A line of prose folds onto
   * the end of its neighbour, which is the merge everybody expects. A quote or
   * a callout has a box around it instead, and what a reader pressing Backspace
   * at the very start of one is asking for is the box taken away rather than
   * the words folded into whatever came before it.
   *
   * An empty line under a block that takes no words, a fence or a table, goes
   * away and leaves the caret at the end of that block.
   */
  function mergeBack(editor: Editor): boolean {
    const part = partOf(editor);
    if (part === undefined || part.body.editor !== editor) return false;

    const nest = nestOf(part);
    if (nest !== null) return unbox(part, nest, editor);
    if (part.holds !== INLINE) return false;
    if (eraseRuleAbove(part)) return true;

    const previous = roster.beside(editor.view.dom, -1);
    if (previous === null) return false;

    if (previous.absorb(editor.state.doc.content.toJSON() ?? [])) {
      remove(part);
      return true;
    }

    if (!editor.isEmpty) return false;

    remove(part);
    previous.enter("end", null);
    return true;
  }

  /**
   * Checks whether the paragraph under the caret sits in a box that can take the chosen block.
   *
   * Uploads replace an entire page block, so they are excluded here. A table
   * cell or a list item is not a box, so a slash typed in one stays text.
   */
  function fitsInside(chosen: Chosen, state: EditorState): boolean {
    if ("picks" in chosen || "pastes" in chosen || "writes" in chosen) return false;

    const { $from } = state.selection;
    if ($from.depth === 0 || $from.parent.type.name !== "paragraph") return false;

    const box = $from.node(-1);
    if (!isBox(box)) return false;

    const type = state.schema.nodes[blockFor(chosen.block, chosen.size).type ?? ""];
    const index = $from.index(-1);
    return type !== undefined && box.canReplaceWith(index, index + 1, type);
  }

  /**
   * The slash menu inside a box, which replaces the line rather than the block.
   *
   * Outside a box the caret's line *is* the part, so choosing an item swaps one
   * block of the page for another. Inside one the part is the box, and what the
   * reader is replacing is the paragraph they are standing in: the box stays,
   * and one of its children becomes something else.
   */
  function replaceInside(editor: Editor, chosen: Chosen) {
    if ("picks" in chosen || "pastes" in chosen || "writes" in chosen) return;

    const block = blockFor(chosen.block, chosen.size);
    if (block.type === undefined || editor.schema.nodes[block.type] === undefined) return;

    history.batch(() => {
      const { state } = editor;
      const { $from } = state.selection;
      const made = editor.schema.nodeFromJSON(block);
      const tr = state.tr.replaceWith($from.before(), $from.after(), made);

      tr.setSelection(Selection.near(tr.doc.resolve($from.before() + 1)));
      editor.view.dispatch(tr.scrollIntoView());
      editor.commands.focus();
    });
  }

  /**
   * Backspace on the first character of the line under a divider, which takes it.
   *
   * A divider has nothing to put a caret in, so the roster of editors steps
   * straight over it and the merge folds this line into the paragraph *above*
   * the rule, leaving the rule sitting between two halves of one sentence. What
   * the reader asked for is the thing immediately behind the caret, and that is
   * the rule.
   *
   * Only a rule. A fence or a table behind the caret is also uneditable and also
   * skipped, and quietly swallowing one on a Backspace is a page-sized edit from
   * a one-character key. Those are picked with a click and deleted on purpose.
   */
  function eraseRuleAbove(part: Part): boolean {
    const before = part.elements.flow.previousElementSibling;
    if (!(before instanceof HTMLElement) || before.tagName !== "HR") return false;

    const ops = page.handles.all().find((one) => one.dom === before);
    if (ops === undefined) return false;

    ops.remove();
    return true;
  }

  /**
   * Enter on the empty last line of a quote or a callout, which leaves the box.
   *
   * The list's own answer one level up. In a document of whole blocks
   * ProseMirror's Enter is a new empty line inside the box and a second press
   * is another one, so there is no way out of a callout with the keyboard at
   * all. This is the way out: the empty line the reader is standing on goes,
   * and a paragraph grows after the whole block for them to carry on in.
   *
   * It declines while the box holds only that one line, because a callout with
   * nothing in it is a callout somebody is about to write in rather than one
   * they are trying to leave.
   */
  function leaveEmptyBlock(part: Part, nest: Nest, editor: Editor): boolean {
    const { $from } = editor.state.selection;
    if ($from.depth !== nest + 1) return false;

    const holder = $from.node(nest);
    if (holder.childCount < 2 || $from.index(nest) !== holder.childCount - 1) return false;
    if (!$from.parent.isTextblock || $from.parent.content.size !== 0) return false;

    editor.commands.deleteRange({ from: $from.before(), to: $from.after() });
    place(insert(part, { type: "paragraph" }).body.editor, "start", null);
    return true;
  }

  /**
   * Backspace at the very start of a quote or a callout, which takes the box away.
   *
   * Every block that was inside becomes a block of the page in its own right,
   * in the order it stood in, and the box goes. The parts model is what makes
   * that cheap: each child is a block arriving, the box is a block leaving, and
   * the whole of it is one entry in the record.
   *
   * A callout's label does not survive, because it is an attribute on the
   * directive and a paragraph has nowhere to keep it. One Cmd+Z brings the
   * whole box back with it, which is the same safety net every other
   * destructive key here has.
   */
  function unbox(part: Part, nest: Nest, editor: Editor): boolean {
    const { $from } = editor.state.selection;
    if ($from.depth !== nest + 1 || $from.index(nest) !== 0 || $from.parentOffset !== 0) {
      return false;
    }

    const inside: JSONContent[] = [];
    $from.node(nest).forEach((child) => inside.push(child.toJSON() as JSONContent));
    if (inside.length === 0) return false;

    history.batch(() => {
      let after = part;
      const grown = inside.map((child) => (after = insert(after, child)));

      remove(part);
      const [first] = grown;
      if (first !== undefined) place(first.body.editor, "start", null);
    });

    return true;
  }

  /**
   * Backspace on the first character of a list item, which is how a list is left.
   *
   * A nested item outdents, which is what a reader expects and what the
   * built-in chain does well. A top-level item has nowhere to outdent to: the
   * document holds list items and nothing else, so lifting one lands its
   * paragraph at a depth the schema forbids, and the chain either throws or
   * quietly pushes the item back in one level deeper than it started.
   */
  function unlist(editor: Editor): boolean {
    const part = partOf(editor);
    if (part === undefined || part.holds !== ITEMS) return false;

    const { $from } = editor.state.selection;
    if ($from.depth > 2) {
      editor.commands.liftListItem("listItem");
      return true;
    }

    return unnest(part, editor, $from.index(0));
  }

  /**
   * Replaces the slash query's whole block with the chosen one.
   *
   * A picture and an attachment are the two that cannot be drawn on the spot:
   * both are a file first, and nothing is put on the page until that file is
   * committed, so cancelling the dialog leaves the block empty rather than
   * holding half an upload. Pasting markdown waits on the clipboard the same way.
   */
  function replace(part: Part, editor: Editor, range: Range, chosen: Chosen) {
    if ("picks" in chosen) {
      void pickInto(part, editor, range, chosen.picks);
      return;
    }

    if ("pastes" in chosen) {
      void pasteInto(part, editor, range);
      return;
    }

    if ("writes" in chosen) {
      becomes(part, editor, range, stillBlock(chosen.writes));
      return;
    }

    becomes(part, editor, range, blockFor(chosen.block, chosen.size));
  }

  /**
   * Turns the block the caret is in into a block of another kind.
   *
   * What the reader asked with is what differs: the slash menu leaves its query
   * standing and names the range to take away, while a typed `- ` is left
   * standing by the rule that saw it and names none. Everything after that is
   * the same, because a block becoming another kind is a block arriving and the
   * one it replaced leaving, both inside the one entry a single Cmd+Z is meant
   * to undo — which, for the shorthand, hands back the line with the marker
   * still on it, exactly as it was typed.
   *
   * A block with nothing to type into, a divider being the one, grows a
   * paragraph under it to put the caret in, or the reader would be left with
   * nowhere to carry on writing.
   */
  function becomes(part: Part, editor: Editor, range: Range | null, block: JSONContent) {
    history.batch(() => {
      if (range !== null) editor.commands.deleteRange(range);

      const next = insert(part, block);
      remove(part);

      const caret = next.holds === "" ? insert(next, blockFor("paragraph")) : next;
      place(caret.body.editor, "start", null);
    });
  }

  /**
   * The grip's "Turn into": this block leaves, and what it became stands in its place.
   *
   * A heading keeps its custom id while it stays a heading. The caret lands at
   * the end of the first block made, where the reader was looking.
   */
  function turn(part: Part, kind: TurnKind) {
    const block = currentBlock(part);
    if (kindOf(block) === kind) return;

    history.batch(() => {
      let after = part;
      const made = turnInto(block, kind).map((block) => {
        const anchor = block.type === "heading" ? part.anchor : "";
        after = insert(after, structuredClone(block), anchor);
        return after;
      });

      remove(part);
      place(made[0]?.body.editor ?? null, "end", null);
    });
  }

  /**
   * Asks for a file, commits it, and puts the block it became where the slash was.
   *
   * Nothing is recorded until the last file is on the page, and then the whole
   * errand is recorded as one change. Grouping it any other way would mean
   * holding the record open across the file dialog and the upload, and whatever
   * the reader typed in another block while they waited would be swept into the
   * same Cmd+Z as the picture.
   */
  async function pickInto(part: Part, editor: Editor, range: Range, kind: "image" | "file") {
    editor.commands.deleteRange(range);
    const nodes: JSONContent[] = [];

    await placeFiles(
      page.uploading,
      inFlight,
      await pickFiles(kind),
      (node) => {
        nodes.push(node);
        return !part.gone;
      },
      (ghosts) => part.elements.flow.after(ghosts),
    );

    if (part.gone || nodes.length === 0) return;

    const made: Part[] = [];
    for (const node of nodes) made.push(grow(made.at(-1) ?? part, node));

    retire(part);
    history.did({
      undo: () => {
        made.forEach(retire);
        materialise(part);
      },
      redo: () => {
        made.forEach(materialise);
        retire(part);
      },
    });

    const newest = made.at(-1);
    if (newest !== undefined) place(newest.body.editor, "end", null);
  }

  /**
   * Reads the clipboard as markdown and puts the blocks it holds where the slash was.
   *
   * Each block is read the way a recovered draft is, so a heading or a table
   * arrives as the same editable block the slash menu would have made. Front
   * matter is dropped, because the page already has its own. A refused or
   * empty clipboard leaves an empty line and says why.
   */
  async function pasteInto(part: Part, editor: Editor, range: Range) {
    editor.commands.deleteRange(range);
    const markdown = await navigator.clipboard.readText().catch(() => null);
    if (part.gone) return;

    const blocks = markdown === null ? [] : blocksFrom(markdown);
    if (blocks.length === 0) {
      const error = markdown === null ? "Clipboard access was blocked." : "The clipboard is empty.";
      page.uploading.onStatus({ busy: 0, total: 0, error });
      return;
    }

    history.batch(() => {
      let after = part;
      for (const { block, anchor } of blocks) after = insert(after, block, anchor);

      remove(part);
      place(after.body.editor, "end", null);
    });
  }

  /**
   * Whole blocks pasted where the caret is, which breaks the line in two around them.
   *
   * Whatever was selected goes, the words before the caret stay where they
   * are, and the words after it carry on below the pasted blocks as a block
   * of the same kind, so a heading broken by a paste is two headings. A paste
   * at the very start of the line leaves no first half, and pasting onto an
   * empty line replaces it. A step means nothing outside its `<Steps>` and is
   * left behind.
   */
  function pasteBlocks(part: Part, editor: Editor, arriving: BlockSnapshot[]) {
    const blocks = arriving.filter(({ block }) => standsAlone(block));
    if (blocks.length === 0) return;

    history.batch(() => {
      const { from, to } = editor.state.selection;
      const { doc } = editor.state;
      const tail = doc.slice(to, doc.content.size).content.toJSON() ?? [];
      const whole = from === 0;

      editor.commands.deleteRange({ from, to: doc.content.size });

      let after = part;
      for (const { block, anchor, markup } of blocks) after = insert(after, block, anchor, markup ?? null);

      const rest =
        tail.length === 0
          ? null
          : insert(after, { type: part.block.type, attrs: part.block.attrs, content: tail }, whole ? part.anchor : "");
      if (whole) remove(part);

      place(rest?.body.editor ?? after.body.editor, rest === null ? "end" : "start", null);
    });
  }

  /**
   * Blocks pasted from another site, its pictures fetched and committed before any of it lands.
   *
   * Each picture is downloaded by the browser and uploaded like a copied
   * one, with a ghost where it will stand. One the site would not hand over
   * becomes an image with no address, which draws as a placeholder saying so.
   * Everything lands together, so one Cmd+Z takes the whole paste away.
   */
  async function pasteArriving(part: Part, editor: Editor, arriving: BlockSnapshot[]) {
    const remote = arriving.filter(({ block }) => isRemoteImage(block));
    if (remote.length === 0) return pasteBlocks(part, editor, arriving);

    const addresses = remote.map(({ block }) => String(block.attrs?.src));
    const ghosts = drawGhosts(addresses, (group) => part.elements.flow.after(group));
    const files = await Promise.all(addresses.map(downloadImage));

    const settled = new Map<BlockSnapshot, JSONContent>();
    for (const [index, snapshot] of remote.entries()) {
      const file = files[index] ?? null;
      const uploaded: JSONContent[] = [];

      if (file !== null) {
        await placeFiles(page.uploading, inFlight, [file], (node) => {
          uploaded.push(node);
          return true;
        });
      }

      settled.set(snapshot, landedImage(uploaded[0], snapshot.block));
    }

    ghosts.clear();
    if (part.gone) return;

    pasteBlocks(
      part,
      editor,
      arriving.map((snapshot) => {
        const block = settled.get(snapshot);
        return block === undefined ? snapshot : { ...snapshot, block };
      }),
    );
  }

  /**
   * Files pasted where the caret is, committed first and then put down the way pasted blocks are.
   *
   * Nothing lands until the last file is committed, so one Cmd+Z takes the
   * whole paste away. A line deleted during the upload takes the paste with it.
   */
  async function pasteFiles(part: Part, editor: Editor, files: File[]) {
    const blocks: BlockSnapshot[] = [];

    await placeFiles(
      page.uploading,
      inFlight,
      files,
      (block) => {
        blocks.push({ block, anchor: "" });
        return !part.gone;
      },
      (ghosts) => part.elements.flow.after(ghosts),
    );

    if (!part.gone) pasteBlocks(part, editor, blocks);
  }

  /**
   * Tab on the blocks below this one: they become the last of its own.
   *
   * A list takes them into its last item, and a quote or a callout at its end.
   * A line of prose holds no blocks, so it declines.
   */
  function adopt(part: Part, moved: BlockSnapshot[]): boolean {
    const editor = part.body.editor;
    if (editor === null) return false;
    if (part.holds === ITEMS) return adoptInto(editor, null, moved);

    const nest = nestOf(part);
    return nest === null ? false : adoptInto(editor, nest === 0 ? null : 0, moved);
  }

  /**
   * Turns one top-level list item into a paragraph, and the items under it into a second list.
   *
   * All three pieces print back into the one slice the stamp names, so a list
   * broken in the middle is still one stamp's worth of markdown and needs no
   * new stamp. An item carrying a sublist is left alone, because its children
   * would have nowhere to go, and the key is swallowed rather than handed back
   * to the chain that breaks it.
   */
  function unnest(part: Part, editor: Editor, index: number): boolean {
    const { doc } = editor.state;
    const item = doc.child(index);
    if (item.childCount !== 1) return true;

    const rest: JSONContent[] = [];
    let itemAt = 0;
    for (let at = 0; at < doc.childCount; at++) {
      if (at < index) itemAt += doc.child(at).nodeSize;
      if (at > index) rest.push(doc.child(at).toJSON());
    }

    const words = item.child(0).content.toJSON() ?? [];
    const paragraph = insert(part, { type: "paragraph", content: words });
    if (rest.length > 0) {
      insert(paragraph, { ...part.block, attrs: continued(part.block, index), content: rest });
    }

    if (index === 0) remove(part);
    else editor.commands.deleteRange({ from: itemAt, to: doc.content.size });

    place(paragraph.body.editor, "start", null);
    return true;
  }

  /** Carries whatever follows the caret down into a new paragraph of its own. */
  function splitInline(part: Part, editor: Editor): boolean {
    const { from } = editor.state.selection;
    const end = editor.state.doc.content.size;
    const tail = editor.state.doc.slice(from, end).content.toJSON() ?? [];

    if (from < end) editor.commands.deleteRange({ from, to: end });
    place(insert(part, { type: "paragraph", content: tail }).body.editor, "start", null);
    return true;
  }

  /**
   * Enter on the empty last item of a list, which is how a reader leaves one.
   *
   * A list's document holds items and nothing else, so ProseMirror's own answer
   * is to lift the item to a place the schema forbids, and the reader is stuck
   * in a list that will not end. Dropping the item and growing a paragraph
   * below the whole list is what they meant by it. A list of one empty item is
   * left alone, since taking that item away would leave no list at all.
   */
  function leaveEmptyItem(part: Part, editor: Editor): boolean {
    const { $from } = editor.state.selection;
    const doc = editor.state.doc;

    if ($from.depth !== 2 || doc.childCount < 2) return false;
    if ($from.index(0) !== doc.childCount - 1) return false;
    if ($from.node(1).textContent !== "" || $from.node(1).childCount !== 1) return false;

    editor.commands.deleteRange({ from: $from.before(1), to: $from.after(1) });
    place(insert(part, { type: "paragraph" }).body.editor, "start", null);
    return true;
  }

  /**
   * The page is leaving: give back every element and every React root, live or not.
   *
   * An element the article drew is handed back showing, the way it was found.
   * Retiring hides it, and the same element is taken over again the moment the
   * page's source changes under it, a refresh after somebody else's commit being
   * what does that: the page re-renders with the new source, and every block is
   * closed and reopened in place. A block reopened
   * over a hidden element records hidden as its natural state and the article
   * goes blank until a reload.
   */
  function dispose(part: Part) {
    retire(part);
    part.leaveHandle();
    part.release();
    if (part.drawn) part.elements.flow.remove();
    else part.elements.flow.style.display = part.display;
  }

  const first = partFor(
    plan?.block ?? solo ?? stillBlock(markdown),
    null,
    { elements, release() {} },
    plan?.anchor ?? "",
    plan === null && solo === null ? elements.flow : null,
  );
  first.width = opening;
  materialise(first);
  atOpen = printed();

  const recovered = page.draft.edits().get(stamp);
  if (recovered !== undefined) {
    history.batch(() => {
      let after = first;
      let keptFirst = false;
      const blocks = parseDocument(recovered).doc.content ?? [];
      for (const [index, written] of blocks.entries()) {
        const { width, block } = unwrapped(written);
        const restored = planFor(printBlock(block));
        const editor = first.body.editor;
        const keepsElement =
          index === 0 &&
          restored &&
          editor &&
          plan &&
          restored.holds === INLINE &&
          restored.block.type === plan.block.type &&
          restored.block.attrs?.level === plan.block.attrs?.level &&
          restored.anchor === plan.anchor;

        if (keepsElement) {
          editor.commands.setContent(restored.block.content ?? []);
          stand(first, width);
          keptFirst = true;
        } else {
          after = insert(
            after,
            restored?.block ?? block,
            restored?.anchor ?? "",
            restored === null && block.attrs?.source === markdown ? elements.flow : null,
          );
          stand(after, width);
        }
      }
      if (!keptFirst) remove(first);
    });
  }

  /**
   * Whether this part is one of the ones on screen right now, as a `display`.
   *
   * While the reader is comparing against the deployment, the only thing shown
   * is what the deployment drew: the clone for a block with an editor, and the
   * block's own untouched element where there is no clone because there was
   * never an editor to take it over.
   */
  function displayFor(part: Part): string {
    const showingCurrent = page.recovery.get().current;
    const isDeployed = deployed === null && part === first;
    const shown = showingCurrent ? isDeployed : !part.gone;

    return shown ? part.display : "none";
  }

  /** Shows the original rendered block while retaining every draft editor and its history. */
  function compare() {
    if (deployed !== null) {
      if (page.recovery.get().current) elements.flow.before(deployed);
      else deployed.remove();
    }

    for (const part of parts) part.elements.flow.style.display = displayFor(part);
  }

  compare();
  const stopComparing = page.recovery.subscribe(compare);
  const stopFollowing = page.draft.subscribe(() => {
    if (holdsEdits(first) && page.draft.edits().has(stamp)) report();
  });

  return () => {
    closing = true;
    stopComparing();
    stopFollowing();
    deployed?.remove();
    parts.forEach(dispose);
  };
}

/**
 * Who draws a block arriving in the article: its own markup, its own editor, or its plain tag.
 *
 * Markup wins wherever there is any, because a block that came with markup is
 * one nothing here can make again: a fence went through Shiki and a table
 * through the core's own frame. What is left is the split phase 7 settled — a
 * block the build would have drawn is drawn by its own editor, everything else
 * by the tag it is written as.
 *
 * @example drawnFor({ type: "paragraph" }, null); // a bare <p> for an editor to take
 */
function drawnFor(block: JSONContent, markup: HTMLElement | null): DrawnBlock {
  if (markup !== null) return drawStill(markup);

  return isSolo(block.type) ? drawSolo() : drawBlock(block);
}

/**
 * A block with no editor, carrying its own bytes rather than a reading of them.
 *
 * Whatever the parse made of it is thrown away in favour of the source itself,
 * so printing this part back is the identity: a table keeps the column widths
 * the author aligned, a fence keeps its meta string, a figure keeps every
 * attribute as typed. All that is kept from the parse is what kind of thing it
 * is, which only matters if the block ever has to be shown without its markup.
 *
 * @example stillBlock("| a | b |\n| - | - |"); // { type: "mdxBlock", attrs: { source: "…" } }
 */
/**
 * The draft's edits that sit inside a stamp's slice without being the stamp itself.
 *
 * @example editsWithin(page, "3:1-9:9"); // Map { "3:1-3:24" => "<Hero title=\"New\">" }
 */
function editsWithin(page: Inplace, stamp: string): Map<string, string> {
  const outer = rangeIn(page.source, stamp);
  const inside = new Map<string, string>();
  if (outer === null) return inside;

  for (const [inner, markdown] of page.draft.edits()) {
    const range = inner === stamp ? null : rangeIn(page.source, inner);
    if (range && range.start >= outer.start && range.end <= outer.end) inside.set(inner, markdown);
  }
  return inside;
}

/**
 * A stamp's slice with the edits made inside it laid over, or null while there are none.
 *
 * @example editedWithin(page, "3:1-5:8"); // "<Hero title=\"New\">\n\nHi.\n\n</Hero>"
 */
function editedWithin(page: Inplace, stamp: string): string | null {
  const outer = rangeIn(page.source, stamp);
  const inside = editsWithin(page, stamp);
  if (outer === null || inside.size === 0) return null;

  const written = applyDraft(page.source, inside);
  return written.slice(outer.start, outer.end + written.length - page.source.length);
}

function stillBlock(markdown: string): JSONContent {
  const [parsed] = parseDocument(markdown).doc.content ?? [];
  const kind = parsed?.type === "mdxBlock" ? parsed.attrs?.kind : undefined;

  return { type: "mdxBlock", attrs: { source: markdown, kind: kind ?? "unknown" } };
}

/**
 * A recovered block with its width taken off, or the block as it was when it has none.
 *
 * The draft is printed slices, so a widened block comes back as the wrapper
 * around it, which the editors keep inert. Reading what is inside again gives
 * back the table or image it was.
 *
 * @example unwrapped({ type: "mdxBlock", attrs: { source: ":::wide\n\n| a |\n| - |\n\n:::" } }); // { width: "wide", block: { type: "table", … } }
 */
function unwrapped(block: JSONContent): { width: BlockWidth; block: JSONContent } {
  const { width, inner } = peelWidth(printBlock(block));
  if (width === "normal") return { width, block };

  const [inside] = parseDocument(inner).doc.content ?? [];
  return inside === undefined ? { width: "normal", block } : { width, block: inside };
}

/**
 * Whether a block can stand wider than the column: a table, or an image on its own.
 *
 * A block with no editor keeps whatever width it was written with when it
 * prints, since its bytes are all anybody knows about it, but is never offered
 * a new one.
 *
 * @example widens({ type: "table" }); // true
 */
function widens(block: JSONContent): boolean {
  return block.type === "table" || block.type === "image";
}

/** Puts a part's width on the element standing for it, which is all the stylesheet reads. */
function dressWidth(part: Part) {
  const { flow } = part.elements;

  if (part.width === "normal") flow.removeAttribute(WIDTH);
  else flow.setAttribute(WIDTH, part.width);
}

/** The second half of a broken list carries on numbering where the first half stopped. */
function continued(block: JSONContent, index: number) {
  if (block.type !== "orderedList") return block.attrs;

  const start = typeof block.attrs?.start === "number" ? block.attrs.start : 1;
  return { ...block.attrs, start: start + index + 1 };
}

/**
 * This part's own content, current as of the reader's last keystroke, ready to
 * stand on its own elsewhere.
 *
 * A solo part's editor holds the block rather than its children, so what it
 * reports back already is the whole block.
 *
 * @example currentBlock(part); // { type: "paragraph", content: [...] }
 */
function currentBlock(part: Part): JSONContent {
  if (part.solo) return part.content[0] ?? part.block;

  return { ...part.block, attrs: { ...part.block.attrs, title: part.title }, content: part.content };
}

/**
 * How deep in an editor's document its own blocks begin.
 *
 * A callout the article drew is taken over where it stands, so the editor's
 * document *is* its body and its blocks are the document's children. A callout
 * this plugin drew is drawn by the editor itself, so the document holds the
 * callout and the blocks are one level further in.
 */
type Nest = 0 | 1;

/**
 * How deep this part's own blocks sit in its editor, or null where it has none.
 *
 * A quote or a callout the article drew is one editor holding that block's
 * body, so the blocks a reader can grab are the document's own children. The
 * same block inserted from the slash menu is drawn by its editor rather than by
 * the article, so the document holds the block itself and its children are one
 * level further in. Everything else — a line of prose, a list, a table, a
 * fence — holds nothing a reader would want to move on its own.
 */
function nestOf(part: Part): Nest | null {
  if (!part.solo) return part.holds === BLOCKS ? 0 : null;
  return NESTS.has(part.holds) ? 1 : null;
}

const NESTS = new Set(["admonition", "blockquote"]);

/**
 * One part as markdown, with everything the parse knew about it put back.
 *
 * The fill is the last thing done to it, and only to prose. A soft break is a
 * space and the printer writes the space, so without this a paragraph the
 * author wrapped over eight lines comes back as one line several hundred
 * characters long and a one-word fix is a whole-paragraph diff.
 */
function print(part: Part, column: number | null): string {
  const block = currentBlock(part);
  const anchor = part.solo ? "" : part.anchor;
  const markdown = printBlock(block);
  const filled = (column !== null && fillable(block) ? rewrap(markdown, column) : markdown) + anchor;

  return wrapWidth(filled, widens(block) || block.type === "mdxBlock" ? part.width : "normal");
}

/**
 * Puts the caret on one edge of an editor, as near the reader's column as the line reaches.
 *
 * `posAtCoords` is what makes a walk down a page feel like one document: the
 * caret lands under where it left rather than at the start of the line. It is
 * asked against the middle of the edge line, so a column past the end of that
 * line comes back as its last position instead of a position in the line below.
 *
 * The focus is taken here and now rather than through Tiptap's `focus` command,
 * which schedules its own `view.focus()` for the next animation frame. A frame
 * is long enough for the block the reader just left to keep the caret, and the
 * next thing they type lands in the wrong block.
 *
 * A null editor is a block with nothing to put a caret in, a divider being the
 * one, and there is nowhere for it to go.
 */
function place(editor: Editor | null, edge: "start" | "end", x: number | null) {
  if (editor === null) return;

  const { view } = editor;
  const { doc } = view.state;

  const home = edge === "start" ? Selection.atStart(doc).from : Selection.atEnd(doc).to;
  const at = x === null ? home : column(editor, home, x);
  const bias = edge === "start" ? 1 : -1;

  view.dispatch(view.state.tr.setSelection(Selection.near(doc.resolve(at), bias)));
  view.focus();
}

function column(editor: Editor, home: number, x: number): number {
  const line = editor.view.coordsAtPos(home);
  const found = editor.view.posAtCoords({ left: x, top: (line.top + line.bottom) / 2 });
  return found === null ? home : found.pos;
}

/**
 * Adds inline content to the end of an editor and leaves the caret at the join.
 *
 * This is the receiving half of a merge. The caret goes where the two blocks
 * met rather than after the arriving words, which is where a reader who just
 * pressed Backspace expects to carry on typing.
 */
function take(editor: Editor, content: JSONContent[]): boolean {
  const end = Selection.atEnd(editor.state.doc).to;

  if (content.length > 0) editor.commands.insertContentAt(end, content, { updateSelection: false });
  editor.commands.setTextSelection(end);
  editor.view.focus();
  return true;
}

/** Where the caret is on screen, so the block below can put its own under it. */
function caretX(editor: Editor): number {
  return editor.view.coordsAtPos(editor.state.selection.from).left;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
