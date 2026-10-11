import { createElement, isValidElement, type ReactNode } from "react";
import * as lucide from "lucide-react";
import type * as PageTree from "fumadocs-core/page-tree";

/**
 * A page tree that survives `postMessage`, for a canvas to draw the sidebar the studio reads.
 *
 * A tree's icons are React elements, which do not cross a window boundary, so
 * each one travels as the Lucide icon's name and its class and is drawn again
 * on the other side. Everything else in a tree is plain data already.
 */

/** An icon as it travels: the Lucide icon's name, and the class it was drawn with. */
type SerialIcon = { lucide: string; className?: string };

const NAMES = new Map<unknown, string>(
  Object.entries(lucide.icons).map(([name, icon]) => [icon, name] as [unknown, string]),
);

/**
 * A tree with its icons made into names, ready to be posted.
 *
 * @example serializeTree(source.getPageTree()); // the same tree, every icon `{ lucide: "BookOpen" }`
 */
export function serializeTree(tree: PageTree.Root): unknown {
  return mapIcons(tree, (icon) => {
    if (!isValidElement<{ className?: string }>(icon)) return undefined;
    const name = NAMES.get(icon.type);
    return name ? ({ lucide: name, className: icon.props.className } satisfies SerialIcon) : undefined;
  });
}

/**
 * A posted tree with its icons drawn again.
 *
 * @example deserializeTree(message.tree).children[0].icon; // <BookOpen />
 */
export function deserializeTree(data: unknown): PageTree.Root {
  return mapIcons(data, (icon) => {
    const serial = icon as SerialIcon | undefined;
    const Icon = serial?.lucide ? lucide.icons[serial.lucide as keyof typeof lucide.icons] : undefined;
    return Icon ? createElement(Icon, { className: serial?.className }) : undefined;
  }) as PageTree.Root;
}

/** A deep copy of a tree with every `icon` passed through `change`. */
function mapIcons<T>(node: T, change: (icon: unknown) => ReactNode | SerialIcon | undefined): T {
  if (Array.isArray(node)) return node.map((child) => mapIcons(child, change)) as T;
  if (typeof node !== "object" || node === null || isValidElement(node)) return node;

  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    copy[key] = key === "icon" ? change(value) : mapIcons(value, change);
  }
  return copy as T;
}
