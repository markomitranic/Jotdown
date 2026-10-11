import { z } from "zod";
import type { Draft } from "./draft";
import { announceRecovery, recoveryKey } from "./unsaved";

const savedDraft = z.object({
  version: z.literal(1),
  source: z.string(),
  replacement: z.string().optional(),
  edits: z.array(z.tuple([z.string(), z.string()])),
  conflicts: z.array(z.object({ stamp: z.string(), before: z.string(), after: z.string() })).optional(),
});

export type RecoveryCopy = z.infer<typeof savedDraft>;
export type Conflict = { stamp: string; before: string; after: string };
type RecoveryState = {
  current: boolean;
  error: string | null;
  conflicts: Conflict[];
};

/**
 * Keeps a page's draft in browser storage and publishes comparison and recovery state.
 * @example const recovery = createRecovery("/api/live-edit:docs/index.mdx", source, draft);
 */
export function createRecovery(key: string, source: string, draft: Draft) {
  const storageKey = recoveryKey(key);
  const listeners = new Set<() => void>();
  let state: RecoveryState = { current: false, error: null, conflicts: [] };
  let starting: Promise<void> | null = null;

  /** Publishes a new state without rerendering the article. */
  function update(patch: Partial<RecoveryState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  /**
   * Writes immediately so navigation and closing a tab need no pending timer.
   *
   * The announcement is for whatever is on screen outside this page, the
   * sidebar's mark against a page with changes waiting on it being the one.
   */
  function persist() {
    try {
      if (draft.edits().size === 0 && draft.replacement() === null && state.conflicts.length === 0)
        localStorage.removeItem(storageKey);
      else
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 1,
            source,
            replacement: draft.replacement() ?? undefined,
            edits: [...draft.edits()],
            conflicts: state.conflicts,
          } satisfies RecoveryCopy),
        );
      if (state.error) update({ error: null });
    } catch {
      update({ error: "This browser could not keep a recovery copy. Keep this tab open or copy your changes." });
    }

    announceRecovery();
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Loads once before editors mount, then persists every draft change. */
    start() {
      starting ??= (async () => {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored !== null) {
            const original = savedDraft.parse(JSON.parse(stored));
            const { recoverEdits } = await import("./recover-edits");
            const recovered = recoverEdits(original, source);
            if (recovered.replacement !== undefined) draft.replace(recovered.replacement);
            for (const [stamp, markdown] of recovered.edits) draft.write(stamp, markdown);
            update({ conflicts: recovered.conflicts });
            persist();
          }
        } catch {
          update({ error: "The recovery copy could not be read. It has been left in browser storage." });
        }
        draft.subscribe(persist);
      })();
      return starting;
    },
    /** Loads Markdown as a local draft, preserving the deployed source as the save baseline. */
    replace(markdown: string) {
      update({ conflicts: [], current: false });
      draft.replace(markdown);
    },
    compare(current: boolean) {
      update({ current });
    },
    /** Forgets an explicitly dismissed conflict, then resumes normal recovery writes. */
    dismissConflict(stamp: string) {
      update({ conflicts: state.conflicts.filter((conflict) => conflict.stamp !== stamp) });
      persist();
    },
    /** Removes recovery after an accepted save or an explicit discard. */
    clear() {
      update({ conflicts: [], current: false });
      draft.clear();
      persist();
    },
  };
}

export type Recovery = ReturnType<typeof createRecovery>;
