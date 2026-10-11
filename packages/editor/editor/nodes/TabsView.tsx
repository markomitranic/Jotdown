import { cn } from "cn";
import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { Plus } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { DeletePanel, PanelLabel } from "./panels";

/** The frame, the bar and the triggers the reading view draws, restated here. */
const FRAME = "my-6 flex flex-col overflow-hidden rounded-xl border border-border bg-secondary";
const BAR = "not-prose flex items-center gap-3.5 overflow-x-auto px-4";
const TRIGGER = "whitespace-nowrap border-b border-transparent py-2 text-sm font-medium transition-colors";
const CURRENT = "border-primary text-primary";
const IDLE = "text-muted-foreground hover:text-accent-foreground";

const NEW_TAB = { type: "tab", attrs: { label: "" }, content: [{ type: "paragraph" }] };

/**
 * The tabs as a reader meets them: one bar, one panel showing at a time.
 *
 * Every control lives in the bar, so the panel below is nothing but the prose
 * that will be published. The tab you are on is an input rather than a button,
 * which is the whole difference between this and the rendered block: you rename
 * a tab by typing in it.
 *
 * Which tab is showing is the wrapper's `active` attribute, and it is never
 * printed. `Tabs` spells that `defaultIndex`, and reading a file's spelling
 * back would mean clicking through the tabs to read them quietly rewrote the
 * page, so clicking here moves nothing but the view.
 */
export function TabsView({ editor, node, getPos }: ReactNodeViewProps) {
  const active: number = node.attrs.active ?? 0;

  const labels: string[] = [];
  node.forEach((tab) => labels.push(tab.attrs.label ?? ""));

  /** Where one panel starts, counted from the wrapper the same way ProseMirror does. */
  const tabPos = (index: number) => {
    const pos = getPos();
    if (pos === undefined) return null;

    let at = pos + 1;
    for (let i = 0; i < index; i += 1) at += node.child(i).nodeSize;
    return at;
  };

  /**
   * Brings one panel to the front, and the caret with it.
   *
   * The caret has to move: left behind in a panel that is now hidden, the next
   * keystroke would type into prose nobody can see. The switch itself is kept
   * out of the undo stack, because it changes nothing that will be saved.
   */
  const show = (index: number) => {
    const pos = getPos();
    const at = tabPos(index);
    if (pos === undefined || at === null) return;

    editor
      .chain()
      .setMeta("addToHistory", false)
      .command(({ tr }) => {
        tr.setNodeAttribute(pos, "active", index);
        return true;
      })
      .focus(at + 1)
      .run();
  };

  const rename = (index: number, label: string) => {
    const at = tabPos(index);
    if (at === null) return;

    editor.commands.command(({ tr }) => {
      tr.setNodeAttribute(at, "label", label);
      return true;
    });
  };

  const append = () => {
    const pos = getPos();
    if (pos === undefined) return;

    editor
      .chain()
      .insertContentAt(pos + node.nodeSize - 1, NEW_TAB)
      .command(({ tr }) => {
        tr.setNodeAttribute(pos, "active", node.childCount);
        return true;
      })
      .focus()
      .run();
  };

  /** The last tab takes the whole block with it: a wrapper holds tabs or nothing. */
  const remove = () => {
    const pos = getPos();
    const at = tabPos(active);
    if (pos === undefined || at === null) return;

    if (node.childCount === 1) {
      editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
      return;
    }

    editor
      .chain()
      .deleteRange({ from: at, to: at + node.child(active).nodeSize })
      .command(({ tr }) => {
        tr.setNodeAttribute(pos, "active", Math.min(active, node.childCount - 2));
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper className={FRAME}>
      <div className={BAR} contentEditable={false}>
        {labels.map((label, index) =>
          index === active ? (
            <PanelLabel
              // biome-ignore lint/suspicious/noArrayIndexKey: tabs have no identity but their place, and a tab's label is what changes
              key={index}
              className={cn(TRIGGER, CURRENT, "field-sizing-content min-w-16 max-w-64")}
              value={label}
              placeholder="Tab label"
              aria-label="Tab label"
              readOnly={!editor.isEditable}
              onChange={(event) => rename(index, event.target.value)}
            />
          ) : (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: tabs have no identity but their place, and a tab's label is what changes
              key={index}
              type="button"
              className={cn(TRIGGER, IDLE)}
              onClick={() => show(index)}
            >
              {label === "" ? "Untitled" : label}
            </button>
          ),
        )}

        {editor.isEditable && (
          <span className="ml-auto flex shrink-0 items-center pl-3">
            <DeletePanel label="Delete this tab" onClick={remove} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              title="Add a tab"
              aria-label="Add a tab"
              contentEditable={false}
              onClick={append}
            >
              <Plus aria-hidden="true" />
            </Button>
          </span>
        )}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

/**
 * One tab: prose, shown when it is the one the bar has to the front.
 *
 * A node view only re-renders when its own node changes, and which tab is
 * showing lives on the wrapper, so the panel reads that back off the editor on
 * every transaction rather than being told.
 */
export function TabView({ editor, getPos }: ReactNodeViewProps) {
  const showing = useShowing(editor, getPos);

  return (
    <NodeViewWrapper className={cn(!showing && "hidden")}>
      <NodeViewContent className="rounded-xl bg-background p-4 [&>*:last-child]:mb-0" />
    </NodeViewWrapper>
  );
}

function useShowing(editor: Editor, getPos: () => number | undefined) {
  const [showing, setShowing] = useState(() => isShowing(editor, getPos));

  useEffect(() => {
    const update = () => setShowing(isShowing(editor, getPos));

    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor, getPos]);

  return showing;
}

/** Whether the tab at a position is the one its tabs block shows, true while it has no position. */
function isShowing(editor: Editor, getPos: () => number | undefined) {
  const pos = getPos();
  if (pos === undefined) return true;

  const $pos = editor.state.doc.resolve(pos);
  return ($pos.parent.attrs.active ?? 0) === $pos.index();
}
