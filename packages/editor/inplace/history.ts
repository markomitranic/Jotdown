/**
 * Everything the reader has done to this page, in the order they did it.
 *
 * Every block here is its own editor, so a split writes to two of them, a merge
 * writes to one and takes another off the page, and a slash-menu choice does
 * both. An editor's own undo stack can only put back the half that happened
 * inside it, which is why no editor on the page keeps one: they all hand their
 * changes to this record instead, and the structural moves put themselves in
 * the same list beside them. One Cmd+Z is one entry, however many editors that
 * entry touched.
 *
 * Nothing here knows what a change is. A change is a pair of functions, so a
 * document going back to how it read and a block coming back onto the article
 * sit in the same entry and run in the same reverse order. That is also what
 * keeps this module free of imports: the page's provider holds the record from
 * its first render, and a reader who never types must not download an editor to
 * get one. Everything that knows what a Tiptap editor is lives beside it.
 */

/** One reversible thing that happened, whichever editor or element it happened to. */
export type Change = { undo(): void; redo(): void };

export type History = {
  /**
   * Records one change, and forgets everything an undo had put aside.
   *
   * Consecutive changes carrying the same `into` grow the entry already there
   * rather than starting another, which is what makes a run of typing undo as
   * a phrase rather than a letter at a time.
   */
  did(change: Change, into?: object): void;
  /**
   * Runs `body`, and folds everything it records into one entry.
   *
   * Only a synchronous body, deliberately. Holding the record open across an
   * await would fold in whatever the reader typed elsewhere while they waited,
   * so work that finishes later records its own change once it is finished.
   */
  batch<T>(body: () => T): T;
  /** Reverses the last entry, and reports whether there was one to reverse. */
  undo(): boolean;
  /** Puts back the last entry an undo reversed. */
  redo(): boolean;
};

/** How long a run of typing keeps growing the entry it started. */
const GROUP_MS = 400;

type Entry = {
  changes: Change[];
  /** Who recorded it, while it may still grow, and null once it is sealed. */
  into: object | null;
  at: number;
};

/**
 * The page's record of what happened, with nothing in it yet.
 *
 * @example const history = createHistory(); history.did(change, editor);
 */
export function createHistory(now: () => number = Date.now): History {
  const done: Entry[] = [];
  const undone: Entry[] = [];
  let running = false;

  /** Runs one entry's changes, and keeps whatever they cause out of the record. */
  function run(entry: Entry, way: "undo" | "redo") {
    const order = way === "undo" ? [...entry.changes].reverse() : entry.changes;
    running = true;
    try {
      for (const change of order) change[way]();
    } finally {
      running = false;
    }
  }

  function did(change: Change, into?: object) {
    if (running) return;
    undone.length = 0;

    const last = done.at(-1);
    const only = last?.changes[0];
    const grows =
      into !== undefined &&
      last !== undefined &&
      last.into === into &&
      last.changes.length === 1 &&
      now() - last.at < GROUP_MS;

    if (grows && last !== undefined && only !== undefined) {
      last.changes[0] = { undo: only.undo, redo: change.redo };
      last.at = now();
      return;
    }

    done.push({ changes: [change], into: into ?? null, at: now() });
  }

  function mark() {
    const last = done.at(-1);
    if (last !== undefined) last.into = null;
    return done.length;
  }

  function fold(from: number) {
    if (done.length <= from) return;
    const changes = done.splice(from).flatMap((entry) => entry.changes);
    done.push({ changes, into: null, at: now() });
  }

  return {
    did,

    batch(body) {
      const from = mark();
      try {
        return body();
      } finally {
        fold(from);
      }
    },

    undo() {
      const entry = done.pop();
      if (entry === undefined) return false;

      run(entry, "undo");
      undone.push(entry);
      return true;
    },

    redo() {
      const entry = undone.pop();
      if (entry === undefined) return false;

      run(entry, "redo");
      done.push(entry);
      return true;
    },
  };
}
