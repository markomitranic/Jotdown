import { describe, expect, test } from "vitest";
import { prefillFields, repairFrontmatter } from "./repair";

const fields = { title: "Setup", description: "", icon: "" };

describe("front matter repair", () => {
  test("adds a missing title and keeps every other field where it stands", () => {
    expect(repairFrontmatter("---\nicon: Rocket\nfull: true\n---\n\nBody\n", { ...fields, icon: "Rocket" })).toEqual({
      text: "---\nicon: Rocket\nfull: true\ntitle: Setup\n---\n\nBody\n",
      dropped: [],
    });
  });

  test("rewrites a value YAML cannot read, prefilled from the broken line", () => {
    const text = "---\ntitle: Setup: the basics\n---\n\nBody\n";
    expect(prefillFields(text).title).toBe("Setup: the basics");
    expect(repairFrontmatter(text, prefillFields(text)).text).toBe('---\ntitle: "Setup: the basics"\n---\n\nBody\n');
  });

  test("drops a field the schema refuses and says so", () => {
    expect(repairFrontmatter("---\ntitle: Setup\nfull: often\n---\nBody\n", fields)).toEqual({
      text: "---\ntitle: Setup\n---\nBody\n",
      dropped: ["full"],
    });
  });

  test("writes front matter for a page that has none, or none that parses", () => {
    expect(repairFrontmatter("# Setup\n", fields).text).toBe("---\ntitle: Setup\n---\n\n# Setup\n");
    expect(repairFrontmatter("\uFEFF---\ntitle: A: B\n---\nBody\n", fields).text).toBe(
      "---\ntitle: Setup\n---\nBody\n",
    );
    expect(repairFrontmatter("---\ntitle: Setup\n  bad: [\n---\nBody\n", fields)).toEqual({
      text: "---\ntitle: Setup\n---\nBody\n",
      dropped: [],
    });
  });
});
