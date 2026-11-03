"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  blockMeta,
  frameworkBlocks,
  type BlockMeta,
  type FrameworkBlock,
  type ProjectBlock,
  type ProjectLayout,
} from "@jotdown/kit";
import type { SlashInsert } from "../inplace/slash";
import { withChildren, withProp } from "./tag";

/**
 * What the editor offers to insert on a page, which its layout decides.
 *
 * The framework's blocks are named, and the project's are written out as the
 * source a fresh one starts as, in the order the layout lists them.
 */
export type Inserts = { framework: ReadonlySet<FrameworkBlock>; project: SlashInsert[] };

const EVERY_FRAMEWORK_BLOCK: ReadonlySet<FrameworkBlock> = new Set(frameworkBlocks);

const InsertsContext = createContext<Inserts>({ framework: EVERY_FRAMEWORK_BLOCK, project: [] });

/**
 * Offers a page's inserts in the `/` menu and Turn into of every editable block below it.
 *
 * Outside a project's canvas there is no layout of the project's to ask, so a
 * page offers every framework block and none of the project's.
 *
 * @example <InsertsProvider value={allInserts({ Hero })}><Article /></InsertsProvider>
 */
export function InsertsProvider({ value, children }: { value: Inserts; children: ReactNode }) {
  return <InsertsContext value={value}>{children}</InsertsContext>;
}

/** What the page being edited offers to insert. */
export function useInserts() {
  return useContext(InsertsContext);
}

/**
 * Every block there is, the framework's and each the project registered with `defineBlock`, as docs and blank offer them.
 *
 * @example allInserts({ Hero }).project.map((insert) => insert.name); // ["Hero"]
 */
export function allInserts(blocks: Record<string, ProjectBlock>): Inserts {
  const project = Object.entries(blocks).flatMap(([name, block]) => {
    const meta = blockMeta(block);
    return meta ? [insertOf(name, meta)] : [];
  });

  return { framework: EVERY_FRAMEWORK_BLOCK, project };
}

/**
 * The blocks one of the project's own layouts lists, and nothing else.
 *
 * A project block is found by its component among the ones the project
 * exports, since that export name is the tag a page writes. A layout without a
 * list, or listing a block nothing exports, is a mistake in the project's code,
 * and throws.
 *
 * @example layoutInserts("profile", defineLayout(Profile, { blocks: ["heading", Role] }), { Role }).project[0].name; // "Role"
 */
export function layoutInserts(name: string, layout: ProjectLayout, blocks: Record<string, ProjectBlock>): Inserts {
  if (!layout.blocks)
    throw new Error(
      `.jotdown/layouts/${name}.tsx lists no blocks. Export it as defineLayout(Layout, { blocks: [...] }), with an empty list for a layout whose pages insert nothing.`,
    );

  const tags = new Map<object, string>(Object.entries(blocks).map(([tag, block]) => [block, tag]));
  const framework = new Set<FrameworkBlock>();
  const project: SlashInsert[] = [];

  for (const listed of layout.blocks) {
    if (typeof listed === "string") {
      framework.add(listed);
      continue;
    }

    const tag = tags.get(listed);
    if (!tag)
      throw new Error(
        `.jotdown/layouts/${name}.tsx lists the block "${listed.block.title}", which no file in .jotdown/components exports.`,
      );

    project.push(insertOf(tag, listed.block));
  }

  return { framework, project };
}

/**
 * A block registered with `defineBlock`, as the source a fresh one is written with.
 *
 * @example insertOf("Hero", { title: "Hero", props: { title: { default: "Welcome" } } }).source; // '<Hero title="Welcome" />'
 */
function insertOf(name: string, meta: BlockMeta): SlashInsert {
  let source = `<${name} />`;
  for (const [prop, field] of Object.entries(meta.props ?? {}))
    if (field.default !== undefined) source = withProp(source, prop, field.default);
  if (meta.children) source = withChildren(source, meta.children);

  return { name, title: meta.title, hint: meta.description ?? "A block of this project's own", source };
}
