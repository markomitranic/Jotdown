import { cn } from "cn";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { inFrameAt } from "./inFrame";
import { DeletePanel, appendPanel, removePanel } from "./panels";

const NEW_STEP = { type: "step", content: [{ type: "paragraph" }] };

/**
 * A numbered procedure, drawn as the core draws one: a `jd-steps` rail holding `jd-step` children.
 *
 * Inside the rail the build drew, the view is transparent and only the steps
 * stand in it; standing alone it draws the rail itself. The next step's number
 * waits under the last one while the procedure has a caret in it, so a
 * procedure being read is the one the build drew.
 *
 * A step's number is drawn by `jd-step` as an absolutely placed `::before`
 * against the rail, so the step itself must not be positioned; the delete
 * button hangs off an inner wrapper instead.
 */
export function StepsView({ editor, node, getPos }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={cn("group/steps", inFrameAt(editor, getPos()) ? "contents" : "jd-steps my-6")}>
      <NodeViewContent className="contents" />
      {editor.isEditable && <NextStep onClick={() => appendPanel(editor, node, getPos(), NEW_STEP)} />}
    </NodeViewWrapper>
  );
}

/**
 * The next step's number, greyed out on the rail under the last step, which adds that step.
 *
 * It is an `jd-step` of its own, so the rail's counter numbers it and places it
 * exactly where the step it adds will stand. Its content is aligned to the top,
 * because a button centres what it holds and would carry the number halfway down.
 */
function NextStep({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      className={cn(
        "jd-step mt-4 hidden h-8 w-full cursor-pointer items-start [.ProseMirror-focused_&]:flex",
        "before:border before:border-border before:border-dashed before:bg-background! before:text-muted-foreground! before:transition-colors before:content-[counter(step)]",
        "hover:before:border-solid hover:before:bg-secondary! hover:before:text-secondary-foreground!",
      )}
      title="Add step"
      aria-label="Add step"
      contentEditable={false}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    />
  );
}

export function StepView({ editor, getPos, deleteNode }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="jd-step group/step">
      <div className="relative">
        <NodeViewContent className="[&>*>*:last-child]:mb-0" />
        {editor.isEditable && (
          <DeletePanel
            label="Delete this step"
            className="absolute top-0 right-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/step:opacity-100"
            onClick={() => removePanel(editor, getPos(), deleteNode)}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
