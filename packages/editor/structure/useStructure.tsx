"use client";

/**
 * Staging changes to the sidebar and committing them.
 *
 * One queue, one commit. The sidebar is always arrangeable in the studio.
 *
 * Staging exists because people draft: they make a page, dislike the name, move
 * it somewhere else and then decide the folder was the better idea. Committing
 * each of those would be six commits, six deploys and five minutes of waiting.
 *
 * The queue survives a reload, because losing a half-built rearrangement to a
 * stray refresh is the kind of thing that stops people using a tool at all.
 *
 * A save is not over when GitHub accepts it but when the studio draws the
 * commit it made. Until then the committed changes stay drawn over the old
 * tree, so nothing a reader just arranged blinks out and back.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LiveEditFailure, saveStructure, useLiveEditConfig } from "../client/api";
import { useIdentity, type EditorIdentity } from "../client/identity";
import type { StructureOp, StructureRequest } from "../types";
import { changesIn, undone } from "./queue";

const QUEUE_KEY = "live-edit:structure-queue";
const DRAWN_WITHIN_MS = 15_000;

/** Where the staged changes are up to. */
export type Phase =
  | { name: "idle" }
  | { name: "saving"; changes: number }
  | { name: "behind"; changed: number }
  | { name: "failed"; message: string };

/** A commit that landed but the studio has not drawn yet, and the changes it carried. */
type Landing = { sha: string; ops: StructureOp[]; changed: number };

export type Structure = {
  phase: Phase;
  ops: StructureOp[];
  /** What the sidebar draws: the staged changes, after a landing commit's own until the studio has drawn it. */
  drawn: StructureOp[];
  queue(op: StructureOp): void;
  undo(): void;
  discard(): void;
  save(): void;
  dismiss(): void;
  /** Commits one change on its own, deleting a page say. */
  commitNow(op: StructureOp, who: EditorIdentity): void;
};

const StructureContext = createContext<Structure | null>(null);

/**
 * The staged changes, shared by the sidebar rows and the card in the corner.
 *
 * A context rather than a hook per component, because a queued change made on
 * one row has to redraw every other row.
 */
export function StructureProvider({ children }: { children: ReactNode }) {
  const { apiBase, version } = useLiveEditConfig();
  const { identity } = useIdentity();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [ops, setStaged] = useState<StructureOp[]>([]);
  const [landing, setLanding] = useState<Landing | null>(null);

  /**
   * Changes the queue and the copy a reload reads back, together.
   *
   * Not an effect on `ops`: that would run once with the empty queue of the
   * first render and wipe the saved one before it could be read back.
   */
  const setOps = useCallback((change: (current: StructureOp[]) => StructureOp[]) => {
    setStaged((current) => {
      const next = change(current);
      writeQueue(next);
      return next;
    });
  }, []);

  useEffect(() => setStaged(readQueue()), []);

  const { mutateAsync: send } = useMutation({
    mutationFn: (body: StructureRequest) => saveStructure(apiBase, body),
    onMutate: (body) => setPhase({ name: "saving", changes: changesIn(body.ops) }),
    onError: (error) => setPhase({ name: "failed", message: describe(error) }),
  });

  const staging = ops.length > 0;
  const drawn = useMemo(
    () => (landing === null || landing.sha === version ? ops : [...landing.ops, ...ops]),
    [landing, ops, version],
  );

  useEffect(() => {
    if (!landing) return;

    if (landing.sha === version) {
      setLanding(null);
      setPhase({ name: "idle" });
      return;
    }

    const timer = setTimeout(() => setPhase({ name: "behind", changed: landing.changed }), DRAWN_WITHIN_MS);
    return () => clearTimeout(timer);
  }, [landing, version]);

  /**
   * Commits a queue of changes.
   *
   * Shared by Save and by a change committed on its own, because the difference
   * between them is which ops go up, not what happens after GitHub says yes.
   *
   * `onCommitted` runs the moment GitHub accepts the commit. That is when a
   * queue stops being staged: a reload after it should not offer to apply a
   * rearrangement the repo already has. The save keeps saying so until a
   * refresh draws the commit, or says the studio is behind if none has in time.
   */
  const commit = useCallback(
    async (queued: StructureOp[], who: EditorIdentity, onCommitted?: () => void) => {
      const sent = await send({ ops: queued, author: who }).catch(() => null);
      if (!sent) return;

      onCommitted?.();
      setLanding({ sha: sent.commitSha, ops: queued, changed: sent.changed });
      router.refresh();
    },
    [router, send],
  );

  const value = useMemo<Structure>(
    () => ({
      phase,
      ops,
      drawn,
      queue: (op) => setOps((current) => [...current, op]),
      undo: () => setOps(undone),
      discard: () => {
        setOps(() => []);
        setPhase({ name: "idle" });
      },
      save: () => {
        if (identity && staging) void commit(ops, identity, () => setOps(() => []));
      },
      commitNow: (op, who) => void commit([op], who),
      dismiss: () => setPhase({ name: "idle" }),
    }),
    [commit, drawn, identity, ops, phase, setOps, staging],
  );

  return <StructureContext.Provider value={value}>{children}</StructureContext.Provider>;
}

/**
 * The staging session, or null outside the provider.
 *
 * Null is a real answer rather than a mistake: the sidebar renders on a preview
 * and under a dev server too, where there is nothing to stage into.
 */
export function useStructure() {
  return useContext(StructureContext);
}

/** A refusal, with the first thing the reader could do about it if there is one. */
function describe(error: Error) {
  const [first] = (error instanceof LiveEditFailure && error.answer.refusals) || [];
  return first ? first.reason : error.message;
}

/**
 * Reads the staged queue back after a reload.
 *
 * Anything that will not parse is dropped rather than repaired. A queue is a
 * convenience, and half a queue applied to a tree is worse than none.
 */
function readQueue(): StructureOp[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as StructureOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: StructureOp[]) {
  try {
    if (ops.length === 0) window.localStorage.removeItem(QUEUE_KEY);
    else window.localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    return;
  }
}
