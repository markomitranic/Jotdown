import { cn } from "cn";
import { useState } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { ChevronRight, Pin, PinOff } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { inFrameAt } from "./inFrame";
import { AddPanel, DeletePanel, PanelLabel, appendPanel, removePanel } from "./panels";

/** The box the core's `Accordions` draws, class for class. */
const FRAME = "divide-y divide-border overflow-hidden rounded-lg border bg-card";

const ON_HOVER = "opacity-0 transition-opacity group-hover/panel:opacity-100 focus-visible:opacity-100";

const NEW_PANEL = { type: "accordion", content: [{ type: "paragraph" }] };

/**
 * Folded panels, drawn as the build draws them: closed, with a header to open each.
 *
 * Inside the box the build drew the view is transparent and the panels stand
 * in it; standing alone it draws the same box. The row that adds a panel
 * appears only while a caret is in one of them.
 */
export function AccordionsView({ editor, node, getPos }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={cn("group/accordions", inFrameAt(editor, getPos()) ? "contents" : cn(FRAME, "my-6"))}>
      <NodeViewContent className="contents" />
      {editor.isEditable && (
        <AddPanel
          label="Add panel"
          className="hidden border-border border-t group-focus-within/accordions:block [.ProseMirror-focused_&]:block"
          onClick={() => appendPanel(editor, node, getPos(), NEW_PANEL)}
        />
      )}
    </NodeViewWrapper>
  );
}

/**
 * One panel: a header that opens and closes it, and its prose beneath.
 *
 * Whether the panel is open on screen is the reader's, toggled by the chevron
 * the way the built page toggles it. Whether it *starts* open is the block's
 * `open` attribute, which the pin beside the title sets, one panel at a time,
 * and which is what the file records.
 *
 * The box the build drew separates its panels with a rule between children;
 * the view standing between them is transparent, so each panel draws its own
 * rule along the top instead, and the first draws none.
 */
export function AccordionView({ editor, node, getPos, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const startsOpen: boolean = node.attrs.open === true;
  const [expanded, setExpanded] = useState(startsOpen);

  const pinOpen = () => {
    const pos = getPos();
    if (pos === undefined) return;

    const $pos = editor.state.doc.resolve(pos);
    const tr = editor.state.tr;

    $pos.parent.forEach((_panel, offset) => {
      const at = $pos.start() + offset;
      tr.setNodeAttribute(at, "open", !startsOpen && at === pos);
    });

    editor.view.dispatch(tr);
  };

  const pinLabel = startsOpen ? "This panel starts open" : "Start this panel open";

  return (
    <NodeViewWrapper
      className={cn(
        "group/panel scroll-m-24",
        inFrameAt(editor, getPos(), 1) && "border-border border-t first:border-t-0",
      )}
    >
      <h3 className="not-prose flex flex-row items-center font-medium text-card-foreground" contentEditable={false}>
        <button
          type="button"
          className="flex shrink-0 items-center px-3 py-2.5 text-muted-foreground"
          aria-expanded={expanded}
          aria-label={expanded ? "Close this panel" : "Open this panel"}
          onClick={() => setExpanded((open) => !open)}
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
        </button>
        <PanelLabel
          className="flex-1 py-2.5"
          value={node.attrs.title ?? ""}
          placeholder="Panel title"
          aria-label="Panel title"
          readOnly={!editor.isEditable}
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
        {editor.isEditable && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn("text-muted-foreground", ON_HOVER)}
              title={pinLabel}
              aria-label={pinLabel}
              aria-pressed={startsOpen}
              onClick={pinOpen}
            >
              {startsOpen ? <Pin aria-hidden="true" /> : <PinOff aria-hidden="true" />}
            </Button>
            <DeletePanel
              label="Delete this panel"
              className={cn("me-1", ON_HOVER)}
              onClick={() => removePanel(editor, getPos(), deleteNode)}
            />
          </>
        )}
      </h3>
      <NodeViewContent
        className={cn(
          "px-4 pb-2 text-[0.9375rem] [&>*>*:first-child]:mt-0 [&>*>*:last-child]:mb-0",
          !expanded && "hidden",
        )}
      />
    </NodeViewWrapper>
  );
}
