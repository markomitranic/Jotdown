import { cn } from "cn";
import type { ComponentProps } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";

/**
 * The parts shared by every block that is a stack of panels.
 *
 * Accordions, steps and tabs are the same shape: a wrapper whose children are
 * the only thing it may hold. A panel is not a top-level block, so the grip in
 * the margin cannot reach one, and each block needs its own way to add and
 * remove one. What a panel's heading looks like is the block's own business;
 * the two commands and the three controls below are not.
 */

/**
 * Adds one more panel at the end of the wrapper.
 *
 * `nodeSize - 1` is the position just inside the closing boundary, which is
 * where the next panel goes.
 */
export function appendPanel(editor: Editor, node: ProseMirrorNode, pos: number | undefined, panel: JSONContent) {
  if (pos === undefined) return;
  editor
    .chain()
    .focus()
    .insertContentAt(pos + node.nodeSize - 1, panel)
    .run();
}

/**
 * Removes one panel, taking the whole block with it when it is the last one.
 *
 * A wrapper holds panels or nothing, so emptying it would leave behind a block
 * the schema cannot keep.
 */
export function removePanel(editor: Editor, pos: number | undefined, deleteNode: () => void) {
  if (pos === undefined) return;

  const $pos = editor.state.doc.resolve(pos);
  if ($pos.parent.childCount > 1) {
    deleteNode();
    return;
  }

  editor.commands.deleteRange({ from: $pos.before(), to: $pos.after() });
}

const FIELD =
  "min-w-0 border-0 bg-transparent text-inherit outline-none placeholder:text-current placeholder:opacity-40";

/**
 * The one-line field a panel's title or label is typed into.
 *
 * The two swallowed events are what keep it a field: ProseMirror sees a
 * mousedown or a keystroke inside its own DOM first, and would move the caret
 * out of the input on the first arrow key. The inherited font is because a form
 * control renders in the OS font otherwise, whatever the heading around it says.
 */
export function PanelLabel({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(FIELD, className)}
      style={{ font: "inherit", letterSpacing: "inherit" }}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      {...props}
    />
  );
}

/** The trash beside one panel. Chrome, so never part of the editable region. */
export function DeletePanel({ label, className, onClick }: { label: string; className?: string; onClick(): void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground", className)}
      title={label}
      aria-label={label}
      contentEditable={false}
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );
}

/**
 * The row under the last panel, where the next one will appear.
 *
 * It shows only while the editor has focus, so a mousedown that blurred the
 * editor would hide the row before its click landed.
 */
export function AddPanel({ label, className, onClick }: { label: string; className?: string; onClick(): void }) {
  return (
    <div className={className} contentEditable={false}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start rounded-none px-3 text-muted-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <Plus aria-hidden="true" />
        {label}
      </Button>
    </div>
  );
}
