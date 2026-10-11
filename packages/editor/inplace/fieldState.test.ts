import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../markdown/pipeline";
import { createDraft, applyDraft } from "./draft";
import { createFields, frontmatterOf } from "./fieldState";

const PAGE = `---
title: Code review
icon: GitPullRequest
description: How we read each other's work.
---

Running text.
`;

describe("frontmatterOf", () => {
  it("names the same range the compiler gives the block", () => {
    const yaml = parseMarkdown(PAGE).children[0]!;
    const { start, end } = yaml.position!;

    expect(frontmatterOf(PAGE)?.stamp).toBe(`${start.line}:${start.column}-${end.line}:${end.column}`);
  });

  it("cuts exactly the block back out of the file", () => {
    const yaml = parseMarkdown(PAGE).children[0]!.position!;

    expect(frontmatterOf(PAGE)?.text).toBe(PAGE.slice(yaml.start.offset, yaml.end.offset));
  });

  it("reads historical BOM and CRLF front matter without changing unrelated bytes", () => {
    const source = `\uFEFF${PAGE.replaceAll("\n", "\r\n")}`;
    const position = parseMarkdown(source).children[0]!.position!;
    expect(frontmatterOf(source)?.text).toBe(source.slice(position.start.offset! + 1, position.end.offset! + 1));
    const draft = createDraft();
    const fields = createFields(source, draft);
    expect(fields.read("title")).toBe("Code review");
    fields.write("title", "Earlier title");
    expect(applyDraft(source, draft.edits())).toBe(source.replace("Code review", "Earlier title"));
  });

  it("has nothing to offer a file with no front matter", () => {
    expect(frontmatterOf("# Hi\n")).toBeNull();
    expect(frontmatterOf("---\ntitle: Unclosed\n")).toBeNull();
  });
});

describe("createFields", () => {
  it("reads what the file says", () => {
    const fields = createFields(PAGE, createDraft());

    expect(fields.read("title")).toBe("Code review");
    expect(fields.read("icon")).toBe("GitPullRequest");
    expect(fields.read("nothing")).toBeNull();
  });

  it("writes one field into the draft, and leaves the other lines alone", () => {
    const draft = createDraft();
    const fields = createFields(PAGE, draft);

    fields.write("title", "Reading each other's work");

    expect(applyDraft(PAGE, draft.edits())).toBe(
      PAGE.replace("title: Code review", "title: Reading each other's work"),
    );
  });

  it("keeps every field that was written before it", () => {
    const draft = createDraft();
    const fields = createFields(PAGE, draft);

    fields.write("title", "Reviews");
    fields.write("icon", null);

    const written = applyDraft(PAGE, draft.edits());
    expect(written).toContain("title: Reviews");
    expect(written).not.toContain("icon:");
    expect(written).toContain("description: How we read each other's work.");
    expect(fields.read("title")).toBe("Reviews");
  });

  it("goes back to clean when a field is put back the way it was", () => {
    const draft = createDraft();
    const fields = createFields(PAGE, draft);

    fields.write("title", "Reviews");
    expect(draft.edits().size).toBe(1);

    fields.write("title", "Code review");
    expect(draft.edits().size).toBe(0);
  });

  it("refuses to write anything at all to a file with no front matter", () => {
    const draft = createDraft();
    const fields = createFields("# Hi\n", draft);

    fields.write("title", "Anything");

    expect(fields.writable).toBe(false);
    expect(draft.edits().size).toBe(0);
  });
});
