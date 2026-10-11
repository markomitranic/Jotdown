import { cn } from "cn";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useState, type ReactNode } from "react";
import { FileIcon, FilePlus, FolderIcon, FolderOpen, FolderPlus, Pin, PinOff } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { SELECTED } from "./atom";
import { inFrameAt } from "./inFrame";
import { AddPanel, DeletePanel, PanelLabel, appendPanel, removePanel } from "./panels";

/** The card the reading view draws around the tree, restated here. */
const FRAME = "not-prose rounded-md border border-border bg-card p-2";

/** One row, file or folder, laid out the way the reading view lays it out. */
/** The row the core draws for a file or a folder, class for class. */
const ROW = "group/row flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4";

/** The indented rail a folder's contents hang off, restated from the reading view. */
const NEST = "ms-2 flex flex-col border-l border-border ps-2";

/** Revealed when the row is pointed at, so a deep tree is rows and not buttons. */
const ON_HOVER = "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100";

const NEW_FILE = { type: "file", attrs: { name: "" } };
const NEW_FOLDER = { type: "folder", attrs: { name: "", open: true } };

/** The wrapper: the tree, and a row for adding to the top of it. */
export function FilesView({ editor, node, getPos }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={cn("group/files", inFrameAt(editor, getPos()) ? "contents" : cn(FRAME, "my-6"))}>
      <NodeViewContent className="contents" />
      {editor.isEditable && (
        <div className="hidden group-focus-within/files:flex [.ProseMirror-focused_&]:flex" contentEditable={false}>
          <AddPanel label="Add file" className="flex-1" onClick={() => appendPanel(editor, node, getPos(), NEW_FILE)} />
          <AddPanel
            label="Add folder"
            className="flex-1"
            onClick={() => appendPanel(editor, node, getPos(), NEW_FOLDER)}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}

export function FolderView({ editor, node, getPos, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const startsOpen: boolean = node.attrs.open === true;
  const [expanded, setExpanded] = useState(startsOpen);
  const pinLabel = startsOpen ? "This folder starts open" : "Start this folder open";

  return (
    <NodeViewWrapper>
      <div className={ROW} contentEditable={false}>
        <button
          type="button"
          className="flex shrink-0 items-center"
          aria-expanded={expanded}
          aria-label={expanded ? "Close this folder" : "Open this folder"}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <FolderOpen aria-hidden="true" /> : <FolderIcon aria-hidden="true" />}
        </button>
        <PanelLabel
          className="flex-1"
          value={node.attrs.name ?? ""}
          placeholder="Folder name"
          aria-label="Folder name"
          spellCheck={false}
          readOnly={!editor.isEditable}
          onChange={(event) => updateAttributes({ name: event.target.value })}
        />
        {editor.isEditable && (
          <>
            <RowAction
              label={pinLabel}
              pressed={startsOpen}
              className={ON_HOVER}
              onClick={() => updateAttributes({ open: !startsOpen })}
            >
              {startsOpen ? <Pin aria-hidden="true" /> : <PinOff aria-hidden="true" />}
            </RowAction>
            <RowAction
              label="Add a file in here"
              className={ON_HOVER}
              onClick={() => appendPanel(editor, node, getPos(), NEW_FILE)}
            >
              <FilePlus aria-hidden="true" />
            </RowAction>
            <RowAction
              label="Add a folder in here"
              className={ON_HOVER}
              onClick={() => appendPanel(editor, node, getPos(), NEW_FOLDER)}
            >
              <FolderPlus aria-hidden="true" />
            </RowAction>
            <DeletePanel
              label="Delete this folder"
              className={cn("size-5", ON_HOVER)}
              onClick={() => removeEntry(editor, getPos(), deleteNode)}
            />
          </>
        )}
      </div>
      <NodeViewContent className={cn(NEST, !expanded && "hidden")} />
    </NodeViewWrapper>
  );
}

export function FileView({ editor, node, getPos, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className={cn(ROW, selected && SELECTED)} contentEditable={false}>
      <FileIcon className="shrink-0" aria-hidden="true" />
      <PanelLabel
        className="flex-1"
        value={node.attrs.name ?? ""}
        placeholder="File name"
        aria-label="File name"
        spellCheck={false}
        readOnly={!editor.isEditable}
        onChange={(event) => updateAttributes({ name: event.target.value })}
      />
      {editor.isEditable && (
        <DeletePanel
          label="Delete this file"
          className={cn("size-5", ON_HOVER)}
          onClick={() => removeEntry(editor, getPos(), deleteNode)}
        />
      )}
    </NodeViewWrapper>
  );
}

/**
 * Removes one row, and the whole block with it when `<Files>` would be emptied.
 *
 * A folder may hold nothing, so clearing one out leaves its row standing. The
 * wrapper may not, and that is the case `removePanel` already covers.
 */
function removeEntry(editor: Editor, pos: number | undefined, deleteNode: () => void) {
  if (pos === undefined) return;

  if (editor.state.doc.resolve(pos).parent.type.name === "files") {
    removePanel(editor, pos, deleteNode);
    return;
  }

  deleteNode();
}

/** One icon-sized action on a row. Chrome, so never part of the editable region. */
function RowAction({
  label,
  className,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("size-5 shrink-0 text-muted-foreground", className)}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      contentEditable={false}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
