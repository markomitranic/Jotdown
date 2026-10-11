import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import MermaidDiagram from "./MermaidDiagram";

/**
 * Connects an inserted diagram's explicit editor to its ProseMirror node and history.
 * @example ReactNodeViewRenderer(MermaidBlockView);
 */
export default function MermaidBlockView({ node, editor, getPos }: ReactNodeViewProps) {
  const code = node.textContent;

  /** Replaces this fence's source while retaining its language and other attributes. */
  const write = (next: string) => {
    if (next === code) return;
    const pos = getPos();
    if (pos === undefined) return;
    const block = editor.state.doc.nodeAt(pos);
    if (!block) return;

    const from = pos + 1;
    const to = from + block.content.size;
    const tr = editor.state.tr;
    editor.view.dispatch(next === "" ? tr.delete(from, to) : tr.replaceWith(from, to, editor.schema.text(next)));
  };

  return (
    <NodeViewWrapper contentEditable={false}>
      <MermaidDiagram
        code={code}
        onChange={editor.isEditable ? write : undefined}
        onUndo={() => {
          editor.commands.keyboardShortcut("Mod-z");
        }}
        onRedo={() => {
          editor.commands.keyboardShortcut("Shift-Mod-z");
        }}
      />
    </NodeViewWrapper>
  );
}
