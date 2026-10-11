"use client";

/**
 * What a link says for itself when the caret lands in one.
 *
 * A link inside an editor cannot be followed by clicking it: `openOnClick` is
 * off everywhere, because a reader who clicks a word to fix a typo must not be
 * navigated away from a page they have unsaved changes on. That leaves a link
 * with no way to be visited, no way to be changed once it exists, and nothing
 * on screen saying where it points. This is all three, on the caret rather than
 * on a click.
 *
 * Where it points needs resolving before it can be offered. The build turns
 * `./commit-signing.mdx` into `/security-and-compliance/commit-signing` before
 * a reader ever sees it, but a block an editor has taken over draws its links
 * as the file spells them again, which is right for what gets saved and useless
 * to follow. `addressOf` does the same arithmetic the build does, so Visit goes
 * where the published page's link would have gone.
 *
 * It opens in a new tab on purpose, whether the target is this site or not. The
 * page underneath may be carrying changes that only exist in this browser.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { cn } from "cn";
import { ExternalLink, Link2Off, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@jotdown/core/components/ui/button";
import { Input } from "@jotdown/core/components/ui/input";
import { useDocTarget } from "../client/api";
import { useLiveEditConfig } from "../client/config";
import { addressOf } from "@jotdown/core/lib/paths";
import { useTrackedSelection } from "./context";

const LABEL = "font-label text-[0.7rem] font-medium tracking-[0.07em] uppercase";

type Linked = { editor: Editor; element: HTMLElement; href: string };

/**
 * The link the caret is sitting in, with the element drawing it.
 *
 * The three are handed back separately rather than in one object, because an
 * effect watching a freshly built object re-runs on every render, and an effect
 * that measures a rectangle re-renders: the two together are a loop with no
 * bottom. An editor, a DOM element and a string are each the same value between
 * renders for as long as the reader has not moved.
 */
function useLinked(): { editor: Editor | null; element: HTMLElement | null; href: string } {
  const where = useTrackedSelection();
  const inside = where?.empty && where.editor.isActive("link");
  if (where === null || !inside) return { editor: null, element: null, href: "" };

  const href = where.editor.getAttributes("link").href;
  const element = anchorAt(where.editor, where.from);

  return typeof href === "string" && element !== null
    ? { editor: where.editor, element, href }
    : { editor: null, element: null, href: "" };
}

/**
 * The `<a>` the caret stands inside, asked of the DOM rather than the document.
 *
 * A mark has no node of its own to look up, and the element the browser will
 * position a popover against is the one it drew, so the question is the DOM's
 * to answer. A caret that has the link mark in its stored marks but stands
 * outside the element — the position immediately after a link is the case —
 * finds nothing, and no popover is drawn for a link the reader is no longer in.
 */
function anchorAt(editor: Editor, at: number): HTMLElement | null {
  const { node } = editor.view.domAtPos(at);
  const from = node instanceof Element ? node : node.parentElement;
  const anchor = from?.closest("a[href]") ?? null;

  return anchor instanceof HTMLElement && editor.view.dom.contains(anchor) ? anchor : null;
}

/** @example <InplaceLinkPopover /> */
export function InplaceLinkPopover() {
  const { editor, element, href } = useLinked();
  const { path } = useDocTarget();
  const { base } = useLiveEditConfig();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pinned = useRef<Linked | null>(null);

  useEffect(() => {
    if (editor === null || element === null) return;

    pinned.current = { editor, element, href };
    setDraft(null);

    const measure = () => setRect(element.getBoundingClientRect());

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [editor, element, href]);

  useEffect(() => {
    if (draft === null) return;

    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || root.current?.contains(event.target)) return;
      setDraft(null);
    };

    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [draft]);

  const showing = editor !== null ? { editor, href } : draft !== null ? pinned.current : null;
  if (showing === null || rect === null) return null;

  const apply = () => {
    const value = (draft ?? "").trim();
    const chain = showing.editor.chain().focus().extendMarkRange("link");

    if (value) chain.setLink({ href: value }).run();
    else chain.unsetLink().run();

    setDraft(null);
  };

  const unlink = () => showing.editor.chain().focus().extendMarkRange("link").unsetLink().run();

  return (
    <div
      ref={root}
      className="not-prose fixed z-50 flex max-w-[min(28rem,90vw)] items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: rect.left, top: rect.bottom + 8 }}
    >
      {draft === null ? (
        <>
          <span className="truncate px-2 text-muted-foreground text-sm" title={showing.href}>
            {showing.href}
          </span>
          <a
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}
            href={addressOf(showing.href, path, base)}
            target="_blank"
            rel="noreferrer"
            title="Visit"
            aria-label="Visit"
          >
            <ExternalLink className="size-4" />
          </a>
          <PopoverButton label="Edit" onPress={() => setDraft(showing.href)}>
            <Pencil className="size-4" />
          </PopoverButton>
          <PopoverButton label="Remove link" onPress={unlink}>
            <Link2Off className="size-4" />
          </PopoverButton>
        </>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            className="w-64 border-0 focus-visible:ring-0"
            value={draft}
            autoFocus
            placeholder="Paste a link, or clear it to remove"
            aria-label="Link address"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft(null);
            }}
          />
          <Button type="submit" variant="ghost" size="sm" className={LABEL}>
            apply
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * One glyph in the popover.
 *
 * Mousedown is suppressed because the popover lives outside the contenteditable
 * whose caret put it there, and a plain click would move that caret before the
 * command acting on it ran.
 */
function PopoverButton({ label, onPress, children }: { label: string; onPress(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
