import { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { ReactNodeViewProps } from "@tiptap/react";
import { ImageUp } from "lucide-react";
import DocImage from "@jotdown/core/components/blocks/DocImage";
import MissingImage from "@jotdown/core/components/blocks/MissingImage";
import { isPlaceholder, pickFiles, placeFiles, previewSrc, type Uploading } from "../uploads";

/**
 * A picture in the editor, drawn by the component that draws a picture on the page.
 *
 * `DocImage` is what a markdown image renders through on the built page: the
 * frame, the height cap, the click-to-zoom, the toolbar and the caption under
 * it. Drawing the editor's image with the same component is what makes a
 * picture look the same before and after the editor arrives, and the same
 * whether it came from the file or was just dropped in. An upload still on its
 * way shows the local stand-in until its committed address resolves.
 *
 * The editor adds two controls to the front of the toolbar: the alt text, and
 * replacing the picture with another file, which keeps the alt text and the
 * caption. An image with no address, which a failed upload leaves behind, is a
 * placeholder that opens the file picker when clicked.
 *
 * @example addNodeView: () => ReactNodeViewRenderer(ImageView)
 */
export default function ImageView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const wrapper = useRef<HTMLElement>(null);
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const title = typeof node.attrs.title === "string" && node.attrs.title !== "" ? node.attrs.title : undefined;
  const shown = previewSrc(src) ?? src;

  const uploading = uploadingOf(editor);
  const pick = uploading
    ? () => void pickImage(editor, uploading, wrapper.current, (next) => updateAttributes({ src: next }))
    : undefined;

  const tools = (
    <>
      <AltText alt={alt} onChange={(next) => editor.isEditable && updateAttributes({ alt: next })} />
      {pick && (
        <button type="button" title="Replace image" aria-label="Replace image" onClick={pick}>
          <ImageUp aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <NodeViewWrapper ref={wrapper} as="span" className="contents">
      {shown === "" ? (
        <MissingImage alt={alt} reason="downloaded" onPick={pick} />
      ) : (
        <DocImage src={shown} alt={alt} title={title} tools={tools} />
      )}
    </NodeViewWrapper>
  );
}

/**
 * The alt text, as a button that turns into the field it is typed in.
 *
 * Enter or leaving the field keeps what was typed, and Escape puts it back. The
 * two swallowed events keep ProseMirror from taking the caret out of the field.
 */
function AltText({ alt, onChange }: { alt: string; onChange(alt: string): void }) {
  const [writing, setWriting] = useState(false);

  if (!writing) {
    return (
      <button type="button" title={alt || "No alt text yet"} onClick={() => setWriting(true)}>
        Alt
      </button>
    );
  }

  const finish = (next: string) => {
    setWriting(false);
    if (next.trim() !== alt) onChange(next.trim());
  };

  return (
    <input
      className="jd-shot__field"
      defaultValue={alt}
      placeholder="Describe the picture"
      aria-label="Alt text"
      // biome-ignore lint/a11y/noAutofocus: the field only exists because its button was just pressed
      autoFocus
      onBlur={(event) => finish(event.currentTarget.value)}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setWriting(false);
      }}
    />
  );
}

/**
 * Asks for a picture, commits it, and hands over its address, reporting progress the way a drop does.
 *
 * While it uploads, the picture's ghost stands where this image is, with the
 * spinner over it. A picture that fails leaves this image as it was.
 *
 * @example await pickImage(editor, uploading, wrapper, (src) => updateAttributes({ src }));
 */
async function pickImage(
  editor: Editor,
  uploading: Uploading,
  wrapper: HTMLElement | null,
  onPicked: (src: string) => void,
) {
  const [file] = await pickFiles("image");
  const shot = wrapper?.querySelector<HTMLElement>(".jd-shot");
  if (!file || !shot || !editor.isEditable) return;

  shot.style.display = "none";
  await placeFiles(
    uploading,
    editor.storage.uploads,
    [file],
    (block) => {
      if (editor.isDestroyed || isPlaceholder(block)) return false;
      onPicked(String(block.attrs?.src));
      return true;
    },
    (ghosts) => shot.after(ghosts),
  );
  shot.style.display = "";
}

/** How this editor commits a file, or null for an editor that was never given a way to. */
function uploadingOf(editor: Editor): Uploading | null {
  return editor.extensionManager.extensions.find((extension) => extension.name === "uploads")?.options ?? null;
}
