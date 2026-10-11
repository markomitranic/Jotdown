"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "cn";
import { Check } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

/** One step of the wizard, as the side panel names it. */
export type WizardStep = { id: string; label: string };

type Props = {
  steps: WizardStep[];
  /** The step on screen, or the number of steps once every one is done. */
  at: number;
  onStep: (index: number) => void;
  /** Escape: a step back, or closing on the first step. */
  onEscape: () => void;
  /** Whether a click outside the window closes it, which it stops doing once answers would be lost. */
  dismissable: boolean;
  /** The window's right side: the question, its answers and the bar of buttons. */
  children: ReactNode;
};

/** What takes focus when a step opens: its chosen answer, else its first control. */
const FIRST_CONTROL =
  'input[type="radio"]:checked, input:not([type="file"]):not([tabindex="-1"]), [role="radio"], [role="checkbox"], button';

/** The look of a step's question, a serif headline over its answers. */
export const QUESTION = "font-serif text-[1.625rem]/tight font-normal tracking-[-0.01em] text-balance text-foreground";

/**
 * The wizard's window: the page fades into the welcome screen's night painting, and a pane of frosted glass sits over it, a fixed size whatever the step, the way an installer's is.
 *
 * Every border inside the glass is one grey, the theme's border token tinted
 * from the text colour, so inputs, choices, lists and dividers all match.
 * The steps run down the side and a step already answered can be clicked to go
 * back to it. The right side is the wizard's own: its question, its answers
 * and a bar of buttons along the foot. On a narrow screen the steps give way
 * to a line across the top that fills as they do.
 *
 * @example <WizardFrame steps={steps} at={2} onStep={setAt} onEscape={back} dismissable={false}>…</WizardFrame>
 */
export function WizardFrame({ steps, at, onStep, onEscape, dismissable, children }: Props) {
  return (
    <>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-hidden bg-black data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in">
        <Image
          src="/studio/night-painted.svg"
          alt=""
          width={1920}
          height={1080}
          unoptimized
          className="pointer-events-none size-full object-cover object-bottom"
        />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          onEscape();
        }}
        onInteractOutside={(event) => !dismissable && event.preventDefault()}
        className="fixed top-1/2 left-1/2 z-50 flex h-[min(38rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[52rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white/72 text-foreground text-sm shadow-[0_30px_90px_rgb(10_5_40/0.6)] outline-none ring-1 ring-white/60 backdrop-blur-2xl backdrop-saturate-150 [--color-border:color-mix(in_oklab,var(--color-foreground)_10%,transparent)] data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in dark:bg-black/50 dark:ring-white/15"
      >
        <DialogPrimitive.Title className="sr-only">Set up a new project</DialogPrimitive.Title>

        <aside className="hidden w-48 shrink-0 flex-col border-border border-e px-2 py-4 sm:flex">
          <p className="flex items-center gap-2 px-2.5 font-label text-[0.8125rem] tracking-[0.01em]">
            <Image src="/icon.png" alt="" width={24} height={24} className="size-6 rounded-md" />
            Jotdown setup
          </p>

          <ol className="mt-6 flex flex-col gap-px">
            {steps.map((step, index) => {
              const done = index < at;
              const current = index === at;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!done}
                    aria-current={current ? "step" : undefined}
                    onClick={() => onStep(index)}
                    className={cn(
                      "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-start text-[0.8125rem] outline-none transition-colors focus-visible:bg-foreground/8",
                      current && "bg-foreground/8 font-medium",
                      done && "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
                      !done && !current && "text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4.5 shrink-0 place-items-center rounded-full border text-[0.625rem] tabular-nums",
                        current
                          ? "border-primary bg-primary text-primary-foreground"
                          : done
                            ? "border-foreground/40"
                            : "border-foreground/20",
                      )}
                    >
                      {done ? <Check className="size-2.5" /> : index + 1}
                    </span>
                    {step.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col">
          <div aria-hidden="true" className="h-0.5 shrink-0 bg-border sm:hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${(Math.min(at + 1, steps.length) / steps.length) * 100}%` }}
            />
          </div>
          {children}
        </section>
      </DialogPrimitive.Content>
    </>
  );
}

/**
 * The scrolling part of the window, which hands focus to a step's answer as the step opens, so the keyboard carries on where it was.
 *
 * The questionnaire focuses the step itself first, so the hand-off waits a frame and moves on from there.
 *
 * @example <WizardBody at={at}>…</WizardBody>
 */
export function WizardBody({ at, children }: { at: number; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hands focus on each time another step opens
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!body.current) return;
      const step =
        body.current.querySelector<HTMLElement>("[data-slot=questionnaire-item]:not([hidden])") ?? body.current;
      const focused = document.activeElement;
      if (focused !== step && focused !== document.body && body.current.contains(focused)) return;
      step.querySelector<HTMLElement>(FIRST_CONTROL)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [at]);

  return (
    <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-7 pt-7 pb-6">
      {children}
    </div>
  );
}

/** The bar along the window's foot: the keys it answers on the left, its buttons on the right. */
export function WizardFooter({ children }: { children: ReactNode }) {
  return <footer className="flex shrink-0 items-center gap-2 border-border border-t px-4 py-3">{children}</footer>;
}
