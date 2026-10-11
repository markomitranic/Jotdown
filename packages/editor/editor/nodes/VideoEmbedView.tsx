import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { youtubeId } from "@jotdown/core/components/blocks/VideoEmbed";
import { ATOM, FIELD, SELECTED } from "./atom";

/**
 * The video block while it is being edited: the player, and the link under it.
 *
 * The player is the same markup the page renders, so what is on screen here is
 * what a reader gets. A sheet is laid over it because an iframe swallows every
 * click, and without one the block could be neither selected nor deleted.
 *
 * The link field is always there rather than appearing only while the block is
 * empty. One field in one place is less to explain than a block with two faces,
 * and changing which video a page shows is then the same gesture as adding one.
 * A link the block cannot show is left in the document untouched, so a hand
 * written url the editor does not recognise survives a save.
 */
export default function VideoEmbedView({ node, selected, editor, updateAttributes }: ReactNodeViewProps) {
  const url: string = node.attrs.url;
  const [draft, setDraft] = useState(url);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = youtubeId(draft);

  // A block inserted from the slash menu has nowhere to go until it has a link,
  // so it asks for one rather than sitting there as an empty grey rectangle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: asks for a link once, when the block is first drawn
  useEffect(() => {
    if (url === "") {
      inputRef.current?.focus();
    }
  }, []);

  const commit = (value: string) => {
    setDraft(value);
    if (value === "" || youtubeId(value) !== null) {
      updateAttributes({ url: value });
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(ATOM, "mx-auto my-6 [&_.jd-video]:m-0", selected && SELECTED)}
      contentEditable={false}
    >
      {id === null ? (
        <p className="flex aspect-video items-center justify-center rounded-lg border border-border border-dashed bg-secondary/40 font-label text-muted-foreground text-sm">
          Paste a YouTube link
        </p>
      ) : (
        <div className="jd-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title="YouTube video"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <span className="absolute inset-0" />
        </div>
      )}
      <input
        ref={inputRef}
        className={cn(FIELD, "mt-2 font-mono text-xs")}
        value={draft}
        placeholder="https://www.youtube.com/watch?v=…"
        aria-label="YouTube link"
        spellCheck={false}
        readOnly={!editor.isEditable}
        onChange={(event) => commit(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </NodeViewWrapper>
  );
}
