import type { ReactNode } from "react";
import { cn } from "cn";
import { Editable, Slot, defineBlock } from "@jotdown/kit";

/**
 * A project's grid of tiles, for a story to show that each tile, not the editor around it, is what the grid places.
 *
 * @example <Bento><Tile title="One" span="2" /></Bento>
 */
export const Bento = defineBlock(
  ({ children }: { children?: ReactNode }) => (
    <Slot className="not-prose my-8 grid auto-rows-[7rem] grid-cols-3 gap-3">{children}</Slot>
  ),
  { title: "Bento", description: "A grid of tiles" },
);

const SPANS: Record<string, string> = { "1": "col-span-1", "2": "col-span-2", "3": "col-span-3" };

/**
 * One tile of a `Bento`, spanning one to three of its columns.
 *
 * @example <Tile title="Writing" span="2" />
 */
export const Tile = defineBlock(
  ({ title, span = "1" }: { title?: string; span?: string }) => (
    <div className={cn("rounded-xl bg-primary/10 p-4", SPANS[span])}>
      <Editable.Text prop="title" value={title} as="p" className="block font-medium" />
      <p className="mt-1 text-muted-foreground text-xs">Spans {span}</p>
    </div>
  ),
  { title: "Tile", props: { title: { default: "A tile" }, span: { label: "Columns", default: "1" } } },
);
