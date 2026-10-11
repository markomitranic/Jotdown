import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { cn } from "cn";
import { Button } from "@jotdown/core/components/ui/button";
import type { Answer, Choice, Question } from "./intake";
import { unmountLater } from "../inplace/portals";

/**
 * Asks about one upload inside its own ghost, and answers with the button pressed.
 *
 * A picture asks in a bar along the foot of its preview; an attachment asks in
 * its card, the line under the name and the buttons at the end. Nothing covers
 * the page, so the rest of it stays in reach while the question waits. The
 * question draws in a root of its own, because a ghost is markup beside the
 * document with no React behind it, and the root is gone once it is answered.
 *
 * @example const answer = await askIn(ghost, question); // "compress"
 */
export function askIn(ghost: HTMLElement, question: Question): Promise<Answer> {
  const frame = ghost.querySelector<HTMLElement>(".jd-shot__frame");
  const card = ghost.querySelector<HTMLElement>(".jd-file");

  const element = document.createElement("span");
  element.className = "jd-upload-question";
  const actions = document.createElement("span");
  actions.className = "jd-upload-actions";

  if (card) {
    card.dataset.asking = "";
    card.querySelector(".jd-file-body")?.append(element);
    card.append(actions);
  } else {
    (frame ?? ghost).append(element);
  }

  const root = createRoot(element);

  return new Promise((resolve) => {
    const answer = (picked: Answer) => {
      if (card) delete card.dataset.asking;
      unmountLater(root, element);
      actions.remove();
      resolve(picked);
    };

    root.render(
      card ? (
        <FileQuestion question={question} actions={actions} onAnswer={answer} />
      ) : (
        <PictureQuestion question={question} onAnswer={answer} />
      ),
    );
  });
}

type Props = { question: Question; onAnswer(answer: Answer): void };

/**
 * The bar along the foot of a picture still to be sent: what is the matter, the small print, the choices.
 *
 * @example <PictureQuestion question={question} onAnswer={resolve} />
 */
export function PictureQuestion({ question, onAnswer }: Props) {
  return (
    <span className="not-prose pointer-events-auto absolute inset-x-3 bottom-3 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-popover py-2 ps-3 pe-2 text-popover-foreground shadow-md">
      <span className="min-w-0">
        <Says question={question} />
        {question.note && <span className="block text-muted-foreground text-xs">{question.note}</span>}
      </span>
      <Choices choices={question.choices} onAnswer={onAnswer} />
    </span>
  );
}

/**
 * An attachment's question: the line under its name, and the choices at the end of its card.
 *
 * @example <FileQuestion question={question} actions={card.lastElementChild} onAnswer={resolve} />
 */
export function FileQuestion({ question, actions, onAnswer }: Props & { actions: HTMLElement }) {
  return (
    <>
      <Says question={question} className="mt-0.5" />
      {createPortal(<Choices choices={question.choices} onAnswer={onAnswer} />, actions)}
    </>
  );
}

/** The one line a question says, in amber when it warns. */
function Says({ question, className }: { question: Question; className?: string }) {
  return (
    <span
      className={cn(
        "block text-xs leading-relaxed",
        question.warning ? "text-amber-700/75 dark:text-amber-200/65" : "font-medium text-popover-foreground",
        className,
      )}
    >
      {question.says}
    </span>
  );
}

/**
 * The buttons a question offers, the primary one holding the keyboard so Enter takes it.
 *
 * Escape takes Cancel where there is one. Clicks and keys stay out of the editor around them.
 */
function Choices({ choices, onAnswer }: { choices: Choice[]; onAnswer(answer: Answer): void }) {
  return (
    <span
      role="toolbar"
      aria-label="What to upload"
      className="pointer-events-auto flex shrink-0 gap-1.5"
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && choices.some((choice) => choice.answer === "cancel")) onAnswer("cancel");
      }}
    >
      {choices.map((choice) => (
        <Button
          key={choice.answer}
          type="button"
          size="xs"
          variant={choice.primary ? "default" : "outline"}
          autoFocus={choice.primary}
          onClick={() => onAnswer(choice.answer)}
        >
          {choice.label}
        </Button>
      ))}
    </span>
  );
}
