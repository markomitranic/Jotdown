import { HttpResponse, http } from "msw";
import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import framework from "../../../../../.jotdown/config.json";
import type { HealthCheck } from "@/server/settings/health";
import { SettingsDraft } from "./draft";
import { SettingsPanel } from "./SettingsPanel";
import { openSettings } from "./store";

/**
 * The project's settings over the whole workspace, each section answered from memory.
 *
 * The config is this repository's own, so every field has something in it. A
 * save is answered as the branch accepting it, unless a story says otherwise.
 */
const meta = preview.meta({
  title: "Studio/Settings",
  parameters: { layout: "fullscreen" },
});

const CONFIG = `${JSON.stringify(framework, null, 2)}\n`;

const HEALTH: HealthCheck[] = [
  { id: "repository", state: "ok", text: "Matches markomitranic/Jotdown." },
  { id: "branch", state: "ok", text: "main exists." },
  { id: "url", state: "failed", text: "jotdown-blue.vercel.app answers 404." },
  { id: "files", state: "ok", text: "The file it names is there." },
];

const AUTHOR = { name: "Grace Hopper", email: "grace@example.com" };

const REVISIONS = [
  {
    sha: "f1f0993".padEnd(40, "0"),
    subject: "docs: (studio) settings: theme",
    authoredAt: "2026-10-11T09:12:00Z",
    authors: [AUTHOR],
  },
  {
    sha: "3b2906a".padEnd(40, "0"),
    subject: "docs: (studio) settings: title",
    authoredAt: "2026-10-02T15:40:00Z",
    authors: [AUTHOR],
  },
  {
    sha: "59e003e".padEnd(40, "0"),
    subject: "docs: start the docs",
    authoredAt: "2026-09-20T08:00:00Z",
    authors: [AUTHOR],
  },
];

/** The settings endpoints of project `p1`, the save answering with `saved`. */
function answers(text = CONFIG, saved: "accepted" | "moved" = "accepted") {
  const at = "/api/projects/p1/settings";
  return [
    http.get(`${at}/config`, () => HttpResponse.json({ path: ".jotdown/config.json", text, sha: "a1" })),
    http.post(`${at}/config`, () =>
      saved === "accepted"
        ? HttpResponse.json({ commitSha: "c2", sha: "a2" })
        : HttpResponse.json(
            { error: "This file changed on GitHub since you opened it.", conflict: { theirs: "b1", ours: "a1" } },
            { status: 409 },
          ),
    ),
    http.post(`${at}/health`, () => HttpResponse.json(HEALTH)),
    http.get(`${at}/history`, () =>
      HttpResponse.json({ head: REVISIONS[0]?.sha, revisions: REVISIONS, nextPage: null }),
    ),
    http.get(`${at}/revision`, () =>
      HttpResponse.json({
        path: ".jotdown/config.json",
        sha: REVISIONS[2]?.sha,
        text: CONFIG.replace('"Jotdown"', '"Jotdown docs"'),
      }),
    ),
    http.get("/api/projects/p1/branches", () =>
      HttpResponse.json({ current: "main", home: "main", branches: ["main", "next"] }),
    ),
  ];
}

function Panel() {
  return (
    <SettingsDraft projectId="p1" base="/acme/jotdown">
      <SettingsPanel folders={["decision-records", "examples", "how-it-works", "reference"]} />
    </SettingsDraft>
  );
}

/** Where the project lives, with the site's address failing its check. */
export const General = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers());
    openSettings("general");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await expect(await panel.findByText("jotdown-blue.vercel.app answers 404.")).toBeVisible();
  },
});

/** The palettes, every colour with its contrast, the radius, the typefaces and the section accents. */
export const Theme = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers());
    openSettings("theme");
  },
});

/** A changed title: the row marks itself, and the bar offers to save or discard. */
export const UnsavedChange = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers());
    openSettings("general");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    const title = await panel.findByDisplayValue("Jotdown");
    await userEvent.clear(title);
    await userEvent.type(title, "Jotdown manual");

    await expect(await panel.findByText("1 unsaved change")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Undo the change to Title" })).toBeVisible();
  },
});

/** Somebody else changed the config first: load theirs, or save over it. */
export const MovedOnSave = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers(CONFIG, "moved"));
    openSettings("general");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await userEvent.type(await panel.findByDisplayValue("Jotdown"), " docs");
    await userEvent.click(panel.getByRole("button", { name: /^Save/ }));

    await expect(await panel.findByText("The config changed somewhere else since you opened it.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Save mine over it" })).toBeVisible();
  },
});

/** Every commit that changed the config, one opened on what restoring it would change. */
export const History = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers());
    openSettings("history");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await userEvent.click(await panel.findByRole("button", { name: /start the docs/ }));
    await expect(await panel.findByRole("button", { name: "Restore into the draft" })).toBeVisible();
  },
});

/** A config that is not JSON: the form waits, and the file says why. */
export const BrokenFile = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers('{ "title": "Jotdown", }'));
    openSettings("general");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await waitFor(() => expect(panel.getByText("The config file does not read as JSON.")).toBeVisible());
  },
});

/** A search narrowing every section at once. */
export const Search = meta.story({
  render: () => <Panel />,
  beforeEach: ({ msw }) => {
    msw.use(...answers());
    openSettings("general");
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await userEvent.type(await panel.findByRole("textbox", { name: "Search the settings" }), "radius");
    await expect(await panel.findByText("Corner radius")).toBeVisible();
  },
});
