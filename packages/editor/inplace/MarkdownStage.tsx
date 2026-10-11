"use client";

/**
 * The page's whole file as plain text, in a fullscreen editor over the article.
 *
 * There is no preview and no second draft. What is typed becomes the page's
 * whole-page replacement after a short pause, so the article underneath, the
 * save bar, the hold and the recovery copy all treat it like any other edit.
 *
 * Line numbers sit on a mirror of the text behind a transparent textarea. The
 * mirror wraps exactly as the textarea does, so a long paragraph keeps one
 * number however many rows it takes, with nothing measured in script.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { applyDraft } from "./draft";
import { useInplace, type Inplace } from "./context";

const SETTLE_MS = 300;

const INDENT = "  ";

/**
 * Edits the page's markdown by hand until the reader closes it.
 *
 * @example <MarkdownStage initial={markdown} onClose={() => setEditing(false)} />
 */
export function MarkdownStage({ initial, onClose }: { initial: string; onClose: () => void }) {
  const page = useInplace();
  const [text, setText] = useState(initial);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!page) return;
    const timer = setTimeout(() => applyMarkdown(page, text), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [page, text]);

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
    field.current?.setSelectionRange(0, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function close() {
    if (page) applyMarkdown(page, text);
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }

    if (event.key === "Tab" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      document.execCommand("insertText", false, INDENT);
    }
  }

  return createPortal(
    <div className="jd-stage jd-stage--source" role="dialog" aria-modal="true" aria-label="Edit as Markdown">
      <div className="jd-stage__toolbar">
        <button type="button" onClick={close}>
          Done
        </button>
      </div>

      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-4xl py-16 pr-8 pl-20 font-mono text-sm leading-6">
          <div className="relative">
            <Gutter text={text} />
            <textarea
              ref={field}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              aria-label="Markdown source"
              className="absolute inset-0 size-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent text-foreground caret-foreground outline-none"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The text again, invisible, with each source line's number hung in the margin to its left.
 *
 * It is what gives the editor its height: the textarea is laid over it and
 * never scrolls on its own, so the stage scrolls both together.
 */
function Gutter({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none whitespace-pre-wrap break-words text-transparent"
    >
      {lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a gutter line is its line number
        <div key={index} className="relative">
          <span className="absolute right-full pr-5 text-muted-foreground/60 tabular-nums">{index + 1}</span>
          {line || "​"}
        </div>
      ))}
    </div>
  );
}

/**
 * Makes the page read as `text`, through the same whole-page replacement a loaded revision uses.
 *
 * Text the draft already writes is left alone, which is what stops the new
 * page that a replacement renders from replacing itself again. Text that is
 * back to the saved file drops the replacement instead, so it counts as no change.
 *
 * @example applyMarkdown(page, "# Title\n\nNew intro.\n");
 */
function applyMarkdown(page: Inplace, text: string) {
  if (text === applyDraft(page.source, page.draft.edits())) return;

  if (text === page.baseline && page.draft.replacement() !== null) page.recovery.clear();
  else page.recovery.replace(text);
}

/**
 * The page as the draft would write it, once any recovery copy has been loaded into the draft.
 *
 * @example const markdown = await currentMarkdown(page);
 */
export async function currentMarkdown(page: Inplace) {
  await page.recovery.start();
  return applyDraft(page.source, page.draft.edits());
}
