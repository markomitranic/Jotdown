/**
 * The one reading of a markdown link that the endpoint and the checker share.
 *
 * A disagreement here is the pair of bugs that hides longest: the endpoint
 * leaves a link behind when a page goes, and the checker stays quiet about it.
 */

import { describe, expect, test } from "vitest";
import { BARE_PAGE_LINK, attributeLinksIn, linksIn, rewriteTargets, unlink } from "./links";

describe("linksIn", () => {
  test("finds inline links, images and reference definitions, with their lines", () => {
    const text = "See [BFF](./bff.mdx).\n\n![A shot](/img/docs/a.png)\n\n[home]: ../index.mdx\n";

    expect(linksIn(text)).toEqual([
      { target: "./bff.mdx", line: 1 },
      { target: "/img/docs/a.png", line: 3 },
      { target: "../index.mdx", line: 5 },
    ]);
  });

  test("reads an index signature in a code fence as code, not as a definition", () => {
    const text = "```ts\ntype A = {\n  [key: string]: unknown;\n};\n```\n";

    expect(linksIn(text)).toEqual([]);
  });

  test("still reports an inline link inside a fence, which a reader can click", () => {
    const text = "```md\n[text](./missing.mdx)\n```\n";

    expect(linksIn(text)).toEqual([{ target: "./missing.mdx", line: 2 }]);
  });

  test("leaves a definition indented four spaces, which is an indented code block", () => {
    expect(linksIn("    [home]: ../index.mdx\n")).toEqual([]);
    expect(linksIn("   [home]: ../index.mdx\n")).toEqual([{ target: "../index.mdx", line: 1 }]);
  });
});

describe("rewriteTargets", () => {
  test("moves a definition and an inline link together", () => {
    const text = "See [BFF](./old.mdx).\n\n[home]: ./old.mdx\n";

    expect(rewriteTargets(text, () => "./new.mdx")).toBe("See [BFF](./new.mdx).\n\n[home]: ./new.mdx\n");
  });

  test("never rewrites inside a code fence what only looks like a definition", () => {
    const text = "```ts\n  [key: string]: unknown;\n```\n";

    expect(rewriteTargets(text, () => "./new.mdx")).toBe(text);
  });
});

describe("attributeLinksIn", () => {
  test("finds the href of a JSX tag, which markdown syntax never sees", () => {
    const text = '<FileAttachment\n  href="/files/docs/9f2c.zip"\n  name="harness.zip"\n/>\n';

    expect(attributeLinksIn(text)).toEqual([{ target: "/files/docs/9f2c.zip", line: 2 }]);
  });
});

describe("unlink", () => {
  test("leaves the label where the link was", () => {
    const text = "Read [the BFF page](./bff.mdx) first.\n";

    expect(unlink(text, (target) => target === "./bff.mdx")).toBe("Read the BFF page first.\n");
  });

  test("leaves an image alone, since its file is still there", () => {
    const text = "![A shot](/img/docs/a.png)\n";

    expect(unlink(text, () => true)).toBe(text);
  });

  test("leaves the links it is not asked about", () => {
    const text = "See [one](./a.mdx) and [two](./b.mdx).\n";

    expect(unlink(text, (target) => target === "./a.mdx")).toBe("See one and [two](./b.mdx).\n");
  });
});

describe("BARE_PAGE_LINK", () => {
  test("matches a file named without a folder in front of it", () => {
    expect(BARE_PAGE_LINK.test("Form.md")).toBe(true);
    expect(BARE_PAGE_LINK.test("Form.md#send")).toBe(true);
    expect(BARE_PAGE_LINK.test("nested/Form.mdx")).toBe(true);
  });

  test("leaves every other spelling for the author to have meant", () => {
    expect(BARE_PAGE_LINK.test("./Form.md")).toBe(false);
    expect(BARE_PAGE_LINK.test("../Form.md")).toBe(false);
    expect(BARE_PAGE_LINK.test("/core-api/form")).toBe(false);
    expect(BARE_PAGE_LINK.test("#send")).toBe(false);
    expect(BARE_PAGE_LINK.test("https://example.com/a.md")).toBe(false);
  });
});
