"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "fumadocs-core/framework";
import { KitEditorScope, type KitEditor, type KitPageResult } from "@jotdown/kit";
import { rangeIn, stampAt } from "@jotdown/core/lib/source-range";
import { docUrl } from "@jotdown/core/lib/paths";
import { useLiveEditConfig } from "../client/config";
import { useIdentity } from "../client/identity";
import { useInplace, type Inplace } from "../inplace/context";
import { useStructure } from "../structure/useStructure";
import type { StructureOp } from "../types";
import { openingTag, withChildren, withProp } from "./tag";

/**
 * Gives the project blocks of an editable page the editor their primitives write through.
 *
 * Outside an editable page the blocks get none, and draw as they would on the site.
 *
 * @example <ProjectEditing><MDX components={components} /></ProjectEditing>
 */
export function ProjectEditing({ children }: { children: ReactNode }) {
  const inplace = useInplace();
  const pages = usePageVerbs();
  const editor = useMemo(() => (inplace ? { ...tagEditor(inplace), ...pages } : null), [inplace, pages]);

  return <KitEditorScope editor={editor}>{children}</KitEditorScope>;
}

type PageVerbs = Pick<KitEditor, "createPage" | "movePage">;

/**
 * The editor's page verbs: each commits one change to the page tree at once, as deleting a page does.
 *
 * A page made is opened, and a page moved is followed when it is the one open,
 * as every committed move is. Either answers with
 * the address the page now has, or with the reason the commit was refused, a
 * path outside `docs/` or a file already there, which the save card shows too.
 * The verbs read the session through a ref, so a block holding them never
 * redraws while a save is under way.
 *
 * @example const { createPage } = usePageVerbs(); await createPage({ path: "docs/blog/hi.mdx", title: "Hi" });
 */
function usePageVerbs(): PageVerbs {
  const structure = useStructure();
  const { identity } = useIdentity();
  const { base } = useLiveEditConfig();
  const router = useRouter();

  const live = useRef({ structure, identity, base, router });
  useEffect(() => {
    live.current = { structure, identity, base, router };
  }, [structure, identity, base, router]);

  return useMemo(() => {
    async function commit(op: StructureOp, path: string): Promise<KitPageResult> {
      const { structure, identity, base } = live.current;
      if (!structure || !identity) return { ok: false, error: "Pages are made and moved only in the studio." };

      const committed = await structure.commitNow(op, identity);
      return committed.ok ? { ok: true, path, url: docUrl(path, base) } : committed;
    }

    return {
      async createPage({ path, title, description, data, body }) {
        const made = await commit({ kind: "create", path, title, description: description ?? null, data, body }, path);
        if (made.ok) live.current.router.push(made.url);
        return made;
      },
      movePage: (from, to) => commit({ kind: "move", from, to }, to),
    };
  }, []);
}

/** What has been changed in one block's tag: its props, and the first paragraph written into it. */
type TagEdits = { props: Map<string, string>; fill: string | null };

/**
 * The half of the editor that writes into the page itself: every change goes into the block's opening tag.
 *
 * The tag is a stretch of the file of its own in the draft, so a prop edited
 * beside prose typed between the tags never overwrites it, and the block
 * carries both wherever it is moved. The stretch starts after the `<`, so it
 * stays inside the block's own even when the tag is the whole block. The tag is written again from the file's
 * own each time, with every change so far laid over it, so typing a prop
 * twice or filling a block twice replaces rather than adds.
 */
function tagEditor(inplace: Inplace): Omit<KitEditor, keyof PageVerbs> {
  const tags = new Map<string, TagEdits>();

  function edit(stamp: string, change: (edits: TagEdits) => void) {
    const range = rangeIn(inplace.source, stamp);
    if (range === null) return;

    const slice = inplace.source.slice(range.start, range.end);
    const tag = openingTag(slice);
    if (tag === null) return;

    const tagStamp = stampAt(inplace.source, range.start + tag.start + 1, range.start + tag.end);
    const edits = tags.get(tagStamp) ?? { props: new Map(), fill: null };
    change(edits);
    tags.set(tagStamp, edits);

    let block = slice.slice(tag.start);
    for (const [prop, value] of edits.props) block = withProp(block, prop, value);
    if (edits.fill !== null) block = withChildren(block, edits.fill);

    const rest = slice.slice(tag.end);
    const original = slice.slice(tag.start + 1, tag.end);
    const written = block.slice(1, block.length - rest.length);
    inplace.draft.write(tagStamp, written === original ? null : written);
  }

  return {
    setProp: (stamp, prop, value) => edit(stamp, (edits) => edits.props.set(prop, value)),
    fill: (stamp, text) =>
      edit(stamp, (edits) => {
        edits.fill = text;
      }),
    upload: (file) => inplace.uploading.uploadImage(file),
  };
}
