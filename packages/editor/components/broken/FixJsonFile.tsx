"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { metaSchema } from "fumadocs-core/source/schema";
import { readJsonFile } from "@jotdown/core/lib/broken-file";
import { DOCS_ROOT, META_FILE, MOVED_FILE, movesSchema } from "@jotdown/core/lib/paths";
import { Button } from "@jotdown/core/components/ui/button";
import { Textarea } from "@jotdown/core/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@jotdown/core/components/ui/dialog";
import { fetchSource, saveSource, useLiveEditConfig } from "@jotdown/editor/client/api";

/**
 * Whether the studio can fix a file in place: a `meta.json` or the move record, the JSON a project keeps beside its pages.
 *
 * @example fixableInPlace("docs/guides/meta.json"); // true
 */
export function fixableInPlace(file: string) {
  return file === MOVED_FILE || (file.startsWith(`${DOCS_ROOT}/`) && file.split("/").pop() === META_FILE);
}

/**
 * A broken JSON file's text in an editor, checked as it is typed, saved only once it reads.
 *
 * The text is read from the branch when the dialog opens, so the save lands
 * on the file as it is now rather than as the page was rendered.
 *
 * @example <FixJsonFile file="docs/meta.json" open={open} onOpenChange={setOpen} />
 */
export function FixJsonFile({
  file,
  open,
  onOpenChange,
}: {
  file: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { apiBase } = useLiveEditConfig();
  const source = useQuery({
    queryKey: ["broken-file", apiBase, file],
    queryFn: () => fetchSource(apiBase, file),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{file}</DialogTitle>
          <DialogDescription>Fix the JSON below. Save turns on once it reads.</DialogDescription>
        </DialogHeader>
        {source.data ? (
          <Editor
            key={source.data.sha}
            file={file}
            text={source.data.text}
            sha={source.data.sha}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <p className={source.error ? "text-destructive" : "text-muted-foreground"}>
            {source.error?.message ?? "Reading the file…"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The editor itself, holding its own draft so a reread starts it afresh. */
function Editor({ file, text, sha, onSaved }: { file: string; text: string; sha: string; onSaved: () => void }) {
  const { apiBase, identity } = useLiveEditConfig();
  const router = useRouter();
  const [draft, setDraft] = useState(text);
  const [redrawing, redraw] = useTransition();
  const checked = readJsonFile(file === MOVED_FILE ? movesSchema : metaSchema, draft);

  const saving = useMutation({
    mutationFn: async () => {
      if (!identity) throw new Error("Sign in to fix this file.");
      return saveSource(apiBase, {
        path: file,
        text: draft.endsWith("\n") ? draft : `${draft}\n`,
        sha,
        message: `docs: fix ${file}\n\nFixed in Jotdown.`,
        author: identity,
      });
    },
    onSuccess: () =>
      redraw(() => {
        router.refresh();
        onSaved();
      }),
  });
  const busy = saving.isPending || redrawing;

  return (
    <>
      <Textarea
        className="max-h-[55vh] min-h-48 font-mono text-[0.8125rem] leading-relaxed"
        spellCheck={false}
        value={draft}
        disabled={busy}
        aria-invalid={!checked.ok}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p
        role="status"
        className={checked.ok ? "text-success" : "whitespace-pre-wrap font-mono text-destructive text-xs"}
      >
        {checked.ok ? "Reads as valid." : checked.problem}
      </p>
      {saving.error && (
        <p role="alert" className="text-destructive">
          {saving.error.message}
        </p>
      )}
      <DialogFooter>
        <Button disabled={!checked.ok || busy || !identity} onClick={() => saving.mutate()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
