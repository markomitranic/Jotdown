"use client";

import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import type * as PageTree from "fumadocs-core/page-tree";
import type { SidebarProps } from "@jotdown/core/components/docs/sidebar";
import { useTreeContext } from "@jotdown/core/components/docs/tree";
import { ReadingSidebar, SidebarPage } from "@jotdown/core/components/ReadingSidebar";
import { useLiveEditConfig } from "@jotdown/editor/client/config";
import { useIsBrowser } from "@jotdown/editor/client/useIsBrowser";
import StructureBar from "@jotdown/editor/structure/StructureBar";
import { useStructure } from "@jotdown/editor/structure/useStructure";
import { useUnsaved } from "@jotdown/editor/inplace/unsaved";

/**
 * The arranging tree, and the whole drag-and-drop library under it.
 *
 * Kept out of the page's own bundle, since a publication never arranges
 * anything. An editor's browser fetches it once the page is idle and swaps it
 * in for the reading tree, which it draws row for row at the same height and
 * indent, so the swap moves nothing on screen. dnd-kit is behind this too.
 */
const loadArrangeTree = () => import("@jotdown/editor/structure/ArrangeTree");
const ArrangeTree = lazy(loadArrangeTree);

/**
 * The sidebar, drawn as the arranging tree wherever somebody can edit.
 *
 * It is the reading sidebar until the arranging tree has loaded for an editor,
 * and the reading sidebar still around it afterwards. What is swapped is only
 * the page tree inside the scroll viewport, through the per-node `components`
 * the layout already accepts. That hook draws one component per node with no
 * wrapper of its own, so the first top-level node draws the whole flat list and
 * every other node draws nothing.
 * Rendering the list anywhere else would put it outside the viewport, where a
 * handbook with forty pages could not scroll.
 */
export function ArrangeableSidebar({ components, ...props }: SidebarProps) {
  const structure = useStructure();
  const { editable } = useLiveEditConfig();
  const browser = useIsBrowser();
  const loaded = useLoadedArrangeTree(editable);

  if (!structure || !browser || !editable || !loaded) {
    return <ReadingSidebar {...props} components={{ Item: UnsavedPage, ...components }} />;
  }

  return (
    <>
      <ReadingSidebar
        {...props}
        components={{ ...components, Item: Arranging, Folder: Arranging, Separator: Arranging }}
      />
      <StructureBar />
    </>
  );
}

/**
 * A page in the tree, marked when this browser is holding changes for it.
 *
 * A draft lives in the browser until somebody saves it, so a reader who leaves
 * a page mid-sentence and reads three others has nothing telling them the first
 * one is still waiting. The dot is that, and it is only ever a dot: the page
 * itself has a toolbar that says how many changes there are and what can be
 * done about them, and a sidebar row is a place to go rather than a place to
 * read a status from.
 */
function UnsavedPage({ item }: { item: PageTree.Item }) {
  const unsaved = useUnsaved();

  return (
    <SidebarPage
      item={item}
      mark={
        unsaved.has(item.url) && (
          <span
            className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
            title="This page has changes waiting in this browser"
          />
        )
      }
    />
  );
}

/**
 * Fetches the arranging tree once the page is idle, and says when it has arrived.
 *
 * @example const loaded = useLoadedArrangeTree(editable); // false, then true
 */
function useLoadedArrangeTree(editable: boolean) {
  const { isSuccess } = useQuery({
    queryKey: ["arrange-tree"],
    queryFn: () => whenIdle().then(loadArrangeTree),
    enabled: editable,
    staleTime: Infinity,
  });

  return isSuccess;
}

/**
 * Resolves once the browser has nothing better to do, or after a moment where it cannot say.
 *
 * @example await whenIdle();
 */
function whenIdle() {
  const later = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
  return new Promise<void>((resolve) => later(() => resolve()));
}

/** The flat list, drawn once, in place of the first row of the page tree. */
function Arranging({ item }: { item: PageTree.Node }) {
  const { root } = useTreeContext();

  if (root.children[0] !== item) return null;

  return (
    <Suspense>
      <ArrangeTree tree={root.children} />
    </Suspense>
  );
}
