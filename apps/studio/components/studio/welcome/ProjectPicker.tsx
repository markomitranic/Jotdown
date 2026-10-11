"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { SHORTCUTS, useModifier, useShortcut } from "@jotdown/core/components/shortcuts";
import { OpeningProject } from "../OpeningProject";
import { ProjectPalette, type Screen } from "../ProjectPalette";
import { SetupDialog } from "../setup/SetupDialog";
import { useBookmarks, useOpenProject } from "../projects";

type Props = {
  editor: { login: string; name: string };
};

/**
 * The field that opens the project switcher, with its shortcut, the project this browser last had open, how many projects are in the list, and the way to add one, new or already there.
 *
 * @example <ProjectPicker editor={session.editor} />
 */
export function ProjectPicker({ editor }: Props) {
  const { bookmarks, recent, error, save, forget } = useBookmarks();
  const last = bookmarks?.find((bookmark) => bookmark.key === recent && !bookmark.locked);
  const { opening, open, dismiss } = useOpenProject();
  const [choosing, setChoosing] = useState<Screen | null>(null);
  const modifier = useModifier();
  useShortcut(SHORTCUTS.switcher, () => setChoosing((shown) => (shown ? null : "bookmarks")));

  function start(key: string, title: string | null, bookmark: boolean) {
    setChoosing(null);
    open(key, title, bookmark);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={choosing !== null}
        onClick={() => setChoosing("bookmarks")}
        className="mt-9 flex h-11 w-full max-w-90 items-center gap-2.5 rounded-[10px] border border-white/15 bg-indigo-950/55 ps-3.5 pe-2 text-[0.9375rem] text-white/60 shadow-[0_8px_30px_rgb(10_5_40/0.45)] outline-none backdrop-blur-md transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ChevronsUpDown className="size-4" aria-hidden="true" />
        <span className="flex-1 text-start">Select a project</span>
        <span className="flex gap-0.5">
          <Cap>{modifier}</Cap>
          <Cap>2</Cap>
        </span>
      </button>

      <p className="mt-4.5 min-h-5 text-[0.8125rem] text-white/60">
        {bookmarks &&
          (bookmarks.length === 1 ? "1 project in your list. " : `${bookmarks.length} projects in your list. `)}
        <button
          type="button"
          onClick={() => setChoosing("add")}
          className="underline underline-offset-3 hover:text-white"
        >
          Add a project
        </button>
      </p>
      {last && (
        <a
          href={`/${last.key}`}
          className="mt-1.5 text-[0.8125rem] text-white/85 underline underline-offset-3 hover:text-white"
        >
          Continue in {last.title}
        </a>
      )}

      <ProjectPalette
        open={choosing !== null}
        startOn={choosing ?? "bookmarks"}
        onOpenChange={(open) => setChoosing(open ? "bookmarks" : null)}
        editor={editor}
        bookmarks={bookmarks}
        bookmarkError={error}
        onChoose={start}
        onForget={forget}
        onSave={save}
      />
      <SetupDialog onOpenProject={start} />
      {opening && <OpeningProject opening={opening} onDismiss={dismiss} />}
    </>
  );
}

function Cap({ children }: { children: string }) {
  return (
    <kbd className="grid h-5.5 min-w-5.5 place-items-center rounded-[5px] border border-white/12 bg-white/10 px-1.5 font-medium font-sans text-white/75 text-xs">
      {children}
    </kbd>
  );
}
