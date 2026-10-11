import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { cn } from "cn";
import type { Editor } from "@tiptap/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  removeColumn,
  removeRow,
  removeTable,
  tableAt,
  type TableTarget,
} from "./tables";

/** What the delete buttons wear, so one click reads as the destructive one. */
const REMOVE = "hover:text-destructive focus-visible:text-destructive";

/** How thick a grip bar is. */
const GRIP = 10;

/** How wide the little round buttons are, and the lane they sit in. */
const BUBBLE = 16;

/** How far a strip stands off the table's edge, grip and lane together. */
const STRIP = BUBBLE + GRIP;

/** How far past the strips a pointer can stray and still be pointing at the table. */
const REACH = STRIP + 8;

/** Where one column or row starts and stops, measured from the table's own edge. */
type Span = { start: number; size: number };

/** Where a table sits in container coordinates, and how wide it is. */
type Box = { left: number; top: number; width: number };

/** A row and a column, either of which can be unknown. */
type Aim = { row: number | null; col: number | null };

/** Everything the handles need to place themselves, read off the live DOM. */
type Frame = { box: Box; columns: Span[]; rows: Span[]; caret: Aim | null };

/** The three things a strip can ask of its axis. */
type AxisCommands = {
  move(from: number, to: number): void;
  insert(index: number): void;
  remove(index: number): void;
};

type Props = {
  /**
   * The editor a given table belongs to, or null where it belongs to none.
   *
   * One shared document had one editor and could be handed it. A page of
   * separate editors has one per table, and a table the article drew has no
   * editor at all, so the question has to be asked of each table rather than
   * answered once. The same table has to keep answering with the same editor,
   * which is what the measuring loop's own dependency rests on; the function
   * itself may be built fresh on every render.
   */
  editorFor(table: HTMLTableElement): Editor | null;
  /**
   * Takes the whole table off the page, where a table is a block in its own right.
   *
   * In one shared document a table is a node among many and removing it leaves
   * the document around it. In a document whose only content *is* the table,
   * removing the node empties the editor rather than the page, and what is left
   * standing is a blank slot where the table was. So a surface that gives a
   * table a document of its own says here what deleting it really means.
   */
  onDelete?(table: HTMLTableElement): void;
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * The controls that live on a table's own border: drag a row or a column by its
 * grip, add one at any boundary, drop the one you are pointing at.
 *
 * None of this can be rendered inside the table. That DOM belongs to
 * ProseMirror and is rewritten on any transaction, so the whole overlay is a set
 * of absolutely positioned siblings of the editing surface, measured off the
 * real cells with `getBoundingClientRect` and placed against the container. It
 * is the same trick the gutter insert uses, and it means page scrolling cannot
 * drift it: both rects move together.
 *
 * Which table gets the handles is whichever one the pointer is over. Leaving is
 * deliberately forgiving, because the handles themselves sit outside the table
 * and a strict test would take them away the moment you reached for one.
 */
export default function TableHandles({ editorFor, onDelete, containerRef }: Props) {
  const [table, setTable] = useState<HTMLTableElement | null>(null);
  const editor = table === null ? null : editorFor(table);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const track = (event: PointerEvent) => {
      if (dragging.current) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      const over = target?.closest("table");

      if (over instanceof HTMLTableElement && container.contains(over)) {
        setTable(over);
        setAim((was) => pointedCell(target, was));
        return;
      }

      if (table !== null && nearby(table, event.clientX, event.clientY)) return;

      setTable(null);
      setAim(null);
    };

    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [containerRef, table]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (table === null || container === null || editor === null) {
      setFrame(null);
      return;
    }

    const remeasure = () => {
      if (table.isConnected) {
        setFrame(measure(container, table, editor));
        return;
      }

      setTable(null);
    };

    remeasure();

    editor.on("transaction", remeasure);
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);

    return () => {
      editor.off("transaction", remeasure);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [containerRef, editor, table]);

  if (table === null || frame === null || editor === null) return null;

  /**
   * Runs a command against the table under the pointer.
   *
   * The position is resolved at the moment of the click rather than held from
   * when the pointer arrived, so a document that moved on in between cannot
   * send the edit somewhere else. Then it is resolved a second time, because a
   * reorder replaces the whole node and the element we were holding is detached
   * the instant the command runs.
   */
  const apply = (command: (target: TableTarget) => void) => {
    const target = tableAt(editor, table);
    if (target === null) return;

    command(target);
    setTable(tableDom(editor, target.pos));
  };

  const held = (state: boolean) => {
    dragging.current = state;
  };

  const corner = BUBBLE + GRIP / 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-5">
      <ColumnStrip
        box={frame.box}
        spans={frame.columns}
        active={aim?.col ?? frame.caret?.col ?? null}
        offering={onEdge(aim, "row")}
        commands={{
          move: (from, to) => apply((target) => moveColumn(editor, target, from, to)),
          insert: (index) => apply((target) => insertColumn(editor, target, index)),
          remove: (index) => apply((target) => removeColumn(editor, target, index)),
        }}
        onAim={(col) => setAim({ row: null, col })}
        onDragging={held}
      />

      <RowStrip
        box={frame.box}
        spans={frame.rows}
        active={aim?.row ?? frame.caret?.row ?? null}
        offering={onEdge(aim, "col")}
        commands={{
          move: (from, to) => apply((target) => moveRow(editor, target, from, to)),
          insert: (index) => apply((target) => insertRow(editor, target, index)),
          remove: (index) => apply((target) => removeRow(editor, target, index)),
        }}
        onAim={(row) => setAim({ row, col: null })}
        onDragging={held}
      />

      <Bubble
        className="opacity-40 hover:opacity-100 focus-visible:opacity-100"
        style={bubbleAt(frame.box.left - corner, frame.box.top - corner)}
        label="Delete the table"
        onPress={() => {
          if (onDelete === undefined) apply((target) => removeTable(editor, target));
          else onDelete(table);
          setTable(null);
        }}
      >
        &times;
      </Bubble>
    </div>
  );
}

type StripProps = {
  box: Box;
  spans: Span[];
  active: number | null;
  offering: boolean;
  commands: AxisCommands;
  onAim(index: number): void;
  onDragging(state: boolean): void;
};

/**
 * The strip above a table: a grip per column, a `+` at every boundary including
 * the outer two, and a `−` over the column being pointed at.
 *
 * The `+` buttons only come out along the table's top edge, which `offering`
 * decides. Drawn on every hover there were as many of them as there are
 * columns, over prose you were trying to read.
 *
 * A table scrolls sideways inside its own box, so a grip is clipped to the part
 * of its column that is on screen and a boundary that has scrolled out is left
 * out altogether. A handle sitting over the wrong column is worse than no
 * handle. A lone column gets no grip and no `−`: there is nothing to reorder it
 * against, and deleting it would leave a table with no columns.
 */
function ColumnStrip({ box, spans, active, offering, commands, onAim, onDragging }: StripProps) {
  const sensors = useTableSensors();

  const lone = spans.length < 2;
  const grips = lone ? [] : spans.flatMap((span, index) => grippable(span, box.width, index));
  const doomed = deletable(spans, active, lone);

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} {...dragHandlers(commands, onDragging)}>
        <SortableContext items={grips.map((grip) => String(grip.index))} strategy={horizontalListSortingStrategy}>
          {grips.map((grip) => (
            <Grip
              key={grip.index}
              id={String(grip.index)}
              style={{
                left: box.left + grip.start,
                top: box.top - STRIP,
                width: grip.size,
                height: GRIP,
              }}
              label={`Move column ${grip.index + 1}`}
              active={active === grip.index}
              onAim={() => onAim(grip.index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {offering &&
        edges(spans).map((at, index) =>
          onScreen(at, box.width) ? (
            <Bubble
              // biome-ignore lint/suspicious/noArrayIndexKey: an insert bubble is the edge between two columns or rows, named by its place
              key={`insert-${index}`}
              style={bubbleAt(box.left + at, box.top - BUBBLE / 2)}
              label={index === 0 ? "Insert a column before column 1" : `Insert a column after column ${index}`}
              onPress={() => commands.insert(index)}
            >
              +
            </Bubble>
          ) : null,
        )}

      {doomed !== null && onScreen(middle(doomed.span), box.width) ? (
        <Bubble
          className={REMOVE}
          style={bubbleAt(box.left + middle(doomed.span), box.top - BUBBLE / 2)}
          label={`Delete column ${doomed.index + 1}`}
          onPress={() => commands.remove(doomed.index)}
        >
          &minus;
        </Bubble>
      ) : null}
    </>
  );
}

/**
 * The strip down the left of a table, and the one button that sits on its right.
 *
 * Row 0 is the file's header row, so it has no grip, no `−`, and no `+` above
 * it: a row inserted there would become the header on the next save and quietly
 * demote the one that was there. Everything below it is fair game, including a
 * `+` under the last row, which is the only way to append without tabbing
 * through every cell.
 *
 * The `−` sits on the far side of the table from the grip that reveals it, so
 * pointing at any cell in a row counts as pointing at the row. Without that the
 * button would vanish under a pointer on its way over. The `+` buttons are the
 * other way about, and only appear down the table's left edge.
 */
function RowStrip({ box, spans, active, offering, commands, onAim, onDragging }: StripProps) {
  const sensors = useTableSensors();

  const body = spans.slice(1);
  const lane = box.left - BUBBLE / 2;
  const doomed = deletable(spans, active, active === 0);

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} {...dragHandlers(commands, onDragging)}>
        <SortableContext items={body.map((_, at) => String(at + 1))} strategy={verticalListSortingStrategy}>
          {body.map((span, at) => (
            <Grip
              // biome-ignore lint/suspicious/noArrayIndexKey: a row grip is its row number, the same id the sortable list uses
              key={at + 1}
              id={String(at + 1)}
              vertical
              disabled={body.length < 2}
              style={{
                left: box.left - STRIP,
                top: box.top + span.start,
                width: GRIP,
                height: span.size,
              }}
              label={`Move row ${at + 1}`}
              active={active === at + 1}
              onAim={() => onAim(at + 1)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {offering &&
        edges(spans).map((at, index) =>
          index === 0 ? null : (
            <Bubble
              // biome-ignore lint/suspicious/noArrayIndexKey: an insert bubble is the edge between two columns or rows, named by its place
              key={`insert-${index}`}
              style={bubbleAt(lane, box.top + at)}
              label={index === 1 ? "Insert a row below the header row" : `Insert a row below row ${index - 1}`}
              onPress={() => commands.insert(index)}
            >
              +
            </Bubble>
          ),
        )}

      {doomed !== null ? (
        <Bubble
          className={REMOVE}
          style={bubbleAt(box.left + box.width + BUBBLE / 2, box.top + middle(doomed.span))}
          label={`Delete row ${doomed.index}`}
          onPress={() => commands.remove(doomed.index)}
        >
          &minus;
        </Bubble>
      ) : null}
    </>
  );
}

type GripProps = {
  id: string;
  style: CSSProperties;
  label: string;
  active: boolean;
  vertical?: boolean;
  disabled?: boolean;
  onAim(): void;
};

/**
 * The bar you drag to move a row or a column.
 *
 * Travel is locked to the strip's own axis, which is one line of arithmetic on
 * the transform dnd-kit already hands out; `@dnd-kit/modifiers` is not a
 * dependency and does not need to become one. Pointing at a grip is also what
 * makes the row or column active, so its `−` appears without a click.
 *
 * Mousedown is suppressed for the same reason it is on the bubbles: the grip
 * lives outside the contenteditable, and pressing it would otherwise collapse
 * the selection before the drop has anything to act on.
 */
function Grip({ id, style, label, active, vertical, disabled, onAim }: GripProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const travel = transform && (vertical ? { ...transform, x: 0 } : { ...transform, y: 0 });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={cn(
        "pointer-events-auto absolute cursor-grab touch-none rounded-xs border-0 bg-border p-0 transition-colors aria-disabled:cursor-default",
        active && "bg-muted-foreground",
        isDragging && "z-1 cursor-grabbing bg-primary",
      )}
      style={{ ...style, transform: CSS.Translate.toString(travel), transition }}
      title={label}
      aria-label={label}
      onPointerEnter={onAim}
      onMouseDown={(event) => event.preventDefault()}
      {...attributes}
      {...listeners}
    />
  );
}

type BubbleProps = {
  style: CSSProperties;
  label: string;
  className?: string;
  children: ReactNode;
  onPress(): void;
};

/**
 * One of the small round buttons on the table's border.
 *
 * Suppressing mousedown keeps the selection where it is. These live outside the
 * contenteditable, so a plain click would blur it and collapse the very
 * selection the command is about to act on.
 */
function Bubble({ style, label, className, children, onPress }: BubbleProps) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto absolute grid cursor-pointer place-items-center rounded-full border border-border bg-popover p-0 text-muted-foreground text-xs leading-none transition-colors hover:text-foreground focus-visible:text-foreground",
        className,
      )}
      style={style}
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/**
 * The three drag callbacks both strips share.
 *
 * A grip carries its own index as its dnd-kit id, so a drop is two numbers and
 * a call. The flag around it keeps the overlay open for as long as the drag
 * runs: the pointer leaves the table almost immediately once you start pulling
 * a row, and the handles going away underneath it would end the drag nowhere.
 */
function dragHandlers(commands: AxisCommands, onDragging: (state: boolean) => void) {
  return {
    onDragStart: () => onDragging(true),
    onDragCancel: () => onDragging(false),
    onDragEnd: ({ active, over }: DragEndEvent) => {
      onDragging(false);
      if (over && active.id !== over.id) commands.move(Number(active.id), Number(over.id));
    },
  };
}

/** The sidebar's drag idiom: a press stays a click until the pointer moves 4px. */
function useTableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * The table's geometry in container coordinates, or null when it cannot be read.
 *
 * Offsets are relative to the table's visible box rather than the page, so a
 * table scrolled sideways inside its own overflow reports negative starts for
 * the columns that have gone off its left edge, and the callers can drop them.
 */
function measure(container: HTMLElement, table: HTMLTableElement, editor: Editor): Frame | null {
  const head = table.rows[0];
  if (!head || head.cells.length === 0) return null;

  const base = container.getBoundingClientRect();
  const box = table.getBoundingClientRect();

  return {
    box: { left: box.left - base.left, top: box.top - base.top, width: box.width },
    columns: Array.from(head.cells, (cell) => {
      const rect = cell.getBoundingClientRect();
      return { start: rect.left - box.left, size: rect.width };
    }),
    rows: Array.from(table.rows, (row) => {
      const rect = (row.cells[0] ?? row).getBoundingClientRect();
      return { start: rect.top - box.top, size: rect.height };
    }),
    caret: caretCell(editor, table),
  };
}

/**
 * The cell the selection sits in, as indices into this table, or null when the
 * selection is somewhere else entirely.
 *
 * Read off the DOM rather than out of the document, because a cell element
 * already knows its own row and column and everything else here is measured in
 * the DOM anyway. A position the view cannot place is a miss rather than a
 * fault, and this runs from a scroll listener, so it must not throw.
 */
function caretCell(editor: Editor, table: HTMLTableElement): Aim | null {
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const from = node instanceof HTMLElement ? node : node.parentElement;
    const cell = from?.closest("th, td");

    if (!(cell instanceof HTMLTableCellElement) || cell.closest("table") !== table) return null;

    const row = cell.parentElement;
    if (!(row instanceof HTMLTableRowElement)) return null;

    return { row: row.rowIndex, col: cell.cellIndex };
  } catch {
    return null;
  }
}

/**
 * The cell under the pointer, or the aim we already had.
 *
 * This runs on every pointer event, so an unchanged aim comes back as the very
 * object it went in as. A fresh one would rerender the overlay on every pixel of
 * mouse movement.
 */
function pointedCell(target: HTMLElement | null, was: Aim | null): Aim | null {
  const cell = target?.closest("th, td");
  if (!(cell instanceof HTMLTableCellElement)) return was;

  const row = cell.parentElement;
  if (!(row instanceof HTMLTableRowElement)) return was;

  return was?.row === row.rowIndex && was.col === cell.cellIndex ? was : { row: row.rowIndex, col: cell.cellIndex };
}

/**
 * Whether a pointer at these window coordinates still counts as being on the
 * table.
 *
 * Grown by a whole strip and then some on every side. The handles stand outside
 * the table, so a test that asked only about the table itself would drop the
 * overlay as the pointer crossed onto one of its own buttons, and skimming past
 * an edge would make the thing strobe.
 */
function nearby(table: HTMLTableElement, x: number, y: number) {
  const box = table.getBoundingClientRect();

  return x >= box.left - REACH && x <= box.right + REACH && y >= box.top - REACH && y <= box.bottom + REACH;
}

/**
 * Every boundary between spans, indexed by the insert position it stands for.
 *
 * There is one more boundary than there are spans, since both outer edges
 * count: `edges(columns)[0]` is the far left and `edges(columns)[n]` the far
 * right, which are exactly the indices `insertColumn` takes.
 */
function edges(spans: Span[]) {
  const last = spans[spans.length - 1];
  return [...spans.map((span) => span.start), last ? last.start + last.size : 0];
}

/** The middle of a span, which is where its delete button goes. */
function middle(span: Span) {
  return span.start + span.size / 2;
}

/** Whether an offset falls inside the table's visible width, give or take a border. */
function onScreen(at: number, width: number) {
  return at >= -1 && at <= width + 1;
}

/**
 * A span clipped to what is visible, dropped when too little of it is left.
 *
 * A grip narrower than it is thick is not something anybody can grab, and a
 * column that has scrolled nearly out of sight would only offer one. The empty
 * array is what takes it out of the `flatMap` that calls this.
 */
function grippable(span: Span, width: number, index: number) {
  const start = Math.max(span.start, 0);
  const size = Math.min(span.start + span.size, width) - start;

  return size < GRIP ? [] : [{ index, start, size }];
}

/**
 * The span a delete button would act on, or null when there is nothing to
 * delete or nothing that may be deleted.
 *
 * `blocked` is what the two axes disagree about: a lone column has to stay
 * because a table needs one, and row 0 has to stay because markdown has no
 * headerless table.
 */
function deletable(spans: Span[], active: number | null, blocked: boolean) {
  if (active === null || blocked) return null;

  const span = spans[active];
  return span ? { index: active, span } : null;
}

/**
 * Whether the pointer is on the edge of a table that a strip's `+` buttons run
 * along: the header row for the column strip, the first column for the row one.
 *
 * `axis` is the coordinate that has to read zero, which is the other axis from
 * the strip asking. A grip leaves that coordinate null rather than setting it,
 * and null counts, so walking from the header row up onto a column grip does
 * not make the buttons you were reaching for disappear on the way.
 */
function onEdge(aim: Aim | null, axis: "row" | "col") {
  if (aim === null) return false;
  return aim[axis] === 0 || aim[axis] === null;
}

/**
 * The `<table>` a table node renders to, or null when that position no longer
 * holds one.
 *
 * TipTap wraps a table in a scrolling div, so the node's own element is the
 * wrapper and the table is inside it. A position past the end of a document
 * that just lost its table throws rather than returning nothing, which is a
 * miss here rather than a fault.
 */
function tableDom(editor: Editor, pos: number) {
  try {
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return null;

    return dom instanceof HTMLTableElement ? dom : dom.querySelector("table");
  } catch {
    return null;
  }
}

/** A bubble's box, given where its centre goes in container coordinates. */
function bubbleAt(x: number, y: number): CSSProperties {
  return { left: x - BUBBLE / 2, top: y - BUBBLE / 2, width: BUBBLE, height: BUBBLE };
}
