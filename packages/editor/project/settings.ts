import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";

/**
 * How a project block's settings are opened from outside it, by the element holding its place on the page.
 *
 * The grip menu belongs to the page rather than to any one block, so each block
 * leaves its opener here while it stands and takes it back when it goes.
 *
 * @example blockSettings.set(wrapper, () => setOpen(true));
 */
export const blockSettings = new WeakMap<Element, () => void>();

/**
 * The settings opener of the block a grip stands for, found on its stamped element or the one it wraps.
 *
 * A grip can hold a wrapper around the block rather than the block, when the block is its only child.
 *
 * @example settingsOf(ops.dom)?.(); // opens that block's settings
 */
export function settingsOf(element: Element) {
  const stamped = element.matches(`[${SOURCE_RANGE}]`) ? element : element.querySelector(`[${SOURCE_RANGE}]`);
  return stamped ? blockSettings.get(stamped) : undefined;
}
