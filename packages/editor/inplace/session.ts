"use client";

/**
 * What happens to a page's changes between typing them and them being live.
 *
 * The page is editable from the moment it renders, so there is no session to
 * open: this only starts existing once the draft has something in it. From
 * there it is the commit.
 */

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { applyDraft } from "./draft";
import { useChanges, useInplace, useRecovery } from "./context";
import { LiveEditFailure, fetchSource, refusedWith, saveSource, useDocTarget, useLiveEditConfig } from "../client/api";
import { useIdentity, type EditorIdentity } from "../client/identity";
import { useLeaveGuard } from "../client/useLeaveGuard";
import { confirmInPage } from "@jotdown/core/components/confirm";

/** Reloads the page, which is how a saved or stale page shows the file as it is now. */
function reload() {
  window.location.reload();
}

const DISMISS_QUESTION = {
  title: "Discard your changes?",
  description: "The page reloads as the file has it, and everything you changed on it is gone.",
  confirm: "Discard changes",
};

export type Saving =
  /** Nothing in flight. The draft is either empty or waiting to be sent. */
  | { at: "resting" }
  | { at: "sending" }
  | { at: "published" }
  /**
   * The file moved on since this page was rendered, so no stamp on it can be
   * trusted to still cut its own block out.
   */
  | { at: "stale" }
  | { at: "failed"; why: string };

/**
 * The page's changes, and everything the toolbar can do about them.
 *
 * Returns null on a page that offers no editing, which is the same answer the
 * blocks themselves get.
 *
 * @example const session = useInplaceSession(); session?.save();
 */
export function useInplaceSession() {
  const inplace = useInplace();
  const { apiBase, editable, local } = useLiveEditConfig();
  const { path, title } = useDocTarget();
  const { identity } = useIdentity();

  const changes = useChanges();
  const recovery = useRecovery();

  const committing = useMutation({
    mutationFn: (save: Commit) => commitDraft(apiBase, path, title, save),
    onSuccess: () => {
      inplace?.recovery.clear();
      if (local) window.location.reload();
    },
  });
  const { mutate } = committing;
  const saving = savingOf(committing);

  useLeaveGuard(committing.isPending || (recovery.error !== null && (changes > 0 || recovery.conflicts.length > 0)));

  /** The file as this draft would write it, which is what Save and Copy both send. */
  const written = useCallback(() => (inplace ? applyDraft(inplace.source, inplace.draft.edits()) : ""), [inplace]);

  const save = useCallback(() => {
    if (!inplace || !identity || inplace.recovery.get().conflicts.length > 0) return;
    mutate({ text: written(), baseline: inplace.baseline, author: identity });
  }, [identity, inplace, mutate, written]);

  /** Copies the whole page as this draft would write it, front matter and all. */
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(written());
      return true;
    } catch {
      return false;
    }
  }, [written]);

  /**
   * Throws the changes away, which means reloading.
   *
   * ProseMirror owns the DOM of every block the reader touched, so there is no
   * un-typing it: the article as the file has it comes back from the server or
   * not at all.
   */
  const discard = useCallback(() => {
    inplace?.recovery.clear();
    window.location.reload();
  }, [inplace]);

  /** Discards after asking, for a button that is not already the answer to a question. */
  const dismiss = useCallback(() => {
    void confirmInPage(DISMISS_QUESTION).then((yes) => yes && discard());
  }, [discard]);

  if (!inplace) return null;

  return {
    changes,
    recovery,
    compare: inplace.recovery.compare,
    dismissConflict: inplace.recovery.dismissConflict,
    saving,
    identity,
    /** Whether this page can commit at all, or only offer the markdown. */
    deployed: editable,
    /** Whether the page is a file on this machine, written in place rather than committed. */
    local,
    save,
    copy,
    dismiss,
    discard,
    reload,
  };
}

export type InplaceSession = NonNullable<ReturnType<typeof useInplaceSession>>;

/** One save: the file as the draft writes it, the text the page was rendered from, and who signs it. */
type Commit = { text: string; baseline: string; author: EditorIdentity };

/**
 * Commits the draft to the project's branch.
 *
 * The sha is the part worth reading. A draft here starts from the bytes this
 * page rendered, which carry no sha at all, so one is fetched at save time and
 * accepted only if the file at HEAD still reads exactly as the page was
 * rendered from. Anything else means somebody saved in between, so the save is
 * refused as stale rather than guessed at.
 *
 * @example await commitDraft("/api/projects/you~site/live-edit", "docs/seo.mdx", "SEO", { text, baseline, author });
 */
async function commitDraft(apiBase: string, path: string, title: string, { text, baseline, author }: Commit) {
  const head = await fetchSource(apiBase, path);
  if (head.text !== baseline)
    throw new LiveEditFailure(409, { error: "The file changed since this page was rendered." });

  return saveSource(apiBase, {
    path,
    text,
    sha: head.sha,
    message: `docs: (studio) update ${title}\n\nEdited in Jotdown.`,
    author,
  });
}

/**
 * Where a save is up to, as the toolbar reads it, from the commit in flight or the last one sent.
 *
 * @example savingOf(committing); // { at: "stale" } after a 409
 */
function savingOf({
  isPending,
  isSuccess,
  error,
}: {
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
}): Saving {
  if (isPending) return { at: "sending" };
  if (isSuccess) return { at: "published" };
  if (refusedWith(error, 409)) return { at: "stale" };
  if (error) return { at: "failed", why: error.message };
  return { at: "resting" };
}
