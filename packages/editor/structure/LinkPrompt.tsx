"use client";

import { useId, useState } from "react";
import { Button } from "@jotdown/core/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@jotdown/core/components/ui/dialog";
import { Input } from "@jotdown/core/components/ui/input";
import IconPicker from "../editor/IconPicker";
import { leavesTheSite, type SidebarLink } from "@jotdown/core/lib/paths";

type Props = {
  heading: string;
  /** The link being edited, or null when this one is being invented. */
  link: SidebarLink | null;
  confirmLabel: string;
  onConfirm(link: SidebarLink): void;
  onCancel(): void;
};

/** The uppercase micro-label above a field, as the other prompt draws it. */
const LABEL = "font-label text-xs font-medium tracking-[0.07em] text-muted-foreground uppercase";

const BLANK: SidebarLink = { label: "", url: "", icon: null, external: false };

/**
 * The form behind a sidebar link, which asks what the structural prompt cannot.
 *
 * Creating, renaming and moving a page are the same two questions in different
 * combinations, which is why they share one dialog. A link asks three different
 * ones and has no file, no slug and no destination, so it gets its own rather
 * than growing the other one three fields it would hide four times out of five.
 *
 * Escape cancels and Enter confirms, same as its sibling.
 */
export default function LinkPrompt({ heading, link, confirmLabel, onConfirm, onCancel }: Props) {
  const [draft, setDraft] = useState<SidebarLink>(link ?? BLANK);
  const textId = useId();
  const addressId = useId();

  const label = draft.label.trim();
  const url = draft.url.trim();
  const ready = label.length > 0 && url.length > 0;
  const staysHere = url.length > 0 && !leavesTheSite(url);

  const change = (next: Partial<SidebarLink>) => setDraft((was) => ({ ...was, ...next }));

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onConfirm({ ...draft, label, url });
          }}
        >
          <DialogTitle className="font-bold font-serif text-lg">{heading}</DialogTitle>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={textId} className={LABEL}>
              Text
            </label>
            <Input
              id={textId}
              autoFocus
              value={draft.label}
              placeholder="What the sidebar row says"
              onChange={(event) => change({ label: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={addressId} className={LABEL}>
              Address
            </label>
            <Input
              id={addressId}
              value={draft.url}
              placeholder="https://nextjs.org/docs"
              onChange={(event) => change({ url: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Icon</span>
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <IconPicker value={draft.icon} readOnly={false} onChange={(icon) => change({ icon })} />
              {draft.icon ?? "None"}
            </span>
          </div>

          {staysHere && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={draft.external}
                onChange={(event) => change({ external: event.target.checked })}
              />
              <span className="text-muted-foreground">
                Reload the whole page when it is clicked, rather than navigating inside the app. Only worth it for an
                address this site serves but does not build.
              </span>
            </label>
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
