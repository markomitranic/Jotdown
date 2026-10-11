"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@jotdown/core/components/ui/alert-dialog";
import { Button } from "@jotdown/core/components/ui/button";
import { useIdentity } from "../client/identity";
import { useDocTarget } from "../client/api";
import { isRoot } from "./queue";
import { useStructure } from "./useStructure";

/**
 * Deleting the page you are reading: the action for the corner menu, and the
 * two confirmations that stand between it and the commit.
 *
 * Null while the page cannot go: the site root, or a reader with no identity.
 * The dialog comes back as an element for the caller to render beside the
 * article, because the menu holding the action closes the moment you pick it.
 *
 * It asks twice on purpose. One dialog is a button you learn to click through,
 * and the second one is worded differently, focuses "Keep it" and names the
 * page inside the button that does the deleting, so agreeing to it takes
 * reading. The first Yes is a plain button rather than an `AlertDialogAction`,
 * which closes the dialog it is in whatever its click handler does.
 *
 * The commit removes the file and unwrites the links that pointed at it. Any
 * image or attachment it was the last page to reference is left where it is and
 * collected later by `pnpm prune-uploads`, since the same picture can be on
 * two pages and a delete that guessed wrong would break the other one.
 *
 * @example const deletion = usePageDeletion(); // { ask, dialog } | null
 */
export function usePageDeletion() {
  const structure = useStructure();
  const { path, title, generated } = useDocTarget();
  const { identity } = useIdentity();
  const [step, setStep] = useState<Step>(null);

  if (generated || !structure || isRoot(path) || !identity) return null;

  const remove = () => {
    setStep(null);
    structure.commitNow({ kind: "delete", path }, identity);
  };

  return {
    ask: () => setStep("explain"),
    dialog: (
      <AlertDialog open={step !== null} onOpenChange={(open) => open || setStep(null)}>
        <AlertDialogContent>
          {step === "sure" ? (
            <LastChance title={title} onDelete={remove} />
          ) : (
            <Explain path={path} title={title} onContinue={() => setStep("sure")} />
          )}
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}

/** Which of the two confirmations is on screen, or neither. */
type Step = "explain" | "sure" | null;

/** What deleting this page actually does, and the first of the two Yeses. */
function Explain({ path, title, onContinue }: { path: string; title: string; onContinue: () => void }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{title}"?</AlertDialogTitle>
        <AlertDialogDescription>
          It is committed away from <code>{path}</code> and the page stops existing when the deploy lands. Any link to
          it elsewhere in the project is unwritten in the same commit: the words stay in the sentence, they stop being
          something you can click.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep it</AlertDialogCancel>
        <Button variant="destructive" onClick={onContinue}>
          Delete
        </Button>
      </AlertDialogFooter>
    </>
  );
}

/**
 * The second Yes, which is where the deleting is agreed to.
 *
 * The cancel button holds the focus, so a stray Enter or Space on a dialog you
 * did not mean to open keeps the page.
 */
function LastChance({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-destructive/10 text-destructive">
          <TriangleAlert />
        </AlertDialogMedia>
        <AlertDialogTitle>Are you 100% sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This is the last thing standing between "{title}" and the commit. Nothing in this site brings the page back
          afterwards: getting it again means digging the file out of git history and committing it a second time.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel autoFocus>No, keep it</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onDelete}>
          Delete "{title}"
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
