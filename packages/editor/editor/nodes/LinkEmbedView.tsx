import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "cn";
import { NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { LinkCard } from "@jotdown/core/components/blocks/LinkEmbed";
import { shortAddress, webAddress } from "@jotdown/core/lib/web-address";
import { fetchLinkPreview } from "../../client/api";
import type { LinkPreview } from "../../types";
import { ATOM, FIELD, SELECTED } from "./atom";
import { inFrameAt } from "./inFrame";

const UNREAD: LinkPreview = { title: "", description: "", site: "", image: "", favicon: "" };

/**
 * The link card while it is being edited: a field until it has a link, then the card a reader gets.
 *
 * A link pasted onto an empty line arrives here waiting to be read, and the
 * card shows its address while the studio reads the page. What comes back is
 * written into the block outside the undo record, so one Cmd+Z takes the paste
 * away rather than leaving a card that reads itself again. A page that could
 * not be read, or a studio that could not be reached, leaves the card showing
 * its address and host.
 *
 * A sheet is laid over the card because the card is a link, and a click meant
 * to select the block would otherwise open it.
 */
export default function LinkEmbedView({ node, selected, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const { url, title, description, site, image, favicon, unfurl } = node.attrs;
  const address = webAddress(url);
  const href = address?.href;
  const position = useRef(getPos);
  position.current = getPos;

  useEffect(() => {
    if (!unfurl || href === undefined) return;

    const leave = new AbortController();
    const settle = ({ title, description, site, image, favicon }: LinkPreview) => {
      if (leave.signal.aborted) return;

      editor
        .chain()
        .setMeta("addToHistory", false)
        .command(({ tr }) => {
          const pos = position.current();
          const card = pos === undefined ? null : tr.doc.nodeAt(pos);
          if (pos === undefined || card?.type.name !== "linkEmbed") return false;

          tr.setNodeMarkup(pos, undefined, { ...card.attrs, title, description, site, image, favicon, unfurl: false });
          return true;
        })
        .run();
    };

    fetchLinkPreview(href, leave.signal).then(settle, () => settle(UNREAD));

    return () => leave.abort();
  }, [unfurl, href, editor]);

  return (
    <NodeViewWrapper
      as="div"
      className={cn(ATOM, !inFrameAt(editor, getPos()) && "my-7", selected && SELECTED)}
      contentEditable={false}
    >
      {address === null ? (
        <LinkField readOnly={!editor.isEditable} onLink={(link) => updateAttributes({ url: link, unfurl: true })} />
      ) : unfurl ? (
        <Reading address={address} />
      ) : (
        <div className="relative">
          <LinkCard url={url} title={title} description={description} site={site} image={image} favicon={favicon} />
          <span className="absolute inset-0" />
        </div>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Where a link embed from the slash menu asks for its link, taking it on Enter or on a paste.
 *
 * Read only once the link is whole, so typing an address does not read a
 * page at every letter.
 */
function LinkField({ readOnly, onLink }: { readOnly: boolean; onLink: (url: string) => void }) {
  const [draft, setDraft] = useState("");
  const [wrong, setWrong] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const take = (value: string) => {
    const link = webAddress(value) ?? webAddress(withScheme(value));
    if (link === null) return setWrong(value.trim() !== "");
    onLink(link.href);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key !== "Enter") return;

    event.preventDefault();
    take(draft);
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text/plain");
    if (draft !== "" || webAddress(pasted) === null) return;

    event.preventDefault();
    take(pasted);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border border-dashed bg-secondary/40 px-3 py-2.5">
      <input
        ref={field}
        className={cn(FIELD, "flex-1 border-none px-0 font-mono text-sm hover:border-none")}
        value={draft}
        placeholder="Paste or type a link, then press Enter"
        aria-label="Link"
        aria-invalid={wrong}
        spellCheck={false}
        readOnly={readOnly}
        onChange={(event) => {
          setDraft(event.target.value);
          setWrong(false);
        }}
        onPaste={paste}
        onKeyDown={keyDown}
        onMouseDown={(event) => event.stopPropagation()}
      />
      {wrong && <span className="shrink-0 font-label text-destructive text-xs">Not a web link</span>}
    </div>
  );
}

/** The card's shape while its page is being read, its address standing in for the title. */
function Reading({ address }: { address: URL }) {
  return (
    <div className="jd-link" aria-busy="true">
      <span className="jd-link-body">
        <span className="jd-link-title text-muted-foreground">{shortAddress(address)}</span>
        <span className="mt-1 block h-3 w-4/5 animate-pulse rounded-sm bg-muted" />
        <span className="jd-link-site">Reading the page…</span>
      </span>
      <span className="jd-link-image animate-pulse" />
    </div>
  );
}

/**
 * A bare host typed without its scheme, `fumadocs.dev/docs`, as the `https` address it means.
 *
 * @example withScheme("fumadocs.dev"); // "https://fumadocs.dev"
 * @example withScheme("not a link"); // "not a link"
 */
function withScheme(value: string): string {
  const typed = value.trim();
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(typed) ? `https://${typed}` : typed;
}
