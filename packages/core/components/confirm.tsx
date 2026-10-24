"use client";

import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@jotdown/core/components/ui/alert-dialog";

type Question = {
  title: string;
  description?: string;
  /** The label of the button that answers yes. */
  confirm: string;
  cancel?: string;
};

/** How long the dialog's closing animation runs before it leaves the page. */
const CLOSING_MS = 200;

/**
 * Asks a yes or no question in a dialog drawn by the page, answering true for yes.
 *
 * Use it instead of `window.confirm`, which a webview with no dialog of its own,
 * such as the macOS app's, answers with a silent no. Yes is the answer that
 * loses something, so cancel takes the focus, and Escape answers no too.
 *
 * @example if (await confirmInPage({ title: "Discard your changes?", confirm: "Discard changes" })) discard();
 */
export function confirmInPage(question: Question): Promise<boolean> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  return new Promise((resolve) => {
    function answer(yes: boolean) {
      resolve(yes);
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, CLOSING_MS);
    }

    root.render(<Confirmation {...question} onAnswer={answer} />);
  });
}

/** The dialog itself, open until it is answered once. */
function Confirmation({
  title,
  description,
  confirm,
  cancel = "Cancel",
  onAnswer,
}: Question & { onAnswer(yes: boolean): void }) {
  const [open, setOpen] = useState(true);
  const answered = useRef(false);

  function answer(yes: boolean) {
    if (answered.current) return;
    answered.current = true;
    setOpen(false);
    onAnswer(yes);
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => next || answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => answer(true)}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
