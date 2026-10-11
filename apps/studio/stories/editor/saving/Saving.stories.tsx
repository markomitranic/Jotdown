import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import { studioApi } from "@/.storybook/studio-api";
import * as page from "./Saving.mdx";

/**
 * A change typed into the page and saved, against each thing the studio can answer.
 *
 * Each story ends where the reader would be left looking, so the state the
 * toolbar is in is the one a snapshot keeps.
 */
const meta = preview.meta({
  title: "Editor/Saving",
  render: () => <PageStory page={page} editing />,
});

export const Changed = meta.story({
  play: async ({ canvasElement }) => {
    await typeIntoFirstParagraph(canvasElement);
    await expect(await within(document.body).findByText("1 change")).toBeVisible();
  },
});

export const Published = meta.story({
  play: async ({ canvasElement }) => {
    await typeIntoFirstParagraph(canvasElement);
    await save();
    await expect(await within(document.body).findByText("Published")).toBeVisible();
  },
});

export const MovedOn = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(...studioApi("moved"));
  },
  play: async ({ canvasElement }) => {
    await typeIntoFirstParagraph(canvasElement);
    await save();
    await expect(await within(document.body).findByText("This page has moved on")).toBeVisible();
  },
});

export const Offline = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(...studioApi("down"));
  },
  play: async ({ canvasElement }) => {
    await typeIntoFirstParagraph(canvasElement);
    await save();
    await expect(await within(document.body).findByText(/Could not reach the server/)).toBeVisible();
    await expect(within(document.body).getByRole("button", { name: "Try again" })).toHaveFocus();
  },
});

/**
 * Puts the caret at the end of the page's first paragraph and types a sentence.
 *
 * Waits for the editor to take the paragraph over first, because a block is
 * drawn as plain text and only becomes editable once its editor has loaded.
 */
async function typeIntoFirstParagraph(canvasElement: HTMLElement) {
  const paragraph = await waitFor(() => {
    const found = within(canvasElement).getByText(/Click anywhere in this paragraph/);
    expect(found.closest("[contenteditable=true]")).not.toBeNull();
    return found;
  });
  await userEvent.click(paragraph);
  await userEvent.keyboard("{End} Typed in a story.");
}

/** Presses Save on the toolbar. */
async function save() {
  await userEvent.click(await within(document.body).findByRole("button", { name: "Save changes" }));
}
