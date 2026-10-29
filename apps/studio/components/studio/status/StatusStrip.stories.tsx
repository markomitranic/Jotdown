import { HttpResponse, http } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as callout from "@/stories/blocks/Callout.mdx";
import type { PageOutline } from "@/lib/page-outline";
import type { Branches } from "@/server/projects/branches";
import { WorkspaceProvider } from "../Workspace";
import { StatusStrip } from "./StatusStrip";

/**
 * The studio's own chrome along the foot of the window: the project and its branch, what a tool just did, and the studio's tools.
 *
 * Each story answers the strip's questions from memory: the branches, the
 * pages, the update waiting, and a reload.
 */
const meta = preview.meta({
  title: "Studio/Status strip",
  parameters: { layout: "fullscreen" },
});

const EDITOR = { login: "grace", name: "Grace Hopper", email: "grace@example.com" };

/** The strip of one project, alone in the window, with the colour stripe along its top edge. */
function Strip({ projectKey, title }: { projectKey: string; title: string }) {
  return (
    <div className="h-[22rem]">
      <WorkspaceProvider
        workspace={{
          editor: EDITOR,
          project: { id: "p1", key: projectKey, title, base: `/${projectKey}` },
          drawing: { mode: "skinny", siteUrl: null, customUrl: null, folder: projectKey.startsWith("local/") },
        }}
      >
        <StatusStrip />
      </WorkspaceProvider>
    </div>
  );
}

/** The pages of a handbook, three levels deep, with one folder that is only a label. */
const PAGES: PageOutline[] = [
  { title: "Welcome", url: "/you/handbook", path: "docs/index.mdx", children: [] },
  {
    title: "Guides",
    url: "/you/handbook/guides",
    path: "docs/guides/index.mdx",
    children: [
      { title: "Setup", url: "/you/handbook/guides/setup", path: "docs/guides/setup.mdx", children: [] },
      { title: "Releasing", url: "/you/handbook/guides/releasing", path: "docs/guides/releasing.mdx", children: [] },
      {
        title: "Deploying",
        url: null,
        path: null,
        children: [
          {
            title: "On Vercel",
            url: "/you/handbook/guides/deploying/vercel",
            path: "docs/guides/deploying/vercel.mdx",
            children: [],
          },
        ],
      },
    ],
  },
  {
    title: "Decision records",
    url: null,
    path: null,
    children: [{ title: "ADR 0001", url: "/you/handbook/adr/0001", path: null, children: [] }],
  },
];

/** The project's answers: its branches, its pages, the update waiting, and what a reload finds. */
function answers(branches: Branches, update: string | null = null) {
  return [
    http.get("/api/projects/p1/branches", () => HttpResponse.json(branches)),
    http.get("/api/projects/p1/pages", () => HttpResponse.json({ pages: PAGES })),
    http.post("/api/projects/p1/live-edit/structure", () =>
      HttpResponse.json({ commitSha: "b2", changed: 1, moves: [] }),
    ),
    http.get("/api/projects/p1/version", () => HttpResponse.json({ version: "a1" })),
    http.get("/api/projects/bookmarks", () => HttpResponse.json({ bookmarks: [] })),
    http.get("/api/update", () => HttpResponse.json({ update: update && { version: update } })),
    http.post("/api/projects/p1/refresh", () =>
      HttpResponse.json({ checked: true, update: update && { version: update } }),
    ),
  ];
}

export const AFolder = meta.story({
  render: () => <Strip projectKey="local/notes" title="Notes" />,
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: null, branches: ["main", "draft"] }));
  },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement);
    await expect(await strip.findByRole("button", { name: "Branch: main" })).toBeVisible();
    await expect(strip.getByRole("button", { name: "Open this page in VS Code" })).toBeVisible();

    await userEvent.click(strip.getByRole("button", { name: "Reload the project and check for updates" }));
    await expect(await strip.findByText("Reloaded · Jotdown is up to date")).toBeInTheDocument();
  },
});

const MANY = ["main", "redesign", "release/0.4", "fix/search-focus", "docs/agents", "spike/canvas", "next", "legacy"];

export const AGitHubProject = meta.story({
  render: () => <Strip projectKey="you/handbook" title="Engineering handbook" />,
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "redesign", home: "main", branches: [...MANY, "archive/2025"] }));
  },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement);
    await expect(strip.queryByRole("button", { name: "Open this page in VS Code" })).toBeNull();

    await userEvent.click(await strip.findByRole("button", { name: "Branch: redesign" }));
    const menu = within(canvasElement.ownerDocument.body);
    await userEvent.type(await menu.findByRole("textbox", { name: "Find a branch" }), "rel");
    await expect(menu.getByRole("menuitem", { name: /release\/0\.4/ })).toBeVisible();
    await expect(menu.queryByRole("menuitem", { name: /legacy/ })).toBeNull();
  },
});

export const AnUpdateWaiting = meta.story({
  render: () => <Strip projectKey="you/handbook" title="Engineering handbook" />,
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: "main", branches: ["main"] }, "0.4.0"));
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("button", { name: "Restart to update to 0.4.0" }),
    ).toBeVisible();
  },
});

/** The page on screen in the strip, and the picker it opens: the whole tree, then only what matches. */
export const PickingAPage = meta.story({
  render: () => <Strip projectKey="you/handbook" title="Engineering handbook" />,
  parameters: { nextjs: { navigation: { pathname: "/you/handbook/guides/setup" } } },
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: "main", branches: ["main"] }));
  },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement);
    await userEvent.click(await strip.findByRole("button", { name: "Setup" }));

    const picker = within(canvasElement.ownerDocument.body);
    const list = await picker.findByRole("listbox", { name: "Pages" });
    await expect(within(list).getByRole("option", { name: /Setup/ })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(within(list).getByText("Deploying")).toBeVisible());

    await userEvent.type(picker.getByRole("textbox", { name: "Search pages" }), "guides vercel");
    await expect(within(list).getAllByRole("option", { name: /On Vercel/ })).toHaveLength(1);
    await waitFor(() => expect(within(list).getByText("Guides / Deploying")).toBeVisible());
  },
});

/** A title that matches nothing becomes a new page, beside the page on screen. */
export const MakingAPage = meta.story({
  render: () => <Strip projectKey="you/handbook" title="Engineering handbook" />,
  parameters: { nextjs: { navigation: { pathname: "/you/handbook/guides/setup" } } },
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: "main", branches: ["main"] }));
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Setup" }));

    const picker = within(canvasElement.ownerDocument.body);
    const list = await picker.findByRole("listbox", { name: "Pages" });
    await waitFor(() => expect(within(list).getByText("Releasing")).toBeVisible());
    await userEvent.type(picker.getByRole("textbox", { name: "Search pages" }), "Rolling back");

    const made = within(list).getByRole("option", { name: /New page Rolling back/ });
    await expect(made).toHaveAttribute("aria-selected", "true");
    await expect(within(made).getByText("in Guides")).toBeVisible();
  },
});

/** The highlighted page's bin asks twice before the page is deleted. */
export const DeletingAPage = meta.story({
  render: () => <Strip projectKey="you/handbook" title="Engineering handbook" />,
  parameters: { nextjs: { navigation: { pathname: "/you/handbook/guides/setup" } } },
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: "main", branches: ["main"] }));
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Setup" }));

    const picker = within(canvasElement.ownerDocument.body);
    const list = await picker.findByRole("listbox", { name: "Pages" });
    await waitFor(() => expect(within(list).getByText("Releasing")).toBeVisible());
    await expect(within(list).queryByRole("button", { name: "Delete Welcome" })).toBeNull();

    await userEvent.click(within(list).getByRole("button", { name: "Delete Setup" }));
    await userEvent.click(await picker.findByRole("button", { name: "Delete" }));
    await expect(await picker.findByRole("button", { name: 'Delete "Setup"' })).toBeVisible();
  },
});

/** Reading takes the editor off the page above the strip, and editing puts it back. */
export const ReadingThePage = meta.story({
  render: () => (
    <>
      <PageStory page={callout} editing />
      <Strip projectKey="you/handbook" title="Engineering handbook" />
    </>
  ),
  beforeEach: ({ msw }) => {
    msw.use(...answers({ current: "main", home: "main", branches: ["main"] }));
  },
  play: async ({ canvasElement }) => {
    const strip = within(canvasElement);
    const editor = () => canvasElement.querySelector("[contenteditable=true]");
    await waitFor(() => expect(editor()).not.toBeNull());

    await userEvent.click(strip.getByRole("button", { name: "View as a reader" }));
    await expect(strip.getByRole("button", { name: "Back to editing" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(editor()).toBeNull());

    await userEvent.click(strip.getByRole("button", { name: "Back to editing" }));
    await waitFor(() => expect(editor()).not.toBeNull());
  },
});
