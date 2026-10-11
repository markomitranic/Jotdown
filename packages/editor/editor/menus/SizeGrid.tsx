import { cn } from "cn";
import { GRID_MAX } from "../tables";
import type { GridSize } from "../tables";

type Props = {
  size: GridSize;
  onHover(size: GridSize): void;
  onCommit(size: GridSize): void;
};

/** The panel this shares with the list it replaces, so one face swaps for the other. */
const PANEL =
  "max-h-76 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md";

const axis = Array.from({ length: GRID_MAX }, (_, index) => index + 1);

/**
 * The hover-to-size grid, counting the header row as the first row.
 *
 * Every box is a button so a click lands on the size under the pointer, and the
 * shaded rectangle is just "every box up and left of me", which is what makes
 * the whole thing read at a glance.
 *
 * @example <SizeGrid size={{ rows: 3, cols: 3 }} onHover={hover} onCommit={add} />
 */
export function SizeGrid({ size, onHover, onCommit }: Props) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops a click on the panel from taking focus out of the editor
    <div className={cn(PANEL, "w-auto p-2")} onMouseDown={(event) => event.preventDefault()}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${GRID_MAX}, 1fr)` }}>
        {axis.map((rows) =>
          axis.map((cols) => (
            <button
              key={`${rows}-${cols}`}
              type="button"
              aria-label={`${cols} by ${rows}`}
              className={cn(
                "size-4 cursor-pointer rounded-xs border border-border bg-muted",
                rows <= size.rows && cols <= size.cols && "border-primary bg-primary/25",
              )}
              onMouseEnter={() => onHover({ rows, cols })}
              onClick={() => onCommit({ rows, cols })}
            />
          )),
        )}
      </div>
      <p className="mt-2 mb-0 text-sm leading-tight">
        {plural(size.cols, "column")}, {plural(size.rows, "row")}
        <small className="block font-label text-[0.66rem] text-muted-foreground">The first row is the header</small>
      </p>
    </div>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
