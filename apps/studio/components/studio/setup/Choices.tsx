"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { QuestionnaireDescription, QuestionnaireTitle } from "@jotdown/core/components/ui/questionnaire";
import { QUESTION } from "./WizardFrame";

/**
 * A step's question, in the window's serif, and one line under it on what the answer decides.
 *
 * @example <Question title="Which folder holds the docs?" description="The config always sits at the root." />
 */
export function Question({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <QuestionnaireTitle className={cn(QUESTION, "mb-0!")}>{title}</QuestionnaireTitle>
      {description && <QuestionnaireDescription>{description}</QuestionnaireDescription>}
    </div>
  );
}

/** A path as the wizard names files, in the code face. */
export function Path({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-foreground/6 px-1 py-px font-mono text-[0.8125em] text-foreground">{children}</code>
  );
}

/** A choice's name, with an icon before it when it has one. */
export function ChoiceName({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}
