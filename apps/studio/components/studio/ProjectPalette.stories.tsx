import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { EDITOR } from "@/.storybook/studio-api";
import { ProjectPalette } from "./ProjectPalette";
import type { Bookmark, ProjectListing } from "./projects";

const BOOKMARKS: Bookmark[] = [
  { key: "acme/jotdown", title: "Jotdown", icon: null, locked: false },
  { key: "acme/handbook", title: "Handbook", icon: null, locked: false },
  { key: "acme/client-portal", title: "Client portal", icon: null, locked: true },
  { key: "grace/talks", title: "Talks", icon: null, locked: false },
];

const FOLDERS: Bookmark[] = [
  {
    key: "local/handbook",
    title: "Handbook",
    icon: null,
    locked: false,
    folder: "~/Sites/handbook",
    owner: "acme",
  },
  {
    key: "local/client-docs",
    title: "client-docs",
    icon: null,
    locked: true,
    folder: "~/Sites/client-docs",
  },
];

const DISCOVERED: ProjectListing[] = [
  { key: "acme/jotdown", title: "Jotdown", description: "", icon: null },
  { key: "acme/handbook", title: "Handbook", description: "", icon: null },
  { key: "acme/web-platform", title: "Web platform", description: "", icon: null },
  { key: "acme/design-system", title: "Design system", description: "", icon: null },
  { key: "grace/notes", title: "Notes", description: "", icon: null },
];

/** The palette with its bookmarks kept in state and GitHub answering a moment after it is asked, so it can be clicked through. */
function Playground({
  answer = "listed",
  bookmarkError = "",
  local = false,
  unanswered = false,
}: {
  answer?: "listed" | "slow" | "failed";
  bookmarkError?: string;
  local?: boolean;
  /** A browser GitHub never answered for the bookmarks yet. */
  unanswered?: boolean;
}) {
  const [bookmarks, setBookmarks] = useState(local ? [...FOLDERS, ...BOOKMARKS] : BOOKMARKS);

  async function discover() {
    await new Promise((resolve) => setTimeout(resolve, answer === "slow" ? 60_000 : 600));
    if (answer === "failed") throw new Error("GitHub did not answer. Try again in a minute.");
    return DISCOVERED;
  }

  function choose(key: string, title: string | null) {
    if (bookmarks.some((bookmark) => bookmark.key === key)) return;
    setBookmarks([...bookmarks, { key, title: title ?? key.split("/")[1]!, icon: null, locked: false }]);
  }

  return (
    <ProjectPalette
      open
      onOpenChange={fn()}
      editor={{ login: "octocat", name: EDITOR.name }}
      current={local ? { key: FOLDERS[0]!.key, title: FOLDERS[0]!.title } : { key: "acme/jotdown", title: "Jotdown" }}
      bookmarks={unanswered ? null : bookmarks}
      bookmarkError={bookmarkError}
      discover={discover}
      onChoose={choose}
      onForget={(key) => setBookmarks(bookmarks.filter((bookmark) => bookmark.key !== key))}
      onSave={(key, title) => setBookmarks([...bookmarks, { key, title, icon: null, locked: false }])}
    />
  );
}

const meta = preview.meta({
  title: "Studio/Project palette",
  component: Playground,
});

export const Bookmarks = meta.story();

/** Folders on this computer above the GitHub bookmarks, one of them gone from disk. */
export const Local = meta.story({ args: { local: true } });

export const Adding = meta.story({
  play: async () => {
    await userEvent.click(await within(document.body).findByText("Add a project"));
  },
});

export const AskingGitHub = meta.story({
  args: { answer: "slow" },
  play: async () => {
    await userEvent.click(await within(document.body).findByText("Add a project"));
  },
});

export const SearchingFromBookmarks = meta.story({
  play: async () => {
    await userEvent.type(await within(document.body).findByLabelText("Search your projects"), "web");
  },
});

export const PastedKey = meta.story({
  play: async () => {
    await userEvent.click(await within(document.body).findByText("Add a project"));
    await userEvent.type(await within(document.body).findByLabelText("Search GitHub"), "grace/slides");
  },
});

export const GitHubFailed = meta.story({
  args: { answer: "failed" },
  play: async () => {
    await userEvent.click(await within(document.body).findByText("Add a project"));
  },
});

/** The first page load in a browser, before GitHub answers for the bookmarks. */
export const LoadingBookmarks = meta.story({ args: { unanswered: true } });

export const BookmarksUnchecked = meta.story({
  args: { bookmarkError: "GitHub did not answer. Try again in a minute." },
});
