import { expect, userEvent, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import { selectWords } from "@/.storybook/select";
import * as page from "./Text.mdx";

const meta = preview.meta({
  title: "Blocks/Text",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });

/** Three whole blocks selected from the keyboard: Escape in the quote, then Shift and Down twice. */
export const SelectedBlocks = meta.story({
  args: { editing: true },
  play: async ({ canvasElement }) => {
    const quote = await waitFor(
      () => {
        const editable = canvasElement.querySelector<HTMLElement>(
          'blockquote[contenteditable="true"], blockquote [contenteditable="true"]',
        );
        if (editable === null) throw new Error("The quote is not editable yet");
        return editable;
      },
      { timeout: 10_000 },
    );

    await userEvent.click(quote);
    await userEvent.keyboard("{Escape}{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
  },
});

/** Words selected in the first paragraph: the selection menu beside them, with Turn into and the marks. */
export const SelectionMenu = meta.story({
  args: { editing: true },
  play: async ({ canvasElement }) => {
    await selectWords(canvasElement, 12);
  },
});

/**
 * The same words with Turn into open, the first kind highlighted and previewed beside the menu.
 *
 * Not played in WebKit: a scripted click there neither opens the menu nor keeps
 * the selection, though a real one does both.
 */
export const TurnInto = meta.story({
  tags: ["no-webkit"],
  args: { editing: true },
  play: async ({ canvasElement }) => {
    await selectWords(canvasElement, 12);
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /Turn into/ }));
    await userEvent.keyboard("{ArrowDown}");
    const about = await within(document.body).findByText("Plain running text, the most of any page.");
    await waitFor(() => expect(about).toBeVisible());
  },
});
