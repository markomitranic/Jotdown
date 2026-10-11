import { expect, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { PageStory } from "@/.storybook/page";
import { studioApi } from "@/.storybook/studio-api";
import * as page from "./Image.mdx";

const meta = preview.meta({
  title: "Blocks/Image",
  args: { editing: false },
  render: ({ editing }) => <PageStory page={page} editing={editing} />,
});

export const Reading = meta.story();

export const Editing = meta.story({ args: { editing: true } });

/** A picture dropped on the page, still on its way: its faded ghost with the spinner over it. */
export const Uploading = meta.story({
  args: { editing: true },
  beforeEach: ({ msw }) => {
    msw.use(...studioApi("uploading"));
  },
  play: async ({ canvasElement }) => {
    await dropFile(canvasElement, await picture(640, 360));
    await waitFor(() => expect(canvasElement.querySelector(".jd-ghosts [data-busy]")).not.toBeNull());
  },
});

/** A 3 MB picture dropped on the page: its ghost asks whether to compress it before anything goes up. */
export const AskToCompress = meta.story({
  args: { editing: true },
  play: async ({ canvasElement }) => {
    await dropFile(canvasElement, await picture(900, 900));
    const original = await within(canvasElement).findByRole("button", { name: "Upload original" }, { timeout: 10_000 });
    await expect(original).toBeVisible();
  },
});

/** A 30 MB attachment dropped on the page: turned away in its own block, with the way round it. */
export const FileTooBig = meta.story({
  args: { editing: true },
  play: async ({ canvasElement }) => {
    const file = new File([new Uint8Array(30_000_000)], "handbook.pdf", { type: "application/pdf" });
    await dropFile(canvasElement, file);
    await expect(await within(canvasElement).findByText(/over the 25 MB the studio takes/)).toBeVisible();
  },
});

/** A picture the server turned away: a placeholder where it was dropped, and the reason under the page. */
export const UploadRefused = meta.story({
  args: { editing: true },
  beforeEach: ({ msw }) => {
    msw.use(...studioApi("refused"));
  },
  play: async ({ canvasElement }) => {
    await dropFile(canvasElement, await picture(640, 360));
    await expect(await within(document.body).findByText(/Images have to be under 25 MB/)).toBeVisible();
    await expect(await within(canvasElement).findByText("Drop a picture here, or click to choose one.")).toBeVisible();
  },
});

/**
 * Drops a file under the first picture on the page, once the editor has taken the page over.
 *
 * @example await dropFile(canvasElement, await picture(640, 360));
 */
async function dropFile(canvasElement: HTMLElement, file: File) {
  await within(canvasElement).findAllByRole("button", { name: "Alt" }, { timeout: 10_000 });
  const target = canvasElement.querySelector(".jd-shot-img");
  if (!target) throw new Error("No picture on the page.");

  const transfer = new DataTransfer();
  transfer.items.add(file);

  const bounds = target.getBoundingClientRect();
  const at = { clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom - 4 };
  for (const type of ["dragenter", "dragover", "drop"]) {
    target.dispatchEvent(new DragEvent(type, { ...at, dataTransfer: transfer, bubbles: true, cancelable: true }));
  }
}

/**
 * A PNG of coloured noise, which no encoder can shrink, so its size follows its pixels: 900 by 900 is about 3 MB.
 *
 * @example await picture(640, 360); // File "release-notes.png"
 */
async function picture(width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const pixels = new ImageData(width, height);
  for (let at = 0; at < pixels.data.length; at += 1) pixels.data[at] = at % 4 === 3 ? 255 : Math.random() * 256;
  canvas.getContext("2d")?.putImageData(pixels, 0, 0);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new File([blob], "release-notes.png", { type: "image/png" });
}
