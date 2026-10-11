"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { changesIn } from "./queue";
import { useStructure } from "./useStructure";

/**
 * The card in the corner that says what the staged sidebar changes are up to.
 *
 * Nothing while nothing is staged. From the first change on, it counts them and
 * offers Save, and it is where a failed save is reported.
 *
 * @example <StructureBar />
 */
export default function StructureBar() {
  const structure = useStructure();
  const panel = structure && structurePanel(structure);

  if (!panel) return null;

  return createPortal(<div className="fixed bottom-4 left-76 z-200 max-w-96">{panel}</div>, document.body);
}

/** Builds the card for where the staged changes are up to, or null while nothing is staged. */
function structurePanel({ phase, ops, save, undo, discard, dismiss }: Structure) {
  if (phase.name === "failed") {
    return (
      <Panel role="alert">
        <p>{phase.message}</p>
        <PanelRow>
          <Button variant="outline" size="sm" onClick={dismiss}>
            Close
          </Button>
        </PanelRow>
      </Panel>
    );
  }

  if (phase.name === "behind") {
    return (
      <Panel role="status">
        <p>{plural(phase.changed, "file")} committed, but the studio has not caught up yet.</p>
        <PanelRow>
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </PanelRow>
      </Panel>
    );
  }

  if (phase.name === "saving") return <Waiting>Saving {plural(phase.changes, "change")}…</Waiting>;

  if (ops.length === 0) return null;

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {plural(changesIn(ops), "unsaved change")}
        </span>
        <span className="ms-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Undo last change" title="Undo last change" onClick={undo}>
            <Undo2 />
          </Button>
          <Button variant="ghost" size="sm" onClick={discard}>
            Discard
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </span>
      </div>
    </Panel>
  );
}

/** Renders a floating status card above the page content. */
function Panel({ role, children }: { role?: string; children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-border bg-popover/95 px-3 py-2 text-popover-foreground text-sm shadow-lg backdrop-blur [&_p:last-child]:mb-0 [&_p]:m-0 [&_p]:mb-2"
      role={role}
    >
      {children}
    </div>
  );
}

/**
 * A card for a step nobody can do anything about while it runs.
 *
 * No buttons, because the only honest ones would be disabled, and a spinner,
 * because a commit and the refresh that draws it take long enough that a
 * still card reads as a stall.
 */
function Waiting({ children }: { children: ReactNode }) {
  return (
    <Panel role="status">
      <p className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        {children}
      </p>
    </Panel>
  );
}

/**
 * A count with its noun, pluralised.
 *
 * @example plural(1, "change"); // "1 change"
 */
function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Groups the actions associated with one arrangement status. */
function PanelRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

type Structure = NonNullable<ReturnType<typeof useStructure>>;
