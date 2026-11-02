"use client";

/**
 * Whether a page is on the site, and the one-click change that puts it there or takes it off.
 *
 * A page whose front matter says `unlisted: true` is shown by the studio and
 * nowhere else. Publishing is never staged: it is a decision about readers,
 * not an arrangement, so it commits the moment it is picked, the way deleting
 * does. While the page holds changes in this browser it waits, since a commit
 * to the same file would leave those changes saving against a file that has
 * moved on.
 */

import { EyeOff } from "lucide-react";
import { dirOf, isDoc, isSectionIndex } from "@jotdown/core/lib/paths";
import { useLiveEditConfig } from "../client/config";
import { useIdentity } from "../client/identity";
import { useUnsaved } from "../inplace/unsaved";
import type { DocEntry, StructureOp } from "../types";
import { isRoot } from "./queue";
import { useStructure } from "./useStructure";

/** What an unlisted page says about itself wherever it is named. */
export const UNLISTED = "Unlisted: only the studio shows this page";

/**
 * The page a sidebar row stands for, with the address it is served at: the file itself, or a section's landing page.
 *
 * @example pageOf(docs, "docs/guides"); // ["/guides", { source: "docs/guides/index.mdx", … }]
 */
export function pageOf(docs: Record<string, DocEntry>, path: string) {
  return Object.entries(docs).find(([, entry]) =>
    isDoc(path) ? entry.source === path : isSectionIndex(entry.source) && dirOf(entry.source) === path,
  );
}

/**
 * Whether a page is unlisted, counting a change to it that has committed but not yet been drawn.
 *
 * @example unlistedNow(entry, structure.drawn); // true right after Unpublish, before the refresh lands
 */
function unlistedNow(entry: DocEntry, drawn: StructureOp[]) {
  const latest = drawn.findLast((op) => op.kind === "unlisted" && op.path === entry.source);
  return latest?.kind === "unlisted" ? latest.unlisted : entry.unlisted === true;
}

/**
 * Publishing and unpublishing one page, or null where the page cannot change either way.
 *
 * `held` says why the change has to wait, or is null when it can go now.
 *
 * @example const publishing = usePublishing("docs/later.mdx"); publishing?.toggle();
 */
export function usePublishing(path: string | null) {
  const structure = useStructure();
  const { docs } = useLiveEditConfig();
  const { identity } = useIdentity();
  const unsaved = useUnsaved();

  const found = path === null ? undefined : pageOf(docs, path);
  if (!structure || !identity || !found || found[1].generated) return null;

  const [url, entry] = found;
  const unlisted = unlistedNow(entry, structure.drawn);
  const held =
    !unlisted && isRoot(entry.source)
      ? "The home page is always published."
      : unsaved.has(url)
        ? "Save or dismiss this page's changes first."
        : null;

  return {
    unlisted,
    held,
    toggle: () => structure.commitNow({ kind: "unlisted", path: entry.source, unlisted: !unlisted }, identity),
  };
}

/**
 * The quiet mark at the end of an unlisted page's row.
 *
 * @example {unlisted && <UnlistedMark />}
 */
export function UnlistedMark() {
  return (
    <EyeOff className="size-4 shrink-0 text-muted-foreground/70" role="img" aria-label={UNLISTED} aria-hidden={false}>
      <title>{UNLISTED}</title>
    </EyeOff>
  );
}
