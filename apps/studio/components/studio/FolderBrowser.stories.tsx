import { Dialog as DialogPrimitive } from "radix-ui";
import { fn, userEvent, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { FolderBrowser } from "./FolderBrowser";
import type { FolderListing } from "./folders";

/** A home folder of two levels, with one Jotdown project in it. */
const TREE: Record<string, FolderListing> = {
  "~/": {
    path: "/Users/ada",
    display: "~",
    title: null,
    parent: "/Users",
    entries: [
      { name: "Desktop", path: "/Users/ada/Desktop", title: null },
      { name: "Documents", path: "/Users/ada/Documents", title: null },
      { name: "Sites", path: "/Users/ada/Sites", title: null },
    ],
  },
  "~/Sites/": {
    path: "/Users/ada/Sites",
    display: "~/Sites",
    title: null,
    parent: "~",
    entries: [
      { name: "handbook", path: "/Users/ada/Sites/handbook", title: "Handbook" },
      { name: "shop-frontend", path: "/Users/ada/Sites/shop-frontend", title: null },
    ],
  },
  "~/Sites/handbook/": {
    path: "/Users/ada/Sites/handbook",
    display: "~/Sites/handbook",
    title: "Handbook",
    parent: "~/Sites",
    entries: [
      { name: "docs", path: "/Users/ada/Sites/handbook/docs", title: null },
      { name: "src", path: "/Users/ada/Sites/handbook/src", title: null },
    ],
  },
};

/** Answers from the tree above after a moment, and refuses any folder it does not hold. */
async function browse(path: string) {
  await new Promise((done) => setTimeout(done, 150));
  const listing = TREE[path];
  if (!listing) throw new Error(`${path} could not be read.`);
  return listing;
}

/** The browser inside the dialog frame the switcher gives it. */
function Framed({ start }: { start?: string }) {
  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground text-sm shadow-2xl outline-none ring-1 ring-foreground/10"
        >
          <DialogPrimitive.Title className="sr-only">Add a local project</DialogPrimitive.Title>
          <FolderBrowser
            start={start}
            onBack={fn()}
            onAdded={fn()}
            onSetUp={fn()}
            browse={browse}
            add={async (path) => ({ key: "local/handbook", title: path })}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const meta = preview.meta({
  title: "Studio/Folder browser",
  component: Framed,
});

export const Home = meta.story();

/** Inside a folder holding a Jotdown project, which Enter adds, under the row back up to the parent. */
export const InSites = meta.story({ args: { start: "~/Sites/" } });

/** Inside a folder that is a Jotdown project, whose header takes the project's colour and whose Add is ready. */
export const InAProject = meta.story({ args: { start: "~/Sites/handbook/" } });

/** Typing past the last slash narrows the folders listed. */
export const Narrowing = meta.story({
  args: { start: "~/Sites/" },
  play: async () => {
    await userEvent.type(await within(document.body).findByLabelText("Folder"), "hand");
  },
});

/** A folder that cannot be read says so where the folders would be. */
export const Unreadable = meta.story({ args: { start: "~/Private/" } });

/** Adding a folder with no docs asks whether to set docs up there instead. */
export const NoDocsHere = meta.story({
  args: { start: "~/Sites/" },
  play: async () => {
    const body = within(document.body);
    await body.findByText("shop-frontend");
    await userEvent.click(body.getByRole("button", { name: /^Add/ }));
  },
});
