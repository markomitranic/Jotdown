/**
 * Editing a folder in place.
 *
 * A save writes the file and nothing else, and a page an agent rewrote while
 * it was open is never written over. A path that runs through a symbolic link
 * or up out of the folder never reaches the disk.
 */

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { commitFile, readSource } from "./editing";
import { inFolder } from "./files";

let folder = "";
const author = { name: "Ada", email: "ada@example.com" };

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "jotdown-disk-"));
  await mkdir(join(folder, "docs"));
  await writeFile(join(folder, "docs/index.mdx"), "# Before\n");
});

afterEach(() => rm(folder, { recursive: true, force: true }));

test("a save writes the page to disk", async () => {
  const source = await readSource(folder, "docs/index.mdx");
  if (!source.ok) throw new Error("the page should read");

  const saved = await commitFile(folder, folder, {
    path: "docs/index.mdx",
    text: "# After\n",
    sha: source.value.sha,
    message: "Edit",
    author,
  });

  expect(saved.ok).toBe(true);
  expect(await readFile(join(folder, "docs/index.mdx"), "utf8")).toBe("# After\n");
});

test("a save over a page rewritten on disk since it was opened is refused, and the rewrite kept", async () => {
  const source = await readSource(folder, "docs/index.mdx");
  if (!source.ok) throw new Error("the page should read");
  await writeFile(join(folder, "docs/index.mdx"), "# Written by an agent\n");

  const saved = await commitFile(folder, folder, {
    path: "docs/index.mdx",
    text: "# After\n",
    sha: source.value.sha,
    message: "Edit",
    author,
  });

  expect(saved.ok ? null : saved.failure.status).toBe(409);
  expect(await readFile(join(folder, "docs/index.mdx"), "utf8")).toBe("# Written by an agent\n");
});

test("a path through a symbolic link or out of the folder is refused", async () => {
  const outside = await mkdtemp(join(tmpdir(), "jotdown-outside-"));
  await symlink(outside, join(folder, "docs/linked"));

  await expect(inFolder(folder, "docs/linked/page.mdx")).rejects.toThrow(/symbolic link/);
  await expect(inFolder(folder, "docs/../../etc/passwd")).rejects.toThrow(/not a path inside/);

  await rm(outside, { recursive: true, force: true });
});
