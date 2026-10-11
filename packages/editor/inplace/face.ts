/**
 * What the toolbar is currently about, decided from the session and nothing else.
 *
 * Kept apart from the bar that draws it because this is the whole of the
 * editor's behaviour a reader ever sees, and a table of states is worth reading
 * and worth testing without a browser anywhere near it.
 */

import type { Saving } from "./session";

/** Which of the session's actions the button is wired to. */
export type Doing =
  /** Nothing. Something is in flight and the button only says what. */
  "wait" | "reload" | "copy" | "save";

export type Face = {
  says: string;
  does: string;
  doing: Doing;
  busy?: boolean;
};

/** Everything about a page's changes that decides what the bar offers. */
export type Standing = {
  saving: Saving;
  /** How many blocks read differently from the file, which is also the label. */
  changes: number;
  /** Whether this deployment can commit at all, or only hand over the markdown. */
  deployed: boolean;
  /** Whether the page is a file on this machine, which is on disk the moment it is saved. */
  local: boolean;
};

/**
 * Which face the bar is wearing.
 *
 * Ordered by what overrides what: a commit in flight beats an offer, and a page
 * that cannot be saved offers its markdown instead.
 *
 * Nothing here offers to start editing, because editing started the moment the
 * page rendered. The label counts rather than judging: "3 changes" says what is
 * true without arguing about whether they are saved. A save to a folder is on
 * disk the moment it lands, so it says Saved and reloads on its own.
 *
 * @example faceOf({ saving: { at: "published" }, … }).doing; // "reload"
 */
export function faceOf({ saving, changes, deployed, local }: Standing): Face {
  switch (saving.at) {
    case "sending":
      return { says: "Saving", does: "Saving", doing: "wait", busy: true };
    case "published":
      return local
        ? { says: "Saved", does: "Reloading", doing: "wait" }
        : { says: "Published", does: "Reload the page", doing: "reload" };
    case "stale":
      return { says: "This page has moved on", does: "Reload", doing: "reload" };
    case "failed":
      return { says: saving.why, does: "Try again", doing: "save" };
    case "resting":
      break;
  }

  const says = counted(changes);
  if (!deployed) return { says, does: "Copy markdown", doing: "copy" };
  return { says, does: "Save changes", doing: "save" };
}

/** How many blocks read differently from the file. @example counted(1); // "1 change" */
function counted(changes: number) {
  if (changes === 0) return "No changes";
  return changes === 1 ? "1 change" : `${changes} changes`;
}
