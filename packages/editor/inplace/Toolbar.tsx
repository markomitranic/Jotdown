"use client";

/**
 * The bar that appears at the foot of the window once a page has changes on it.
 *
 * It is the only chrome the in-place editor has. There is no edit mode to enter
 * and nothing to switch on, so the one thing worth saying out loud is that this
 * page is no longer what the file says, and here is what you can do about it.
 */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronUp, Copy, Trash2 } from "lucide-react";
import { ToggleGroup } from "radix-ui";
import { cn } from "cn";
import { Button } from "@jotdown/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jotdown/core/components/ui/dropdown-menu";
import { Pulse } from "../client/Banner";
import { faceOf, type Doing } from "./face";
import { useInplaceSession, type InplaceSession } from "./session";
import { useDrawing } from "./drawing";

/**
 * Draws the bar, or nothing at all while the page still reads as the file has it.
 *
 * Mounted beside the article rather than inside it, so its own rerenders never
 * reach the elements ProseMirror has taken over. The row it floats in spans the
 * window and takes no clicks, or it would swallow every click on the paragraph
 * that happens to sit behind it.
 *
 * @example <InplaceToolbar />
 */
export function InplaceToolbar() {
  const session = useInplaceSession();
  const { drawing } = useDrawing();
  if (!session || drawing) return null;

  return <Bar session={session} />;
}

function Bar({ session }: { session: InplaceSession }) {
  const { changes, saving } = session;
  const showing =
    changes > 0 || session.recovery.conflicts.length > 0 || session.recovery.error !== null || saving.at !== "resting";
  const reassure = useSaveKey(changes > 0);

  if (!showing) return null;

  return (
    <div className="not-prose pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-3xl flex-col items-center gap-2">
        {reassure && (
          <p
            role="status"
            className="rounded-full border border-border bg-card/90 px-4 py-1.5 text-muted-foreground text-xs shadow-lg backdrop-blur"
          >
            {SAVED}
          </p>
        )}
        <RecoveryNotice session={session} />
        <Panel session={session} />
      </div>
    </div>
  );
}

const SAVED = "Don\u2019t worry, your draft is saved in localStorage.";

/**
 * Swallows the browser's own Save while the page is carrying a draft.
 *
 * Cmd+S on a page somebody has been writing means "keep this", and what the
 * browser does with it is offer to write the HTML to disk, which is never what
 * was meant. The draft is already kept, in storage, on every keystroke, so the
 * key is answered with the thing the reader wanted to hear rather than with a
 * save: committing is a deliberate act on the bar beside this, and binding the
 * key to it would commit a page from a reflex.
 *
 * Only while there is something to reassure anybody about. On a page nobody has
 * touched, Cmd+S is still the browser's.
 *
 * @example const said = useSaveKey(changes > 0);
 */
function useSaveKey(active: boolean) {
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (!active) return;

    const answer = (event: KeyboardEvent) => {
      if (event.key !== "s" || event.altKey || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      setAsked(Date.now());
    };

    window.addEventListener("keydown", answer);
    return () => window.removeEventListener("keydown", answer);
  }, [active]);

  useEffect(() => {
    if (asked === 0) return;

    const clear = setTimeout(() => setAsked(0), 4000);
    return () => clearTimeout(clear);
  }, [asked]);

  return asked !== 0;
}

/**
 * Draws the current draft status and its primary action from the session.
 *
 * A busy button is only marked disabled, never made so, because a disabled
 * button drops its focus and a keyboard reader would lose their place between
 * Save and Try again. A busy face does nothing when pressed anyway.
 */
function Panel({ session }: { session: InplaceSession }) {
  const { saving, changes, deployed, local } = session;
  const face = faceOf({ saving, changes, deployed, local });

  return (
    <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur sm:rounded-full">
      {changes > 0 && <Compare session={session} />}
      {face.busy && <Pulse />}
      <span className="font-label font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
        {face.says}
      </span>

      <Button
        type="button"
        size="sm"
        className={cn("rounded-full", face.busy && "pointer-events-none opacity-50")}
        onClick={() => act(session, face.doing)}
        aria-disabled={face.busy}
        disabled={session.recovery.conflicts.length > 0 && face.doing === "save"}
      >
        {face.does}
      </Button>

      <More session={session} />
    </div>
  );
}

/**
 * The two readings of this page, as one control rather than as two buttons.
 *
 * A pair of buttons says "press either of these"; what is true here is that the
 * page is showing one of two things and pressing the other swaps it. A toggle
 * group is that: one of them is always on, the pressed one is the page you are
 * looking at, and the arrow keys move between them.
 *
 * It never offers an empty state. Radix lets a single toggle group be turned
 * all the way off, which here would mean the page is showing neither version,
 * so a click on the one already pressed is ignored rather than obeyed.
 */
function Compare({ session }: { session: InplaceSession }) {
  const showing = session.recovery.current ? "current" : "draft";

  return (
    <ToggleGroup.Root
      type="single"
      value={showing}
      onValueChange={(next) => next && session.compare(next === "current")}
      aria-label="Which version of this page to show"
      className="flex rounded-full border border-border bg-muted/40 p-0.5"
    >
      {COMPARE.map(({ value, says }) => (
        <ToggleGroup.Item
          key={value}
          value={value}
          className="rounded-full px-3 py-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {says}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

const COMPARE = [
  { value: "draft", says: "Your changes" },
  { value: "current", says: "Current version" },
] as const;

/**
 * Everything that is not the one thing the reader most likely wants.
 *
 * Copying is here for every reader, because it is the way out of any dead end:
 * a deployment that cannot commit, a file that moved on, a save that failed.
 */
function More({ session }: { session: InplaceSession }) {
  const [copied, copy] = useCopied(session.copy);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="More for these changes"
        >
          <ChevronUp className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuItem onClick={copy} onSelect={(event) => event.preventDefault()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy markdown"}
        </DropdownMenuItem>

        {(session.changes > 0 || session.recovery.conflicts.length > 0) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={session.dismiss}>
              <Trash2 />
              Dismiss changes
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Wires the one button on the bar to whichever action its face names. */
function act(session: InplaceSession, doing: Doing) {
  switch (doing) {
    case "reload":
      return session.reload();
    case "copy":
      return void session.copy();
    case "save":
      return session.save();
    case "wait":
      return;
  }
}

/** A copy button that says so for a couple of seconds. */
function useCopied(copy: () => Promise<boolean>) {
  const copying = useMutation({ mutationFn: copy });
  const copied = copying.data === true;
  const { reset } = copying;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(reset, 2000);
    return () => clearTimeout(timer);
  }, [copied, reset]);

  return [copied, () => copying.mutate()] as const;
}

/** Shows recovery failures and changes that could not be placed on the current page. */
function RecoveryNotice({ session }: { session: InplaceSession }) {
  const { error, conflicts } = session.recovery;
  if (!error && conflicts.length === 0 && session.saving.at !== "stale") return null;

  return (
    <div className="max-h-80 w-full overflow-auto rounded-xl border bg-background p-4 text-sm shadow-lg">
      {error && <p role="alert">{error}</p>}
      {session.saving.at === "stale" && (
        <div>
          <p>The page has changed. Reload to recover your changes against the current version.</p>
          <Button size="sm" onClick={session.reload}>
            Reload and recover
          </Button>
        </div>
      )}
      {conflicts.length > 0 && (
        <p>
          The page changed while you were away. Review these changes before saving. Copy any text you want to keep into
          the page, then dismiss it here.
        </p>
      )}
      {conflicts.map((conflict) => (
        <div key={conflict.stamp} className="mt-3 border-t pt-3">
          <p className="font-medium">Previously</p>
          <pre className="whitespace-pre-wrap break-words text-xs">{conflict.before}</pre>
          <p className="mt-2 font-medium">Your change</p>
          <pre className="whitespace-pre-wrap break-words text-xs">{conflict.after || "Block deleted"}</pre>
          <ConflictActions text={conflict.after} dismiss={() => session.dismissConflict(conflict.stamp)} />
        </div>
      ))}
    </div>
  );
}

/** Copies a retained change and removes it only when the reader explicitly dismisses it. */
function ConflictActions({ text, dismiss }: { text: string; dismiss(): void }) {
  const [copied, copy] = useCopied(async () => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  });
  return (
    <div className="mt-2 flex gap-2">
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? "Copied" : "Copy this change"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (window.confirm("Remove this change from the recovery copy?")) dismiss();
        }}
      >
        Dismiss this change
      </Button>
    </div>
  );
}
