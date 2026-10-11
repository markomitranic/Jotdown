import { expect, fn, userEvent, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { DeadCanvas, type Dead as DeadKind } from "./CanvasFrame";
import { RendererChoice } from "./RendererMenu";

/**
 * How a project is drawn: the switch between its site, an address of your own, its dev server and the studio's own look, and the page shown in place of a canvas that cannot be used.
 */
const meta = preview.meta({ title: "Studio/Canvas" });

const PROJECT = { key: "you/notes", base: "/you/notes", title: "Notes", repository: "https://github.com/you/notes" };

export const RendererForAFolder = meta.story({
  render: () => (
    <div className="flex justify-end p-4">
      <RendererChoice
        projectKey="local/notes"
        drawing={{ mode: "dev", siteUrl: "https://notes.example.com", customUrl: null, folder: true }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Drawn by/ }));
    const menu = within(document.body);
    await expect(await menu.findByRole("menuitem", { name: /Dev server/ })).toBeInTheDocument();
  },
});

export const RendererWithoutASite = meta.story({
  render: () => (
    <div className="flex justify-end p-4">
      <RendererChoice
        projectKey="you/notes"
        drawing={{ mode: "skinny", siteUrl: null, customUrl: null, folder: false }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Drawn by/ }));
    const site = await within(document.body).findByRole("menuitem", { name: /Site/ });
    await expect(site).toHaveAttribute("data-disabled");
  },
});

const DEAD_PAGE = { parameters: { layout: "fullscreen" as const } };

export const NothingAnswered = meta.story({
  ...DEAD_PAGE,
  render: () => <Dead dead={{ kind: "unreachable" }} />,
});

export const NotACanvas = meta.story({
  ...DEAD_PAGE,
  render: () => <Dead dead={{ kind: "not-canvas" }} />,
});

export const BuiltWithAnOlderJotdown = meta.story({
  ...DEAD_PAGE,
  render: () => <Dead dead={{ kind: "too-old", framework: "0.1.0" }} />,
});

export const BuiltWithANewerJotdown = meta.story({
  ...DEAD_PAGE,
  render: () => <Dead dead={{ kind: "too-new", framework: "0.9.0" }} />,
});

export const AnotherProject = meta.story({
  ...DEAD_PAGE,
  render: () => <Dead dead={{ kind: "wrong-project", serving: "Handbook" }} />,
});

/** The dead page in a frame the size of a canvas. */
function Dead({ dead }: { dead: DeadKind }) {
  return (
    <div className="relative h-[34rem]">
      <DeadCanvas dead={dead} src="https://notes.example.com/_edit" project={PROJECT} onRetry={fn()} />
    </div>
  );
}
