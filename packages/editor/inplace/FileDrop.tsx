"use client";

/**
 * Files dragged in from the desktop, landing between two blocks of the page.
 *
 * While a file is in the air the page draws the same line a dragged block
 * does, between the two blocks it would land between, and nothing else
 * changes. Only the drop turns the files into blocks: pictures and attachments
 * are committed first, diagrams are read where they are, and all of them go in
 * at the line as one change. Pictures held over a placeholder, an image that
 * could not be downloaded, light it up instead, and dropping them fills it.
 *
 * Every file drag over the window is answered, even where nothing can land,
 * because the browser's own answer to a dropped file is to open it in place
 * of the page and take the unsaved edits with it. A dialog is left alone, so
 * the whiteboard's canvas can take a picture of its own.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import type { JSONContent } from "@tiptap/core";
import { isPlaceholder, placeFiles, type UploadCounter } from "../editor/uploads";
import { useInplace, type Inplace } from "./context";
import { blockBounds } from "./handleGeometry";
import type { BlockOps, BlockSnapshot } from "./handles";
import { DropLine, drawsNothing, nearestEdge, type Landing } from "./BlockHandle";

/**
 * Draws where dragged files will land, and puts them there on the drop.
 *
 * @example <InplaceFileDrop container={containerRef} />
 */
export function InplaceFileDrop({ container }: { container: RefObject<HTMLElement | null> }) {
  const page = useInplace();
  const [landing, setLanding] = useState<Landing | null>(null);
  const inFlight = useRef({ busy: 0, total: 0 });

  useEffect(() => {
    if (page === null) return;

    let depth = 0;
    let suppressed: HTMLElement[] = [];
    let aimed: Placeholder | null = null;

    const aim = (next: Placeholder | null) => {
      if (aimed?.element === next?.element) return;
      aimed?.element.classList.remove("jd-missing-target");
      next?.element.classList.add("jd-missing-target");
      aimed = next;
    };

    const landingAt = (event: DragEvent) => {
      const root = container.current;
      if (root === null || event.dataTransfer === null) return null;

      return nearestEdge(page.handles, root, event.clientX, event.clientY, [probeFor(event.dataTransfer)], []);
    };

    const settle = () => {
      depth = 0;
      setLanding(null);
      aim(null);
      suppressed.forEach((element) => (element.contentEditable = "true"));
      suppressed = [];
    };

    const enter = (event: DragEvent) => {
      if (!ours(event)) return;
      depth += 1;
      if (depth > 1) return;

      const root = container.current;
      suppressed = root === null ? [] : [...root.querySelectorAll<HTMLElement>('[contenteditable="true"]')];
      suppressed.forEach((element) => (element.contentEditable = "false"));
    };

    const leave = (event: DragEvent) => {
      if (!ours(event)) return;
      depth -= 1;
      if (depth <= 0) settle();
    };

    const over = (event: DragEvent) => {
      if (!ours(event)) return;
      event.preventDefault();
      event.stopPropagation();

      const placeholder = placeholderAt(page, container.current, event);
      const onto = placeholder === null ? landingAt(event) : null;
      aim(placeholder);

      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = (placeholder ?? onto) ? "copy" : "none";
      setLanding((current) => (sameLanding(current, onto) ? current : onto));
    };

    const drop = (event: DragEvent) => {
      if (!ours(event)) return;
      event.preventDefault();
      event.stopPropagation();

      const placeholder = placeholderAt(page, container.current, event);
      const onto = placeholder === null ? landingAt(event) : null;
      const files = [...(event.dataTransfer?.files ?? [])];
      settle();

      if (placeholder !== null) void fillPlaceholder(page, inFlight.current, files, placeholder);
      else if (onto !== null) void dropFiles(page, inFlight.current, files, onto);
    };

    window.addEventListener("dragenter", enter, true);
    window.addEventListener("dragleave", leave, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("drop", drop, true);

    return () => {
      window.removeEventListener("dragenter", enter, true);
      window.removeEventListener("dragleave", leave, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("drop", drop, true);
      settle();
    };
  }, [page, container]);

  return <DropLine landing={landing} container={container} />;
}

/**
 * Turns the dropped files into blocks, then puts them all at the line as one change.
 *
 * The files are placed only once the last one is ready, so one Cmd+Z takes the
 * whole drop away, and whatever was typed elsewhere during the upload is not
 * swept into it. Blocks land in the order they were dropped, whichever side of
 * the block the line was on.
 */
async function dropFiles(page: Inplace, counter: UploadCounter, files: File[], { ops, edge }: Landing) {
  const blocks: BlockSnapshot[] = [];

  await placeFiles(
    page.uploading,
    counter,
    files,
    (block) => {
      blocks.push({ block, anchor: "" });
      return true;
    },
    (ghosts) => (edge === "before" ? ops.dom.before(ghosts) : ops.dom.after(ghosts)),
  );

  if (blocks.length === 0) return;

  if (!ops.dom.isConnected || drawsNothing(blockBounds(ops.box))) {
    page.uploading.onStatus({
      ...counter,
      error: "The block the files were dropped beside is gone. Drop them again.",
    });
    return;
  }

  if (blocks.some((arriving) => ops.accepts?.(arriving) === false)) {
    page.uploading.onStatus({
      ...counter,
      error: "That cannot go inside this block. Drop it between the blocks of the page instead.",
    });
    return;
  }

  page.history.batch(() => {
    if (edge === "before") blocks.forEach((arriving) => ops.dropBefore(arriving));
    else blocks.toReversed().forEach((arriving) => ops.dropAfter(arriving));
  });
}

/** An image with no address on the page, and the block it is, which a dropped picture fills. */
type Placeholder = { element: HTMLElement; ops: BlockOps };

/**
 * The placeholder under the pointer, when every file in the air is a picture, or null.
 *
 * The innermost block holding it is the image itself rather than a callout
 * around it.
 */
function placeholderAt(page: Inplace, root: HTMLElement | null, event: DragEvent): Placeholder | null {
  const pictures = [...(event.dataTransfer?.items ?? [])].every((item) => item.type.startsWith("image/"));
  if (root === null || !pictures) return null;

  const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".jd-missing");
  if (!element || !root.contains(element)) return null;

  const holding = page.handles.all().filter((ops) => ops.dom.contains(element));
  const ops = holding.find((outer) => !holding.some((inner) => inner !== outer && outer.dom.contains(inner.dom)));
  return ops === undefined ? null : { element, ops };
}

/**
 * Puts dropped pictures where a placeholder stood, the first one taking over its alt text.
 *
 * The placeholder steps aside for the ghosts while they upload and comes back
 * if none of them make it, rather than trading places with the new
 * placeholder a failed picture leaves. The swap is one change, so one Cmd+Z brings the
 * placeholder back.
 */
async function fillPlaceholder(page: Inplace, counter: UploadCounter, files: File[], { element, ops }: Placeholder) {
  const alt = String(ops.snapshot().block.attrs?.alt ?? "");
  const blocks: BlockSnapshot[] = [];

  element.style.display = "none";
  await placeFiles(
    page.uploading,
    counter,
    files,
    (block) => {
      if (isPlaceholder(block)) return false;
      blocks.push({ block, anchor: "" });
      return true;
    },
    (ghosts) => element.after(ghosts),
  );
  element.style.display = "";

  const [first, ...rest] = blocks;
  if (first === undefined || !ops.dom.isConnected) return;

  const named = alt === "" ? first : { ...first, block: { ...first.block, attrs: { ...first.block.attrs, alt } } };

  page.history.batch(() => {
    [named, ...rest].toReversed().forEach((arriving) => ops.dropAfter(arriving));
    ops.remove();
  });
}

/**
 * Whether this drag is files from outside the page, over somewhere the page answers for.
 *
 * A block dragged by its grip carries text rather than files, so the two drags
 * never answer for each other.
 */
function ours(event: DragEvent) {
  const carriesFiles = event.dataTransfer?.types.includes("Files") ?? false;
  const inDialog = event.target instanceof Element && event.target.closest('[role="dialog"]') !== null;

  return carriesFiles && !inDialog;
}

/**
 * A stand-in for what the drag will become, for asking a block whether it can hold it.
 *
 * Mid-drag the browser shows each file's type but not its name, so a diagram
 * cannot be told from an attachment until the drop, where the answer is asked
 * again with the real blocks.
 */
function probeFor(transfer: DataTransfer): BlockSnapshot {
  const pictures = [...transfer.items].every((item) => item.type.startsWith("image/"));
  const block: JSONContent = pictures
    ? { type: "image", attrs: { src: "" } }
    : { type: "fileAttachment", attrs: { href: "", name: "" } };

  return { block, anchor: "" };
}

function sameLanding(one: Landing | null, other: Landing | null) {
  return one?.ops === other?.ops && one?.edge === other?.edge;
}
