/**
 * How a sidebar row is drawn, in the one place both sidebars can read it.
 *
 * Its own module because several components want it: the arranging row, the
 * empty row a new page starts life as, the row a drag is carrying, and the
 * reading sidebar's own separator. A row that sat at a different indent or in a
 * different face while the tree was held would read as the sidebar redrawing
 * itself rather than as the same list, now movable.
 */

/**
 * How far one level of nesting is drawn in, in pixels.
 *
 * The same arithmetic the reading sidebar uses, `calc((2 + 3 * depth) * 4px)`,
 * so a row sits at the exact indent it had a moment ago: the arranging tree
 * replaces the page tree in place and a list that shifted sideways on being
 * held would read as the sidebar redrawing itself.
 *
 * It is also how far sideways a drag has to travel to step one level in or out,
 * so the gap a row is about to land in moves in step with the pointer.
 */
export const DEPTH_STEP = 12;

/** Where the shallowest row starts, which is the padding the stock rows have. */
const INDENT_BASE = 8;

/** @example indentOf(2); // 32 */
export function indentOf(depth: number) {
  return INDENT_BASE + depth * DEPTH_STEP;
}

/** Where the rule that marks one level of nesting is drawn, in pixels. */
export const RULE_AT = 10;

/**
 * One row, wearing the same clothes as the sidebar the reader was just looking at.
 *
 * Spelt out rather than imported because the reading sidebar's own row is a
 * `<Link>` with an active state and no room for controls. The values are
 * the core's: `p-2`, `rounded-lg`, `gap-2`, `wrap-anywhere`, its muted
 * foreground and its `hover:bg-accent/50`, so a row is exactly as tall and
 * wraps exactly where it did before the tree was held.
 */
export const ROW =
  "group/row relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-muted-foreground wrap-anywhere transition-colors hover:bg-accent/50 hover:text-accent-foreground/80 [&_svg]:size-4 [&_svg]:shrink-0";

/** The page you are reading, marked the way the reading sidebar marks it. */
export const HERE = "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary";

/**
 * The small floating toolbar a row's actions sit in.
 *
 * It lies over the end of the label rather than beside it, so a row does not
 * reflow its title every time the pointer passes over it. It stays up while one
 * of its menus is open, which is when the pointer has left the row for the menu.
 */
export const ACTIONS =
  "absolute inset-y-0 end-1 my-auto flex h-6 items-center gap-px rounded-md border border-border bg-popover px-px text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100";

/** One button in that toolbar. */
export const ACTION =
  "flex size-5 cursor-pointer items-center justify-center rounded-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5";
