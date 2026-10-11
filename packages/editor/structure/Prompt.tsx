"use client";

import { useId, useState } from "react";
import { Button } from "@jotdown/core/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@jotdown/core/components/ui/dialog";
import { Input } from "@jotdown/core/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jotdown/core/components/ui/select";

/** Where a thing can be moved to, as the picker offers it. */
export type Destination = { path: string; label: string; depth: number };

type Props = {
  heading: string;
  /** Prefilled name. Absent means this prompt does not ask for one. */
  name?: string;
  /** What the name field is called. Defaults to `Title`. */
  nameLabel?: string;
  namePlaceholder?: string;
  /** Sections to choose between. Absent means this prompt does not ask. */
  destinations?: Destination[];
  destination?: string;
  confirmLabel: string;
  onConfirm(answer: { name: string; destination: string }): void;
  onCancel(): void;
};

/** The uppercase micro-label above a field. */
const LABEL = "font-label text-xs font-medium tracking-[0.07em] text-muted-foreground uppercase";

/**
 * The one dialog behind every structural change.
 *
 * Creating, renaming and moving all ask the same two questions in different
 * combinations, so they share a form rather than each growing their own. A
 * prompt that leaves out `name` or `destinations` simply does not ask that one.
 *
 * Escape cancels and Enter confirms, because this interrupts somebody who was
 * in the middle of arranging a tree and should cost them one keystroke.
 *
 * It is a modal dialog, which portals itself out of the sidebar. Its caller is
 * a sidebar row, and the sidebar is a scrolling column that both clips a fixed
 * child and is what `fixed` ends up measured against; left in place the form
 * would be cropped out of sight.
 */
export default function Prompt({
  heading,
  name,
  nameLabel = "Title",
  namePlaceholder,
  destinations,
  destination,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState(name ?? "");
  const [chosen, setChosen] = useState(destination ?? destinations?.[0]?.path ?? "");
  const nameId = useId();
  const insideId = useId();

  const ready = name === undefined || typed.trim().length > 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onConfirm({ name: typed.trim(), destination: chosen });
          }}
        >
          <DialogTitle className="font-bold font-serif text-lg">{heading}</DialogTitle>

          {name !== undefined && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className={LABEL}>
                {nameLabel}
              </label>
              <Input
                id={nameId}
                autoFocus
                value={typed}
                placeholder={namePlaceholder}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
          )}

          {destinations && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={insideId} className={LABEL}>
                Inside
              </label>
              <Select value={chosen} onValueChange={setChosen}>
                <SelectTrigger id={insideId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map(({ path, label, depth }) => (
                    <SelectItem key={path} value={path} style={{ paddingInlineStart: 8 + depth * 12 }}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!ready}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
