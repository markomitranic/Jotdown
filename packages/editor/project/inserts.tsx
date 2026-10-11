"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { blockMeta, type ProjectBlock } from "@jotdown/kit";
import type { SlashInsert } from "../inplace/slash";
import { withChildren, withProp } from "./tag";

const InsertsContext = createContext<SlashInsert[]>([]);

/**
 * Offers the project's registered blocks in the `/` menu of every editable block below it.
 *
 * @example <ProjectInserts blocks={{ Hero }}><Article /></ProjectInserts>
 */
export function ProjectInserts({ blocks, children }: { blocks: Record<string, ProjectBlock>; children: ReactNode }) {
  const inserts = useMemo(() => insertsOf(blocks), [blocks]);
  return <InsertsContext value={inserts}>{children}</InsertsContext>;
}

/** The project's blocks the `/` menu offers here, none outside a project's canvas. */
export function useProjectInserts() {
  return useContext(InsertsContext);
}

/**
 * Each block registered with `defineBlock`, as the source a fresh one is written with.
 *
 * @example insertsOf({ Hero }); // [{ name: "Hero", title: "Hero", hint: "…", source: '<Hero title="Welcome" />' }]
 */
export function insertsOf(blocks: Record<string, ProjectBlock>): SlashInsert[] {
  return Object.entries(blocks).flatMap(([name, block]) => {
    const meta = blockMeta(block);
    if (!meta) return [];

    let source = `<${name} />`;
    for (const [prop, field] of Object.entries(meta.props ?? {}))
      if (field.default !== undefined) source = withProp(source, prop, field.default);
    if (meta.children) source = withChildren(source, meta.children);

    return [{ name, title: meta.title, hint: meta.description ?? "A block of this project's own", source }];
  });
}
