import { describe, expect, test } from "vitest";
import { pageWriteRefusal } from "./_generated";

const generated = "---\ntitle: API\ngenerated: true\n---\n\n# API\n";

describe("generated page writes", () => {
  test("reads the YAML boolean, including quoted keys and comments", () => {
    expect(pageWriteRefusal("docs/api.mdx", generated)).toContain("read-only");
    expect(pageWriteRefusal("docs/api.mdx", '---\n"generated": TRUE # from a tool\n---\n')).toContain("read-only");
    expect(pageWriteRefusal("docs/api.mdx", "---\ngenerated: false\n---\n")).toBeNull();
    expect(pageWriteRefusal("docs/api.mdx", "# Manual\n\n```yaml\ngenerated: true\n```\n")).toBeNull();
  });

  test("refuses malformed front matter that may be generated, and lets the rest be fixed", () => {
    expect(pageWriteRefusal("docs/api.mdx", "---\ngenerated: [\n---\n")).toContain("invalid front matter");
    expect(pageWriteRefusal("docs/setup.mdx", "---\ntitle: Setup: the basics\n---\n")).toBeNull();
  });
});
