import { describe, expect, it } from "vitest";
import { applyDraft, createDraft } from "./draft";

const FILE = `---
title: Stamped
---

First paragraph.

Second paragraph.
`;

describe("createDraft", () => {
  it("forgets a block that is written back to how it was", () => {
    const draft = createDraft();
    const seen: number[] = [];
    draft.subscribe(() => seen.push(draft.edits().size));

    draft.write("5:1-5:17", "Changed.");
    draft.write("5:1-5:17", null);

    expect(seen).toEqual([1, 0]);
    expect(draft.edits().size).toBe(0);
  });

  it("remounts block editors for replacements but leaves them mounted while typing", () => {
    const draft = createDraft();
    draft.replace("# Old\r\n");
    const revision = draft.revision();
    draft.write("1:1-1:6", "# Edited");
    expect(draft.revision()).toBe(revision);
    expect(draft.replacement()).toBe("# Old\r\n");
    draft.replace("# Old\r\n");
    expect(draft.revision()).toBeGreaterThan(revision);
    expect(draft.edits().size).toBe(0);
    draft.clear();
    expect(draft.replacement()).toBeNull();
  });

  it("says nothing when a write changes nothing", () => {
    const draft = createDraft();
    let calls = 0;
    draft.subscribe(() => (calls += 1));

    draft.write("5:1-5:17", "Changed.");
    draft.write("5:1-5:17", "Changed.");
    draft.write("7:1-7:18", null);

    expect(calls).toBe(1);
  });
});

describe("applyDraft", () => {
  it("splices the changed blocks and copies the rest byte for byte", () => {
    const written = applyDraft(FILE, new Map([["7:1-7:18", "Second, rewritten."]]));

    expect(written).toBe(`---
title: Stamped
---

First paragraph.

Second, rewritten.
`);
  });

  it("writes several blocks in one pass, whatever order they were typed in", () => {
    const written = applyDraft(
      FILE,
      new Map([
        ["7:1-7:18", "Also second."],
        ["5:1-5:17", "Also first."],
      ]),
    );

    expect(written).toBe(`---
title: Stamped
---

Also first.

Also second.
`);
  });

  it("skips a stamp the file no longer has, rather than guessing", () => {
    expect(applyDraft(FILE, new Map([["99:1-99:9", "Nowhere."]]))).toBe(FILE);
  });

  it("takes the separator with a block that was merged away", () => {
    expect(applyDraft(FILE, new Map([["5:1-5:17", ""]]))).toBe(`---
title: Stamped
---

Second paragraph.
`);
  });

  it("closes the gap when the last block goes, rather than leaving a blank line", () => {
    expect(applyDraft(FILE, new Map([["7:1-7:18", ""]]))).toBe(`---
title: Stamped
---

First paragraph.
`);
  });

  it("leaves the front matter alone when every block goes", () => {
    const written = applyDraft(
      FILE,
      new Map([
        ["5:1-5:17", ""],
        ["7:1-7:18", ""],
      ]),
    );

    expect(written).toBe(`---
title: Stamped
---
`);
  });

  it("grows a stamp's slice when a block was split in two", () => {
    const written = applyDraft(FILE, new Map([["5:1-5:17", "First.\n\nAnd a new one."]]));

    expect(written).toBe(`---
title: Stamped
---

First.

And a new one.

Second paragraph.
`);
  });
});
