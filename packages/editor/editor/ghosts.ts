/**
 * Faded stand-ins for files on their way to the repository, drawn where their blocks will land.
 *
 * A ghost is markup beside the document, never a node in it, so a page saved
 * mid-upload cannot carry a block pointing at bytes nobody has. It wears the
 * block's own classes, so it takes up the room the block will. A file too big
 * to send without asking has its question asked inside its own ghost, which
 * stops spinning while it waits, and which a screen reader is let into for as
 * long as the question is open.
 */

import { extensionOf } from "@jotdown/core/components/blocks/FileAttachment";
import type { Question } from "./intake";
import { askIn } from "./UploadQuestion";

/** The ghosts of one drop: taking them all away, asking about one, or dropping one that is not going up. */
export type Ghosts = {
  clear(): void;
  ask(file: File, question: Question): ReturnType<typeof askIn>;
  remove(file: File): void;
};

/**
 * Draws a ghost for each file, or each image address still to be fetched, handing the group to `put` to place.
 *
 * Answers how to take them away again, and how to ask about one of them.
 *
 * @example const ghosts = drawGhosts([file, "https://example.com/logo.png"], (group) => paragraph.after(group)); ghosts.clear();
 */
export function drawGhosts(files: Array<File | string>, put: (ghosts: HTMLElement) => void): Ghosts {
  const drawn = new Map<File, HTMLElement>();
  if (files.length === 0) return { clear: () => {}, ask: async () => "cancel", remove: () => {} };

  const ghosts = document.createElement("div");
  ghosts.className = "jd-ghosts";
  ghosts.contentEditable = "false";
  ghosts.setAttribute("aria-hidden", "true");

  const previews: string[] = [];

  for (const file of files) {
    if (typeof file === "string") {
      ghosts.append(imageGhost(file));
      continue;
    }

    if (!isImage(file)) {
      const ghost = fileGhost(file);
      drawn.set(file, ghost);
      ghosts.append(ghost);
      continue;
    }

    const preview = URL.createObjectURL(file);
    previews.push(preview);
    const ghost = imageGhost(preview);
    drawn.set(file, ghost);
    ghosts.append(ghost);
  }

  put(ghosts);

  return {
    clear() {
      ghosts.remove();
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    async ask(file, question) {
      const ghost = drawn.get(file);
      if (ghost === undefined) return "cancel";

      const shot = ghost.querySelector<HTMLElement>(".jd-shot");
      if (shot) delete shot.dataset.busy;
      ghosts.removeAttribute("aria-hidden");

      const answer = await askIn(ghost, question);

      ghosts.setAttribute("aria-hidden", "true");
      if (shot) shot.dataset.busy = "";
      return answer;
    },
    remove(file) {
      drawn.get(file)?.remove();
    },
  };
}

/**
 * The picture as the page will draw it, from the file still in the browser or the address it is fetched from.
 *
 * It is marked busy, which draws the spinner a picture shows while it is on
 * its way. An address this browser cannot show either is drawn as an empty
 * frame instead of a broken image.
 */
function imageGhost(src: string) {
  const image = document.createElement("img");
  image.className = "jd-shot-img";
  image.src = src;
  image.alt = "";
  image.addEventListener("error", () => image.replaceWith(element("span", "jd-ghost-frame", "")));

  const frame = element("span", "jd-shot__frame", "");
  frame.append(image);

  const shot = element("span", "jd-shot", "");
  shot.dataset.busy = "";
  shot.append(frame);

  const paragraph = document.createElement("p");
  paragraph.append(shot);
  return paragraph;
}

/**
 * The attachment card as the page will draw it, its facts standing in for the size and date to come.
 *
 * It sits in a wrapper of its own, so a question about the file has somewhere to go under it.
 */
function fileGhost(file: File) {
  const kind = element("span", "jd-file-kind", extensionOf(file.name) || "file");
  const name = element("span", "jd-file-name", file.name);
  const meta = element("span", "jd-file-meta", "Uploading");

  const body = element("span", "jd-file-body", "");
  body.append(name, meta);

  const card = element("div", "jd-file", "");
  card.append(kind, body);

  const ghost = element("div", "", "");
  ghost.append(card);
  return ghost;
}

function element(tag: "span" | "div", className: string, text: string) {
  const made = document.createElement(tag);
  made.className = className;
  made.textContent = text;
  return made;
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}
