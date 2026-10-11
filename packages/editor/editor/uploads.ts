/**
 * Dropping, pasting and picking a file, image or otherwise.
 *
 * Every route ends in the same two steps: turn the file into a block, then
 * insert it. A picture or an attachment is committed first and the block points
 * at where it landed. A Mermaid or Excalidraw file is read in place and becomes
 * a diagram the page's Save commits with the rest. There is no placeholder node
 * and no upload state in the document, so nothing half-finished can ever be
 * serialised: a file that fails leaves the document as it was.
 *
 * Images and attachments share one extension because they share one busy
 * counter. Split in two, each would report its own progress over the other's
 * and a drop of both would flicker between them.
 */

import { Extension } from "@tiptap/core";
import type { Editor, JSONContent } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { FILE_KINDS, extensionOf } from "@jotdown/core/components/blocks/FileAttachment";
import { parseDocument } from "../markdown/parse";
import { whiteboardFromFile } from "../whiteboard/fromFile";
import { drawGhosts } from "./ghosts";
import { intake, primaryAnswer, type Ask, type Intake } from "./intake";
import type { Upload } from "../types";

/** What the editor shows about uploads in flight, or the last one that failed. */
export type UploadStatus = UploadCounter & {
  error: string | null;
};

/**
 * Uploads still to commit, and how many the current run has queued in all.
 *
 * The run ends, and `total` starts over, once nothing is left to commit.
 */
export type UploadCounter = {
  busy: number;
  total: number;
};

/** How a picked, dropped or pasted file reaches the repository, and who hears about it. */
export type Uploading = {
  uploadImage: Upload;
  uploadFile: Upload;
  /** Whether the page compiles JSX, which an attachment and a whiteboard are written as. */
  mdx: boolean;
  onStatus(status: UploadStatus): void;
};

type UploadStorage = UploadCounter;

/**
 * Committed URL to the local blob standing in for it, for the whole session.
 *
 * An upload is committed before it is inserted, but the deploy that publishes
 * it lands minutes later, so the URL in the markdown draws a broken icon until
 * then. The blob from the dropped file covers that gap. It is kept for the
 * page's lifetime rather than an editor's, because a block that an undo brings
 * back, or one dragged elsewhere, is drawn by a new editor on the same URL.
 * Attachments need none of this: an unbuilt link is a download that waits, not
 * a hole in the page.
 *
 * An image the page already drew is kept here too, under the address the page
 * drew it from, so the editor taking it over does not fetch it all over again.
 */
const previews = new Map<string, string>();

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    uploads: {
      /** Opens the file picker for images, then uploads and inserts them. */
      pickImage: () => ReturnType;
      /** Opens the file picker for attachments, then uploads and inserts one. */
      pickFile: () => ReturnType;
    };
  }

  interface Storage {
    uploads: UploadStorage;
  }
}

type Session = {
  editor: Editor;
  options: Uploading;
  storage: UploadStorage;
};

const refuse = async () => ({ ok: false as const, error: "Files cannot be uploaded here." });

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const FILE_ACCEPT = Object.keys(FILE_KINDS)
  .map((extension) => `.${extension}`)
  .join(",");

/**
 * Wires uploads into the editor.
 *
 * @example uploads.configure({ uploadImage, uploadFile, mdx: true, onStatus: setStatus })
 */
export const uploads = Extension.create<Uploading, UploadStorage>({
  name: "uploads",

  addOptions() {
    return { uploadImage: refuse, uploadFile: refuse, mdx: false, onStatus: () => {} };
  },

  addStorage() {
    return { busy: 0, total: 0 };
  },

  addCommands() {
    // The position is read when the dialog closes, not now. Picking a file
    // cannot move the caret, and by then the slash that opened the menu has
    // been deleted, which the chained state here does not know yet.
    const open = (editor: Editor, accept: string, multiple: boolean) => {
      const session = { editor, options: this.options, storage: this.storage };

      pick({ accept, multiple }, (files) => void insertUploads(session, files, editor.state.selection.from));
      return true;
    };

    return {
      pickImage:
        () =>
        ({ editor }) =>
          open(editor, IMAGE_ACCEPT, true),
      pickFile:
        () =>
        ({ editor }) =>
          open(editor, FILE_ACCEPT, false),
    };
  },

  addProseMirrorPlugins() {
    const session = (): Session => ({
      editor: this.editor,
      options: this.options,
      storage: this.storage,
    });

    return [
      new Plugin({
        props: {
          // A pasted screenshot arrives as a file. Copying an image from inside
          // the document does not, so this leaves ordinary pasting alone.
          handlePaste: (view, event) => {
            const pasted = Array.from(event.clipboardData?.files ?? []);
            if (pasted.length === 0) {
              return false;
            }

            event.preventDefault();
            void insertUploads(session(), pasted, view.state.selection.from);
            return true;
          },
        },
      }),
    ];
  },
});

/**
 * The local stand-in for an image the deploy has not published yet.
 *
 * @example previewSrc("/img/docs/ab12.png"); // "blob:https://…"
 */
export function previewSrc(src: unknown) {
  return typeof src === "string" ? (previews.get(src) ?? null) : null;
}

/**
 * Keeps the address each image of a block was drawn from, before an editor redraws the block.
 *
 * The page moves `/img/docs/a.png` under the project, or to the blob it is kept
 * as, while the editor draws the path the markdown wrote. Paired in the order
 * both are written, and skipped when the counts disagree.
 *
 * @example keepDrawnImages(paragraph, "![Logo](/img/docs/a.png)"); // previewSrc("/img/docs/a.png") is the drawn URL
 */
export function keepDrawnImages(markup: HTMLElement, markdown: string) {
  const written = imageSources(parseDocument(markdown).doc);
  const drawn = [...markup.querySelectorAll("img")].map((image) => image.dataset.src ?? image.getAttribute("src"));
  if (written.length !== drawn.length) return;

  written.forEach((src, at) => {
    const url = drawn[at];
    if (url && url !== src && !previews.has(src)) previews.set(src, url);
  });
}

/** Every image's `src` in a parsed document, in the order the file writes them. */
function imageSources(node: JSONContent): string[] {
  const own = node.type === "image" && typeof node.attrs?.src === "string" ? [node.attrs.src] : [];
  return [...own, ...(node.content ?? []).flatMap(imageSources)];
}

/**
 * Uploads each file in turn and inserts it into the document that asked for it.
 *
 * A save in flight locks the surface, and a file uploaded into it would be
 * committed to the repo and then dropped from a document nobody can type in, so
 * the file is refused rather than half-added.
 */
async function insertUploads(session: Session, dropped: File[], at: number) {
  const { editor, options, storage } = session;

  if (!editor.isEditable) {
    options.onStatus({
      busy: storage.busy,
      total: storage.total,
      error: "This page is not taking edits right now, so the file was not added.",
    });
    return;
  }

  let pos = at;

  await placeFiles(
    options,
    storage,
    dropped,
    (node) => {
      if (editor.isDestroyed) return false;

      editor.chain().insertContentAt(pos, node).run();
      pos = editor.state.selection.to;
      return true;
    },
    (ghosts) => editor.view.dom.after(ghosts),
  );
}

/**
 * Turns each file in turn into a block, and hands over the block it became.
 *
 * A failure stops the rest. Whatever went wrong for one file, a network that
 * dropped or a limit that was hit, is going to go wrong for its neighbours, and
 * one message about it is plenty. A picture that failed still hands over a
 * block, an image with no address, so the gap it was meant to fill stays on the
 * page as a placeholder another picture can be dropped on or picked for.
 * `place` answering false stops the queue too, which is how an editor torn
 * down mid-upload gets out of the way.
 *
 * Nothing is placed before its file is committed, so a page that is never saved
 * leaves the file behind rather than a block pointing at bytes nobody has.
 * Given `put`, a faded ghost of every file still on its way stands where it
 * will land until the last one is done.
 *
 * Every file is settled before any goes up: one too big to send without asking
 * is asked about in its ghost, and one left out takes its ghost with it.
 * Without ghosts there is nowhere to ask, and each question takes its primary
 * answer, which compresses a big picture and leaves out a big file.
 *
 * @example placeFiles(handlers, { busy: 0 }, files, (block) => insert(block), (ghosts) => line.after(ghosts));
 */
export async function placeFiles(
  uploading: Uploading,
  counter: UploadCounter,
  dropped: File[],
  place: (node: JSONContent) => boolean,
  put?: (ghosts: HTMLElement) => void,
) {
  const [first] = dropped;
  if (first === undefined) return;

  const files = dropped.filter((file) => fits(file, uploading.mdx));
  if (files.length === 0) {
    uploading.onStatus({ ...counter, error: refusal(first) });
    return;
  }

  const ghosts = put === undefined ? null : drawGhosts(files.filter(leavesTheBrowser), put);
  let waiting = 0;

  try {
    const sending: File[] = [];
    for (const file of files) {
      const settled = await settleFile(file, (question) =>
        ghosts ? ghosts.ask(file, question) : primaryAnswer(question),
      );

      if ("send" in settled) {
        sending.push(settled.send);
        continue;
      }

      ghosts?.remove(file);
      if ("error" in settled) {
        uploading.onStatus({ ...counter, error: settled.error });
        if (isImage(file)) place(PLACEHOLDER);
        return;
      }
    }

    waiting = sending.filter(leavesTheBrowser).length;
    counter.busy += waiting;
    counter.total += waiting;
    if (waiting > 0) uploading.onStatus({ ...counter, error: null });

    for (const file of sending) {
      const made = await blockFor(uploading, file);

      if (leavesTheBrowser(file)) {
        waiting -= 1;
        settle(counter, 1);
        uploading.onStatus({ ...counter, error: null });
      }

      if (!made.ok) {
        uploading.onStatus({ ...counter, error: made.error });
        if (isImage(file)) place(PLACEHOLDER);
        return;
      }

      if (!place(made.node)) return;
    }
  } finally {
    settle(counter, waiting);
    ghosts?.clear();
  }
}

/**
 * What goes up for one file: a picture or attachment as its intake decides, anything else as it is.
 *
 * @example await settleFile(file, ask); // { send: file }
 */
function settleFile(file: File, ask: Ask): Promise<Intake> {
  const kind = kindOf(file);
  if (kind !== "image" && kind !== "file") return Promise.resolve({ send: file });
  return intake(file, kind, ask);
}

/** Takes finished or abandoned uploads off the counter, starting the run over once none are left. */
function settle(counter: UploadCounter, finished: number) {
  counter.busy -= finished;
  if (counter.busy === 0) counter.total = 0;
}

/** Whether a file is committed on its own, as a picture or an attachment is, rather than read into the page. */
function leavesTheBrowser(file: File) {
  const kind = kindOf(file);
  return kind === "image" || kind === "file";
}

/** What a dropped file becomes on the page, read off its type and its name. */
type FileKind = "image" | "file" | "mermaid" | "whiteboard";

const MERMAID_EXTENSIONS = ["mmd", "mermaid"];

/**
 * What a file becomes, or null for one that has nowhere to go in a page.
 *
 * The endpoint decides uploads again for itself. Asking here too is only so a
 * `.dmg` dropped on a paragraph is refused straight away instead of after the
 * round trip.
 *
 * @example kindOf(new File([], "flow.mmd")); // "mermaid"
 */
function kindOf(file: File): FileKind | null {
  const extension = extensionOf(file.name);

  if (isImage(file)) return "image";
  if (MERMAID_EXTENSIONS.includes(extension)) return "mermaid";
  if (extension === "excalidraw") return "whiteboard";
  if (extension in FILE_KINDS) return "file";
  return null;
}

/**
 * Whether a file has somewhere to go in this page.
 *
 * A `.md` page compiles no JSX, so the two kinds written as a tag are kept out.
 *
 * @example fits(new File([], "notes.pdf"), false); // false
 */
function fits(file: File, mdx: boolean) {
  const kind = kindOf(file);
  return kind !== null && (mdx || (kind !== "file" && kind !== "whiteboard"));
}

/** Why a file was turned away, in words that say what to do about it. */
function refusal(file: File) {
  const kind = kindOf(file);

  if (kind === "file" || kind === "whiteboard") {
    return `${file.name} needs an MDX page, and this one is plain markdown. Only pictures and Mermaid diagrams can go here.`;
  }

  if (file.type.startsWith("video/")) {
    return `${file.name} is a video, and videos are too big for the repository. Put it on YouTube and paste the link on an empty line.`;
  }

  return `${file.name} is not a kind of file that can go in a page. Zip it and try that.`;
}

/**
 * The block one file becomes, committing it first where it has to be committed.
 */
async function blockFor(
  uploading: Uploading,
  file: File,
): Promise<{ ok: true; node: JSONContent } | { ok: false; error: string }> {
  const kind = kindOf(file);

  if (kind === "mermaid") {
    const code = (await file.text()).trim();
    return { ok: true, node: mermaidBlock(code) };
  }

  if (kind === "whiteboard") {
    return whiteboardFromFile(file);
  }

  const uploaded = await (kind === "image" ? uploading.uploadImage(file) : uploading.uploadFile(file));
  if (!uploaded.ok) return uploaded;

  if (kind === "image") previews.set(uploaded.url, URL.createObjectURL(file));

  return { ok: true, node: nodeFor(file, uploaded.url) };
}

/** A Mermaid fence holding the diagram's source, which is the whole of a `.mmd` file. */
function mermaidBlock(code: string): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: "mermaid" },
    content: code === "" ? undefined : [{ type: "text", text: code }],
  };
}

/**
 * Asks the operating system for files of one kind.
 *
 * Answers with an empty list when the dialog is dismissed, so a cancelled pick
 * is the same shape as one that chose nothing and neither needs a branch.
 *
 * @example const [picture] = await pickFiles("image");
 */
export function pickFiles(kind: "image" | "file"): Promise<File[]> {
  return new Promise((resolve) => {
    const accept = kind === "image" ? IMAGE_ACCEPT : FILE_ACCEPT;
    pick({ accept, multiple: kind === "image" }, resolve, () => resolve([]));
  });
}

/**
 * The image with no address left where a picture that could not be uploaded was meant to go.
 *
 * It has no alt text, because the file's name describes nothing, and the
 * picture that fills it brings its own.
 */
const PLACEHOLDER: JSONContent = { type: "image", attrs: { src: "", alt: "" } };

/**
 * Whether a block is an image with no address, the stand-in for a picture still to come.
 *
 * @example isPlaceholder({ type: "image", attrs: { src: "" } }); // true
 */
export function isPlaceholder(block: JSONContent) {
  return block.type === "image" && !block.attrs?.src;
}

/** The block a committed upload becomes, which is what its kind decides. */
function nodeFor(file: File, url: string) {
  if (isImage(file)) {
    return { type: "image", attrs: { src: url, alt: altFor(file) } };
  }

  return {
    type: "fileAttachment",
    attrs: {
      href: url,
      name: file.name,
      size: String(file.size),
      uploadedAt: today(),
      note: "",
    },
  };
}

/**
 * Today, as `YYYY-MM-DD` where the person uploading is sitting.
 *
 * `toISOString` would answer in UTC, which is yesterday for anyone uploading
 * after lunch in Auckland and tomorrow for anyone in Honolulu before it.
 */
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

/** The filename, tidied into something a screen reader can read out. */
function altFor(file: File) {
  return file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

/**
 * Asks the operating system for files.
 *
 * The input has to be in the document for Safari to open the dialog, and it is
 * removed either way, so a cancelled pick leaves nothing behind.
 */
function pick(
  options: { accept: string; multiple: boolean },
  onFiles: (files: File[]) => void,
  onCancel: () => void = () => {},
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = options.accept;
  input.multiple = options.multiple;
  input.hidden = true;
  document.body.append(input);

  input.addEventListener("cancel", () => {
    input.remove();
    onCancel();
  });
  input.addEventListener("change", () => {
    const files = Array.from(input.files ?? []);
    input.remove();

    if (files.length > 0) {
      onFiles(files);
    }
  });

  input.click();
}
