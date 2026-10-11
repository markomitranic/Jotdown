"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
import type { UploadStatus } from "../editor/uploads";

/**
 * What the page says about a file on its way into the repository.
 *
 * Uploading is the one in-place edit that leaves the browser and can fail for a
 * reason the reader has to do something about: not signed in, too big, the
 * wrong kind of file. Every other edit is local and shows itself, so this is
 * the only notice the article needs before the save toolbar exists.
 *
 * Files go up one at a time, so a run of several counts which one is on its way.
 * A failure is said with a warning sign, and a picture that failed leaves a
 * placeholder on the page where it was meant to go.
 *
 * @example <UploadNotice status={{ busy: 2, total: 3, error: null }} onDismiss={clear} />
 */
export function UploadNotice({ status, onDismiss }: { status: UploadStatus; onDismiss(): void }) {
  if (status.busy === 0 && status.error === null) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-popover px-4 py-2.5 text-popover-foreground text-sm shadow-md"
    >
      {status.error === null ? (
        <>
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          {status.total === 1 ? "Uploading a file." : `Uploading ${status.total - status.busy + 1} of ${status.total}.`}
        </>
      ) : (
        <>
          <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>{status.error}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
