import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { WhiteboardPreview } from "@jotdown/core/components/blocks/whiteboard/Preview";
import { whiteboardData } from "@jotdown/core/components/blocks/whiteboard/model";

/** Keeps a whiteboard as one block while its drawing editor manages the scene. */
export const WhiteboardNode = Node.create({
  name: "whiteboard",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: "" }, preview: { default: "" }, scene: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-whiteboard]" }];
  },
  renderHTML() {
    return ["div", { "data-whiteboard": "" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(WhiteboardView);
  },
});

/** Sends drawing changes through the node transaction and the page's undo history. */
function WhiteboardView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper contentEditable={false}>
      <WhiteboardPreview
        data={whiteboardData(node.attrs)}
        edit={
          editor.isEditable
            ? {
                write: updateAttributes,
                alive: () => !editor.isDestroyed,
              }
            : undefined
        }
      />
    </NodeViewWrapper>
  );
}
