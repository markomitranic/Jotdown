import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import * as page from "./Unlisted.mdx";

/**
 * An unlisted page, and the Publish button that stays at the foot of the window until it is on the site.
 *
 * Each story ends where the reader would be left looking.
 */
const meta = preview.meta({
  title: "Editor/Publishing",
  render: () => <PageStory page={page} editing />,
});

export const Unlisted = meta.story({
  play: async () => {
    await expect(await within(document.body).findByText("Unlisted")).toBeVisible();
    await expect(within(document.body).getByRole("button", { name: "Publish" })).toBeVisible();
  },
});

export const UnlistedWithChanges = meta.story({
  play: async ({ canvasElement }) => {
    await typeIntoFirstParagraph(canvasElement);
    await expect(await within(document.body).findByText("1 change")).toBeVisible();
    await expect(within(document.body).getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(within(document.body).getByRole("button", { name: "Publish" })).toBeVisible();
  },
});

export const Published = meta.story({
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("button", { name: "Publish" }));
    await expect(await within(document.body).findByText("Published")).toBeVisible();
  },
});

/** Puts the caret at the end of the page's first paragraph and types a sentence, once its editor has loaded. */
async function typeIntoFirstParagraph(canvasElement: HTMLElement) {
  const paragraph = await waitFor(() => {
    const found = within(canvasElement).getByText(/This page is unlisted/);
    expect(found.closest("[contenteditable=true]")).not.toBeNull();
    return found;
  });
  await userEvent.click(paragraph);
  await userEvent.keyboard("{End} Typed in a story.");
}
