import { cn } from "cn";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { Link2 } from "lucide-react";
import { SELECTED } from "./atom";
import { inFrameAt } from "./inFrame";
import { AddPanel, DeletePanel, PanelLabel, appendPanel, removePanel } from "./panels";

/** The grid the core's `Cards` draws, and the card its `Card` draws, class for class. */
const GRID = "grid grid-cols-2 gap-3 @container";
const CARD = "block rounded-xl border bg-card p-4 text-card-foreground @max-lg:col-span-full";

const NEW_CARD = { type: "card", attrs: { title: "", description: "", href: "" } };

/**
 * A grid of link cards, drawn as the build draws one.
 *
 * Inside the grid the build drew the view is transparent and the cards stand
 * in that grid; standing alone it draws the same grid. The title and the line
 * under it are fields wearing the card's own type, and the link shows only
 * while a caret is in the card, so a grid being read is the built one.
 */
export function CardsView({ editor, node, getPos }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper
      className={cn("group/cards", inFrameAt(editor, getPos()) ? "contents" : cn(GRID, "not-prose my-6"))}
    >
      <NodeViewContent className="jd-grid-content contents" />
      {editor.isEditable && (
        <AddPanel
          label="Add card"
          className="col-span-full hidden group-focus-within/cards:block [.ProseMirror-focused_&]:block"
          onClick={() => appendPanel(editor, node, getPos(), NEW_CARD)}
        />
      )}
    </NodeViewWrapper>
  );
}

export function CardView({ editor, node, getPos, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { title, description, href } = node.attrs;
  const readOnly = !editor.isEditable;

  return (
    <NodeViewWrapper className={cn(CARD, "group/card relative", selected && SELECTED)} contentEditable={false}>
      <h3 className="not-prose mb-1 font-medium text-sm">
        <PanelLabel
          className="block w-full"
          value={title}
          placeholder="Card title"
          aria-label="Card title"
          readOnly={readOnly}
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
      </h3>
      <p className="my-0! text-muted-foreground text-sm">
        <PanelLabel
          className="block w-full"
          value={description}
          placeholder="One line about it (optional)"
          aria-label="Card description"
          readOnly={readOnly}
          onChange={(event) => updateAttributes({ description: event.target.value })}
        />
      </p>
      <span className="mt-2 hidden items-center gap-1.5 text-muted-foreground group-focus-within/card:flex">
        <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
        <PanelLabel
          className="w-full text-xs"
          value={href}
          placeholder="/where-it-goes"
          aria-label="Card link"
          spellCheck={false}
          readOnly={readOnly}
          onChange={(event) => updateAttributes({ href: event.target.value })}
        />
      </span>

      {editor.isEditable && (
        <DeletePanel
          label="Delete this card"
          className="absolute top-1 right-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100"
          onClick={() => removePanel(editor, getPos(), deleteNode)}
        />
      )}
    </NodeViewWrapper>
  );
}
