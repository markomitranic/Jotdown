import { waitFor, within } from "storybook/test";

/**
 * Selects the first words of the first editable paragraph, as a reader dragging across them would.
 *
 * Waits for the article's first paragraph to be taken over by its editor, then
 * hands the browser a range inside it, which the editor reads as its own
 * selection, and waits for the menu that selection opens.
 *
 * @example await selectWords(canvasElement, 24);
 */
export async function selectWords(canvas: HTMLElement, length: number) {
  const paragraph = await waitFor(
    () => {
      const editable = canvas.querySelector<HTMLElement>(".prose p");
      if (editable?.contentEditable !== "true") throw new Error("The paragraph is not editable yet");
      return editable;
    },
    { timeout: 10_000 },
  );

  const text = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode();
  if (text === null) throw new Error("The paragraph has no words to select");

  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, Math.min(length, text.textContent?.length ?? 0));

  paragraph.focus();
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);

  await within(canvas).findByRole("button", { name: "Bold" }, { timeout: 5_000 });
}
