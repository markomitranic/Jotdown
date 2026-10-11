import type { ComponentType } from "react";

/**
 * What the editor offers for a project block: its `/` menu entry and its settings.
 *
 * Everything here is optional. A block registered without it is still found by
 * its export name, placed by hand and edited as source.
 */

/** One prop the settings ask for. */
export type BlockField = {
  label?: string;
  /** A picture is picked from disk rather than typed. */
  kind?: "text" | "image";
  /** What a freshly inserted block is written with. */
  default?: string;
};

export type BlockMeta = {
  /** The name in the `/` menu. */
  title: string;
  description?: string;
  props?: Record<string, BlockField>;
  /** The prose a freshly inserted block is written with between its tags. */
  children?: string;
};

/**
 * Gives a block its `/` menu entry and its settings, and hands the same component back.
 *
 * @example export const Hero = defineBlock(HeroBlock, { title: "Hero", props: { title: { default: "Welcome" } } });
 */
export function defineBlock<Props>(component: ComponentType<Props>, meta: BlockMeta) {
  return Object.assign(component, { block: meta });
}

/**
 * The metadata a component was registered with, or null.
 *
 * @example blockMeta(Hero); // { title: "Hero", … }
 */
export function blockMeta(component: unknown): BlockMeta | null {
  if (typeof component !== "function" && typeof component !== "object") return null;
  const meta = (component as { block?: BlockMeta } | null)?.block;
  return meta && typeof meta.title === "string" ? meta : null;
}

/** A component a project wrote, as the framework draws it: any props, all of them from the page. */
export type ProjectBlock = ComponentType<Record<string, unknown>>;

/**
 * The components among a project module's exports, by their export names.
 *
 * Anything else the module exports, its `layouts` and any helper, is left out.
 *
 * @example blocksOf({ Hero, layouts }); // { Hero }
 */
export function blocksOf(module: Record<string, unknown>) {
  const blocks: Record<string, ProjectBlock> = {};
  for (const [name, value] of Object.entries(module)) {
    const component =
      typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);
    if (component && /^[A-Z]/.test(name)) blocks[name] = value as ProjectBlock;
  }
  return blocks;
}
