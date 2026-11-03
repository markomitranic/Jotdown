/**
 * The kit a project's own blocks and layouts are written with.
 *
 * @example import { Editable, Slot, defineBlock, usePage } from "@jotdown/kit";
 */
export {
  BlockScope,
  KitEditorScope,
  KitProvider,
  useEditing,
  useInStudio,
  useIsEditable,
  usePage,
  usePages,
  useSite,
  type KitEditor,
  type KitFields,
  type KitFrontMatterValue,
  type KitNewPage,
  type KitPage,
  type KitPageResult,
  type KitPageSummary,
  type KitSite,
} from "./context";
export { Editable } from "./Editable";
export { Slot } from "./Slot";
export { default as Link } from "fumadocs-core/link";
export { blockMeta, blocksOf, defineBlock, type BlockField, type BlockMeta, type ProjectBlock } from "./define";
export {
  defineLayout,
  frameworkBlocks,
  type FrameworkBlock,
  type LayoutBlock,
  type LayoutProps,
  type ProjectLayout,
} from "./layout";
