"use client";

/**
 * The page's own title, description and icon, edited where the reader sees them.
 *
 * These are the three things that are not in the article. They live in the
 * file's front matter and the route draws them out of `page.data`, so the
 * editor this plugin replaced put them on screen as fields of its own, above a
 * heading of its own, and that was the last reason the old editor still had to
 * exist.
 *
 * On the server and through hydration each of these is exactly the element the
 * reader has always had. What changes after mount is that an editor takes the
 * element over, which is the same bargain every block on the page makes, and
 * the same reason nothing moves when editing becomes available. A deployment
 * that offers no editing, and a generated page, get no context and so render
 * the reading view and stop there.
 *
 * The icon is the one that cannot simply be taken over, because a page without
 * one draws nothing at all and there would be nothing to click. Its picker goes
 * out into the margin the block grip already uses and stays invisible until it
 * is pointed at, so a reader who never wants an icon never sees an offer of
 * one.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import IconPicker from "../editor/IconPicker";
import { useInplace, type Inplace } from "./context";

/**
 * Hands one front matter field to an editor once the page has one to give.
 *
 * The value is read back out of the page's fields rather than taken from the
 * prop, because a recovery copy restored on load may already have changed it
 * and the prop is what the deployment rendered.
 */
function useField(root: RefObject<HTMLElement | null>, key: "title" | "description") {
  const page = useInplace();

  useEffect(() => {
    if (!page?.fields.writable || !root.current) return;

    const element = root.current;
    let stop: (() => void) | null = null;
    let cancelled = false;

    void Promise.all([import("./field"), page.recovery.start()]).then(([{ mountField }]) => {
      if (cancelled) return;

      stop = mountField(element, page.fields.read(key) ?? "", (value) => page.fields.write(key, value), page);
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [page, key, root]);
}

/** The page's title, as the heading the reader already reads. @example <PageTitle>{title}</PageTitle> */
export function PageTitle({ children }: { children: string }) {
  const root = useRef<HTMLSpanElement>(null);
  useField(root, "title");

  return (
    <span ref={root} className="jd-field" data-placeholder="Name this page">
      {children}
    </span>
  );
}

/** The sentence under the title, which is also what every card linking here says. */
export function PageDescription({ children }: { children?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  useField(root, "description");

  return (
    <span ref={root} className="jd-field" data-placeholder="Say what this page answers">
      {children}
    </span>
  );
}

/**
 * The icon beside the title, and the Lucide search behind it.
 *
 * With one already chosen the picker stands exactly where the reading view drew
 * it, at the same size, so the only difference is that it can be clicked. With
 * none, there is no element to stand in, and an offer in the title's own row
 * would push the words sideways for every reader; it goes into the margin
 * instead, and it appears when the pointer is anywhere on the title rather than
 * only when it finds a 28-pixel box nothing is drawn in.
 */
/**
 * Whether the page is showing the deployment rather than the reader's draft.
 *
 * Every block of the article answers this already: the region hides its own
 * parts and puts the copy it took before any editor existed back in their
 * place. The page's own fields are not blocks, so nothing was answering it for
 * them, and an icon somebody had changed stayed changed while the words beneath
 * it went back to what the file says.
 *
 * What the deployment drew is the prop the route passed, which is read out of
 * the file on the server, so the comparison needs no second copy of anything.
 */
function useComparing(page: Inplace | null): boolean {
  return useSyncExternalStore(
    page?.recovery.subscribe ?? quiet,
    () => page?.recovery.get().current ?? false,
    () => false,
  );
}

const quiet = () => () => {};

export function PageIcon({ name, children }: { name?: string; children: ReactNode }) {
  const page = useInplace();
  const [chosen, setChosen] = useState<string | null>(name ?? null);
  const shown = useComparing(page) ? (name ?? null) : chosen;

  useEffect(() => {
    if (!page?.fields.writable) return;
    void page.recovery.start().then(() => setChosen(page.fields.read("icon")));
  }, [page]);

  if (!page?.fields.writable) {
    return children ? (
      <span className="shrink-0 [&_svg]:size-7" aria-hidden="true">
        {children}
      </span>
    ) : null;
  }

  const change = (icon: string | null) => {
    const before = chosen;
    const put = (value: string | null) => {
      setChosen(value);
      page.fields.write("icon", value);
    };

    put(icon);
    page.history.did({ undo: () => put(before), redo: () => put(icon) });
  };

  const picker = (
    <IconPicker value={shown} readOnly={false} className="m-0 size-7 shrink-0 p-0" onChange={change}>
      {shown === (name ?? null) && children ? children : undefined}
    </IconPicker>
  );

  if (shown !== null) return picker;

  return (
    <span className="absolute -left-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover/title:opacity-100 max-lg:hidden">
      {picker}
    </span>
  );
}
