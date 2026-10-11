import type { Editor } from "@tiptap/core";
import { createContentComponent } from "@tiptap/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@jotdown/core/lib/query-client";
import { useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";

type Registry = ReturnType<typeof createContentComponent>;

type WithRegistry = Editor & { contentComponent?: Registry | null };

/** The element the portals render from, and the way to take it down again. */
export type Portals = {
  element: HTMLElement;
  release(): void;
};

/**
 * Lets an editor that was handed an element draw its React node views.
 *
 * Tiptap draws a React node view as a portal and registers it on
 * `editor.contentComponent`, which only `<EditorContent>` ever fills in. Every
 * editor here is mounted straight onto an element the article or this plugin
 * already drew, so there is no `<EditorContent>` anywhere and
 * `ReactNodeViewRenderer` answers with no node view at all: the block renders
 * from its bare schema, every control the view would have drawn is missing, and
 * the console says nothing about it.
 *
 * Filling that registry in and rendering what collects in it is the whole of
 * what `<EditorContent>` does that matters here. It has to happen before the
 * mount, because the view asks each extension for its node view as it is built.
 * The views draw in a root of their own, so the page's query client is handed
 * to them again.
 *
 * The element is the portals' own, so releasing takes it off the page again.
 * A block that an undo brings back gets a new editor and so a new registry, and
 * the one the old editor drew from would otherwise stay behind it.
 *
 * @example const portals = acceptNodeViews(editor); element.append(portals.element);
 */
export function acceptNodeViews(editor: Editor): Portals {
  const registry = createContentComponent();
  (editor as WithRegistry).contentComponent = registry;

  const element = document.createElement("div");
  element.style.display = "contents";

  const root = createRoot(element);
  root.render(
    <QueryClientProvider client={getQueryClient()}>
      <Drawn registry={registry} />
    </QueryClientProvider>,
  );

  return {
    element,
    release() {
      (editor as WithRegistry).contentComponent = null;
      unmountLater(root, element);
    },
  };
}

/**
 * Gives a React root back, once React is no longer in the middle of anything.
 *
 * Every release here is called from a teardown, and a teardown runs inside
 * React's own commit: unmounting a root from there is unmounting one root
 * while another is rendering, which React warns about by name and describes as
 * a race. Waiting for the end of the turn costs nothing, because the root
 * being given back draws into an element of its own that nothing else reads.
 *
 * @example unmountLater(root, element);
 */
export function unmountLater(root: Root, element?: HTMLElement) {
  queueMicrotask(() => {
    root.unmount();
    element?.remove();
  });
}

/** Every node view currently on the page, each a portal into its own element. */
function Drawn({ registry }: { registry: Registry }) {
  const views = useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getServerSnapshot);

  return <>{Object.values(views)}</>;
}
