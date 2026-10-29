"use client";

import { useEffect, type ReactNode } from "react";
import { PageDraft } from "@jotdown/editor/inplace/PageDraft";
import { StudioPageActions } from "./StudioPageActions";
import { StudioDrawer, useStudioDrawer } from "./StudioDrawer";
import { useDocTarget, useLiveEditConfig } from "@jotdown/editor/client/api";
import { DocTargetProvider, type DocTarget } from "@jotdown/editor/client/config";
import { useIdentity } from "@jotdown/editor/client/identity";
import { useIsBrowser } from "@jotdown/editor/client/useIsBrowser";
import { useReading } from "@jotdown/editor/client/reading";
import { InplaceEditing } from "@jotdown/editor/inplace/context";
import { InplaceSelectionMenu } from "@jotdown/editor/inplace/SelectionMenu";
import { usePageDeletion } from "@jotdown/editor/structure/usePageDeletion";
import { ProjectEditing } from "@jotdown/editor/project/editing";

/**
 * The page as the route rendered it, already editable.
 *
 * `children` is the whole readable page: the title, the description and the
 * body, all rendered on the server. It has to be all three, because the front
 * matter title, icon and description are editable where the reader sees them
 * rather than in a header of their own.
 *
 * There is nothing here that swaps the article for an editor, and nothing that
 * has to be clicked first. A block takes its own element over after mount and a
 * click puts a caret in it, so what this component is left with is the things
 * that sit *beside* the article: which file it came from, the corner button,
 * and the notice that says the deployment underneath has moved on.
 *
 * The target rides in a context rather than in props, because the blocks and
 * the page menu both want it and neither is a child of the other.
 *
 * A new source remounts the editor and its DOM together, so refreshed text
 * never receives edits using the previous version's line positions. While
 * the page is drawn for reading, there is no editor at all.
 */
export function Article({
  target,
  source,
  children,
}: {
  target: DocTarget;
  /** The deployed bytes of the page's file, or null where editing is not offered. */
  source: string | null;
  children: ReactNode;
}) {
  useScrollToHeading(target.path);
  const editable = useReading() || target.generated ? null : source;

  return (
    <DocTargetProvider target={target}>
      <InplaceEditing key={`${target.path}:${editable}`} source={editable}>
        <ProjectEditing>
          <Beside>{children}</Beside>
        </ProjectEditing>
      </InplaceEditing>
    </DocTargetProvider>
  );
}

/**
 * Scrolls to the heading the address names once the page has arrived.
 *
 * The browser looks for the heading while the loading outline stands in for the
 * page, finds nothing and stays at the top, so the page has to look again itself.
 *
 * @example useScrollToHeading("docs/guides/setup.mdx");
 */
function useScrollToHeading(path: string) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: looks again each time another page arrives
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [path]);
}

/**
 * Everything that reads the page's own state, one level below the target it needs.
 *
 * The corner button is for every reader, so it neither waits nor hides: sharing,
 * copying the page and opening it elsewhere are reading tools. The page drawer
 * beside it is for editors, and its Share opens the drawer's share tab.
 * Deleting inside it waits for `useIsBrowser`, which flips in an effect after
 * mount, so the prerendered HTML stays identical to the reading view and
 * hydration has nothing to reconcile.
 *
 * Everyone in the studio is signed in, so the identity is always there where
 * editing is offered.
 */
function Beside({ children }: { children: ReactNode }) {
  const browser = useIsBrowser();
  const { editable } = useLiveEditConfig();
  const { identity } = useIdentity();
  const { path, markdownUrl, githubUrl, generated } = useDocTarget();
  const deletion = usePageDeletion();
  const drawer = useStudioDrawer();

  const offered = browser && editable && !generated;
  const drawn = editable && path !== "";

  return (
    <>
      <div className="absolute top-0 right-0 z-2 flex items-center gap-2">
        <StudioPageActions
          markdownUrl={markdownUrl}
          githubUrl={githubUrl}
          onShare={drawn ? () => drawer.show("share") : undefined}
        />
        {drawn && <StudioDrawer drawer={drawer} onDelete={offered && identity ? deletion?.ask : undefined} />}
      </div>
      {deletion?.dialog}
      <PageDraft>{children}</PageDraft>
      <InplaceSelectionMenu />
    </>
  );
}
