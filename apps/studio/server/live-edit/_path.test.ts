/**
 * The write endpoint's security boundary.
 *
 * A path arrives from the browser and ends up in a URL that commits to the
 * repo. The shared site password means the caller is a colleague rather than a
 * stranger, but a colleague still must not be able to rewrite `next.config.ts`,
 * `proxy.ts` or a workflow file, by accident or out of curiosity. These cases
 * are the reason to trust that they cannot.
 */

import { describe, expect, test } from "vitest";
import { parseContentPath, parseFolderPath, parseOrderFolder, parseOrderNames } from "./_contract";
import { repoPath } from "@jotdown/core/lib/paths";

const accepted = [
  "docs/index.mdx",
  "docs/architecture/index.mdx",
  "docs/security-and-compliance/commit-signing.md",
  "docs/decision-records/0001-shared-client-side-page-layout.md",
];

const rejected = [
  "",
  "docs",
  "docs/",
  "proxy.ts",
  "next.config.ts",
  "package.json",
  ".github/workflows/deploy.yml",
  "docs/../proxy.ts",
  "docs/../../etc/passwd",
  "docs/..%2fproxy.ts",
  "docs/%2e%2e/proxy.ts",
  "docs\\..\\proxy.ts",
  "/docs/index.mdx",
  "//docs/index.mdx",
  "docs//index.mdx",
  "./docs/index.mdx",
  "docs/./index.mdx",
  "docs/.env",
  "docs/.git/config",
  "docs/index.ts",
  "docs/index.md.ts",
  "docs/index",
  "docs/index.mdx\n",
  "docs/index.mdx ",
  " docs/index.mdx",
  "DOCS/index.mdx",
  "src/pages/index.tsx",
  "docs/a/../../proxy.ts",
];

describe("parseContentPath", () => {
  test.each(accepted)("accepts %p", (path) => {
    const result = parseContentPath(path);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(path);
  });

  test.each(rejected)("rejects %p", (path) => {
    expect(parseContentPath(path).ok).toBe(false);
  });

  test("rejects a missing path", () => {
    expect(parseContentPath(null).ok).toBe(false);
  });

  /**
   * Decoding before validating is the classic way an allowlist like this gets
   * defeated, so this asserts the order rather than the outcome of one input.
   */
  test("validates the raw string, never a decoded one", () => {
    const encoded = "docs/%2e%2e%2fproxy.ts";
    expect(parseContentPath(encoded).ok).toBe(false);
    expect(decodeURIComponent(encoded)).toBe("docs/../proxy.ts");
  });
});

/**
 * The docs root has a `meta.json` like every other folder, so reordering the top
 * level is ordinary. The ops that would create, rename or move a folder still
 * must not accept the root.
 */
describe("parseOrderFolder", () => {
  test("accepts the docs root, which a top-level drag names", () => {
    expect(parseOrderFolder("docs")).toEqual({ ok: true, value: "docs" });
  });

  test("accepts a section, like the folder check it wraps", () => {
    expect(parseOrderFolder("docs/architecture").ok).toBe(true);
  });

  test("rejects what the folder check rejects", () => {
    expect(parseOrderFolder("docs/../proxy.ts").ok).toBe(false);
    expect(parseOrderFolder(null).ok).toBe(false);
  });

  test("leaves the root out of the check the section ops use", () => {
    expect(parseFolderPath("docs").ok).toBe(false);
  });
});

describe("parseOrderNames", () => {
  test("accepts a sidebar link beside pages, since a reorder places links too", () => {
    const names = ["index", "[ExternalLink][Next.js docs](https://nextjs.org/docs)", "changelog"];

    expect(parseOrderNames(names)).toEqual({ ok: true, value: names });
  });

  test("rejects what is neither a name nor a link", () => {
    expect(parseOrderNames(["../proxy"]).ok).toBe(false);
    expect(parseOrderNames(["..."]).ok).toBe(false);
    expect(parseOrderNames("index").ok).toBe(false);
  });
});

/**
 * A site deployed from a subfolder is the only case where the path the browser
 * sends and the path GitHub wants are different strings. The allowlist runs on
 * the browser's, and this is what turns it into GitHub's afterwards.
 */
describe("repoPath", () => {
  test("leaves a path alone when the site is the whole repository", () => {
    expect(repoPath("docs/index.mdx", "")).toBe("docs/index.mdx");
  });

  test("counts from the repository root when the site is a folder in one", () => {
    expect(repoPath("docs/index.mdx", "apps/docs")).toBe("apps/docs/docs/index.mdx");
  });
});
