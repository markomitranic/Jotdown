import { cn } from "cn";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import FileAttachment from "@jotdown/core/components/blocks/FileAttachment";
import { ATOM, FIELD, SELECTED } from "./atom";

/** As long as a note stays roughly a sentence, it fits the card without crowding it. */
const NOTE_LIMIT = 200;

/**
 * The attachment while it is being edited: the card, and the two fields on it.
 *
 * The card is the page's own component, so what is on screen here is what a
 * reader gets. A sheet is laid over it because the card is a download link, and
 * a click meant to select the block would otherwise start one.
 *
 * The size, date and link are not editable. They are facts about the file that
 * was uploaded, and letting somebody retype them would only ever make the card
 * disagree with what it points at. Uploading a different file replaces them.
 */
export default function FileAttachmentView({ node, selected, editor, updateAttributes }: ReactNodeViewProps) {
  const { href, name, size, uploadedAt, note } = node.attrs;

  return (
    <NodeViewWrapper
      as="div"
      className={cn(ATOM, "my-6 [&_.jd-file]:m-0", selected && SELECTED)}
      contentEditable={false}
    >
      <div className="relative">
        <FileAttachment href={href} name={name} size={size} uploadedAt={uploadedAt} note={note} />
        <span className="absolute inset-0" />
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        <input
          className={cn(FIELD, "text-sm")}
          value={name}
          placeholder="File name"
          aria-label="File name"
          spellCheck={false}
          readOnly={!editor.isEditable}
          onChange={(event) => updateAttributes({ name: event.target.value })}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <input
          className={cn(FIELD, "text-sm")}
          value={note}
          maxLength={NOTE_LIMIT}
          placeholder="What is this, and why is it here? (optional)"
          aria-label="Note"
          readOnly={!editor.isEditable}
          onChange={(event) => updateAttributes({ note: event.target.value })}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
    </NodeViewWrapper>
  );
}
