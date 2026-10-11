import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDraft, createDraft } from "./draft";
import { createRecovery, type RecoveryCopy } from "./recovery";
import { recoverEdits } from "./recover-edits";

const copy: RecoveryCopy = { version: 1, source: "First.\n\nSecond.\n", edits: [["3:1-3:8", "Changed."]] };

afterEach(() => vi.unstubAllGlobals());

describe("recovery across deployments", () => {
  it("moves edits by whole-block text when lines shift", () => {
    const result = recoverEdits(copy, "# New heading\n\nFirst.\n\nSecond.\n");
    expect([...result.edits]).toEqual([["5:1-5:8", "Changed."]]);
    expect(result.conflicts).toEqual([]);
  });

  it("retains changed and ambiguous blocks for review", () => {
    for (const source of ["First.\n\nSomeone else's change.\n", "Second.\n\nSecond.\n"]) {
      const result = recoverEdits(copy, source);
      expect(result.edits.size).toBe(0);
      expect(result.conflicts).toEqual([{ stamp: "3:1-3:8", before: "Second.", after: "Changed." }]);
    }
  });

  it("refuses a formerly repeated block even when only one copy remains", () => {
    const result = recoverEdits({ ...copy, source: "Second.\n\nSecond.\n" }, "Second.\n");
    expect(result.edits.size).toBe(0);
    expect(result.conflicts).toHaveLength(1);
  });

  it("keeps identical blocks distinct on the same source", () => {
    const result = recoverEdits({ ...copy, source: "Second.\n\nSecond.\n" }, "Second.\n\nSecond.\n");
    expect([...result.edits]).toEqual(copy.edits);
  });

  it("recognizes a draft that the deployed file already contains", () => {
    expect(recoverEdits(copy, "First.\n\nChanged.\n")).toEqual({ edits: new Map(), conflicts: [] });
  });
});

describe("browser recovery copies", () => {
  /** Gives each test an isolated browser storage with inspectable values. */
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    return values;
  }

  it("recovers structural edits and deletes the copy when explicitly discarded", async () => {
    const values = storage();
    const draft = createDraft();
    const recovery = createRecovery("page", copy.source, draft);
    await recovery.start();
    draft.write("1:1-1:7", "First.\n\nInserted.");
    draft.write("3:1-3:8", "");
    const restored = createDraft();
    const next = createRecovery("page", copy.source, restored);
    await next.start();
    expect([...restored.edits()]).toEqual([...draft.edits()]);
    next.clear();
    expect(values.size).toBe(0);
  });

  it("persists new edits while keeping unresolved older changes", async () => {
    const values = storage();
    values.set("live-edit:recovery:page", JSON.stringify(copy));
    const source = "First.\n\nChanged remotely.\n";
    const draft = createDraft();
    const recovery = createRecovery("page", source, draft);
    await recovery.start();
    draft.write("1:1-1:7", "New local edit.");
    const nextDraft = createDraft();
    const next = createRecovery("page", source, nextDraft);
    await next.start();
    expect(nextDraft.edits().get("1:1-1:7")).toBe("New local edit.");
    expect(next.get().conflicts[0]!.after).toBe("Changed.");
    next.dismissConflict("3:1-3:8");
    expect(JSON.parse(values.get("live-edit:recovery:page")!).conflicts).toEqual([]);
  });

  it("removes an acknowledged recovery copy before another deployment can revisit it", async () => {
    const values = storage();
    values.set("live-edit:recovery:page", JSON.stringify(copy));
    const recovery = createRecovery("page", "First.\n\nChanged.\n", createDraft());
    await recovery.start();
    expect(values.size).toBe(0);
  });

  it("keeps a loaded version and further edits through reload until the normal save clears them", async () => {
    const values = storage();
    const historical = "---\ntitle: Previous\n---\n\nOld words.\n";
    const draft = createDraft();
    const recovery = createRecovery("page", copy.source, draft);
    await recovery.start();
    draft.write("1:1-1:7", "Existing edit.");
    recovery.replace(historical);
    expect(draft.edits().size).toBe(0);
    expect(draft.replacement()).toBe(historical);
    expect(JSON.parse(values.get("live-edit:recovery:page")!).source).toBe(copy.source);
    draft.write("5:1-5:11", "Edited old words.");

    const reloaded = createDraft();
    const next = createRecovery("page", copy.source, reloaded);
    await next.start();
    expect(reloaded.replacement()).toBe(historical);
    expect(applyDraft(reloaded.replacement()!, reloaded.edits())).toBe(
      historical.replace("Old words.", "Edited old words."),
    );
    next.clear();
    expect(values.size).toBe(0);
    expect(reloaded.replacement()).toBeNull();
  });

  it("preserves an empty version as an intentional page replacement", async () => {
    storage();
    const recovery = createRecovery("page", copy.source, createDraft());
    await recovery.start();
    recovery.replace("");
    const reloaded = createDraft();
    await createRecovery("page", copy.source, reloaded).start();
    expect(reloaded.replacement()).toBe("");
  });

  it("retains a whole-page replacement as a conflict when the saved page changes", () => {
    const restored: RecoveryCopy = {
      version: 1,
      source: copy.source,
      replacement: "Old words.\n",
      edits: [["1:1-1:11", "Edited old words."]],
    };
    expect(recoverEdits(restored, "A colleague's new page.\n")).toEqual({
      edits: new Map(),
      conflicts: [{ stamp: "page", before: copy.source, after: "Edited old words.\n" }],
    });
    expect(recoverEdits(restored, "Edited old words.\n")).toEqual({ edits: new Map(), conflicts: [] });
  });

  it("reports storage failures without dropping the in-memory draft", async () => {
    storage();
    const draft = createDraft();
    const recovery = createRecovery("page", copy.source, draft);
    await recovery.start();
    vi.stubGlobal("localStorage", {
      setItem() {
        throw new Error("Quota exceeded");
      },
    });
    draft.write("3:1-3:8", "Still here.");
    expect(recovery.get().error).toContain("could not keep");
    expect(draft.edits().get("3:1-3:8")).toBe("Still here.");
  });
});
