import { describe, expect, it } from "vitest";
import { addressOf } from "./paths";

describe("addressOf", () => {
  it("resolves a link the way the build resolves it", () => {
    expect(addressOf("./bun.md", "docs/tooling/index.mdx")).toBe("/tooling/bun");
    expect(addressOf("../architecture/bff.mdx", "docs/tooling/bun.md")).toBe("/architecture/bff");
    expect(addressOf("Form.md", "docs/api/index.md")).toBe("/api/Form");
  });

  it("keeps a fragment on the end of the page it points into", () => {
    expect(addressOf("./bun.md#install", "docs/tooling/index.mdx")).toBe("/tooling/bun#install");
  });

  it("leaves anything that already says where it goes", () => {
    expect(addressOf("https://x.test/a", "docs/a.mdx")).toBe("https://x.test/a");
    expect(addressOf("mailto:a@x.test", "docs/a.mdx")).toBe("mailto:a@x.test");
    expect(addressOf("#further-down", "docs/a.mdx")).toBe("#further-down");
    expect(addressOf("/manual/browser-editor", "docs/a.mdx")).toBe("/manual/browser-editor");
    expect(addressOf("/img/docs/shot.png", "docs/a.mdx")).toBe("/img/docs/shot.png");
  });

  it("serves a link under the project's base in the studio", () => {
    expect(addressOf("./bun.md", "docs/tooling/index.mdx", "/you/notes")).toBe("/you/notes/tooling/bun");
    expect(addressOf("/manual/sections", "docs/a.mdx", "/you/notes")).toBe("/you/notes/manual/sections");
    expect(addressOf("../index.mdx", "docs/tooling/bun.md", "/you/notes")).toBe("/you/notes");
  });

  it("hands back a link that climbs past the root, since it pointed at nothing already", () => {
    expect(addressOf("../../../elsewhere.md", "docs/a.mdx")).toBe("../../../elsewhere.md");
  });
});
